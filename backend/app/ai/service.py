"""The single gateway business code uses to call a model.

``AIGateway.generate(...)``:
1. refuses when AI is disabled or the workspace exceeded its app-enforced budget (tokens this UTC month / requests
   today, provider-reported tokens — this is InstaBoard's own limit, not a provider spending cap);
2. bounds the input size;
3. calls the provider with bounded retries + exponential backoff with jitter for retryable errors
   (rate limits honour ``Retry-After``; auth/config errors are never retried);
4. validates the output with the Pydantic schema (invalid output counts as a retryable failure);
5. records one ``AIUsageRecord`` per provider call (tokens, latency, outcome) — never prompts or outputs.
"""

from __future__ import annotations

import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import AIUsageRecord

from .errors import AIBudgetExceededError, AIDisabledError, AIError, AIInvalidOutputError, AIRateLimitedError
from .providers import AIProvider, build_provider
from .schemas import json_schema

logger = logging.getLogger("instaboard.ai")
T = TypeVar("T", bound=BaseModel)


@dataclass
class Generation:
    output: BaseModel
    provider: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
    attempts: int


def usage_this_period(db: Session, workspace_id: str, *, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tokens = db.scalar(select(func.coalesce(func.sum(func.coalesce(AIUsageRecord.input_tokens, 0) + func.coalesce(AIUsageRecord.output_tokens, 0)), 0))
                       .where(AIUsageRecord.workspace_id == workspace_id, AIUsageRecord.created_at >= month_start)) or 0
    requests_today = db.scalar(select(func.count()).select_from(AIUsageRecord)
                               .where(AIUsageRecord.workspace_id == workspace_id, AIUsageRecord.created_at >= day_start)) or 0
    requests_month = db.scalar(select(func.count()).select_from(AIUsageRecord)
                               .where(AIUsageRecord.workspace_id == workspace_id, AIUsageRecord.created_at >= month_start)) or 0
    failures_month = db.scalar(select(func.count()).select_from(AIUsageRecord)
                               .where(AIUsageRecord.workspace_id == workspace_id, AIUsageRecord.created_at >= month_start, AIUsageRecord.outcome != "ok")) or 0
    avg_latency = db.scalar(select(func.avg(AIUsageRecord.latency_ms)).where(
        AIUsageRecord.workspace_id == workspace_id, AIUsageRecord.created_at >= month_start, AIUsageRecord.outcome == "ok"))
    return {"tokens_month": int(tokens), "requests_today": int(requests_today), "requests_month": int(requests_month),
            "failures_month": int(failures_month), "avg_latency_ms": int(avg_latency) if avg_latency else None}


class AIGateway:
    def __init__(self, settings: Settings, db: Session, workspace_id: str, *, provider: AIProvider | None = None,
                 provider_factory: Callable[[], AIProvider] | None = None, sleep: Callable[[float], None] = time.sleep) -> None:
        self.settings, self.db, self.workspace_id = settings, db, workspace_id
        self._provider = provider
        self._factory = provider_factory or (lambda: build_provider(settings))
        self._sleep = sleep

    @property
    def provider(self) -> AIProvider:
        if self._provider is None:
            if not self.settings.ai_enabled:
                raise AIDisabledError()
            self._provider = self._factory()
        return self._provider

    @property
    def model_key(self) -> str:
        return f"{self.settings.ai_provider}:{self.settings.ai_model or '-'}"

    def close(self) -> None:
        if self._provider is not None:
            self._provider.close()

    def check_budget(self) -> None:
        if not self.settings.ai_enabled:
            raise AIDisabledError()
        usage = usage_this_period(self.db, self.workspace_id)
        if self.settings.ai_monthly_token_limit and usage["tokens_month"] >= self.settings.ai_monthly_token_limit:
            raise AIBudgetExceededError()
        if self.settings.ai_daily_request_limit and usage["requests_today"] >= self.settings.ai_daily_request_limit:
            raise AIBudgetExceededError("This workspace reached its daily AI request limit. Try again tomorrow; deterministic analytics remain available.")

    def generate(self, *, task: str, prompt_version: str, system: str, user: str, schema: type[T], job_id: str | None = None,
                 max_output_tokens: int | None = None) -> Generation:
        self.check_budget()
        if len(system) + len(user) > self.settings.ai_max_input_chars:
            raise AIError("The analysis input is larger than the configured AI_MAX_INPUT_CHARS limit; narrow the date range or batch size.")
        attempts = 0
        last: AIError | None = None
        for attempt in range(self.settings.ai_max_retries + 1):
            attempts += 1
            if attempt:
                base = self.settings.ai_retry_backoff_seconds * (2 ** (attempt - 1))
                wait = base + random.uniform(0, base)
                if isinstance(last, AIRateLimitedError) and last.retry_after:
                    wait = max(wait, min(float(last.retry_after), 60.0))
                self._sleep(wait)
            started = time.perf_counter()
            try:
                result = self.provider.complete_structured(system=system, user=user, schema_name=schema.__name__, schema=json_schema(schema),
                                                           max_output_tokens=max_output_tokens or self.settings.ai_max_output_tokens)
            except AIError as exc:
                self._record(task, prompt_version, exc.category, None, None, int((time.perf_counter() - started) * 1000), job_id)
                last = exc
                if not exc.retryable:
                    raise
                if isinstance(exc, AIRateLimitedError) and exc.retry_after and exc.retry_after > 60:
                    raise  # a long wait belongs to the job-level retry, not a blocking sleep
                continue
            try:
                parsed = schema.model_validate(result.data)
            except ValidationError:
                self._record(task, prompt_version, "invalid_output", result.input_tokens, result.output_tokens, result.latency_ms, job_id)
                last = AIInvalidOutputError()
                continue
            self._record(task, prompt_version, "ok", result.input_tokens, result.output_tokens, result.latency_ms, job_id, model=result.model)
            return Generation(output=parsed, provider=self.provider.name, model=result.model, input_tokens=result.input_tokens,
                              output_tokens=result.output_tokens, attempts=attempts)
        assert last is not None
        raise last

    def _record(self, task: str, prompt_version: str, outcome: str, input_tokens: int | None, output_tokens: int | None,
                latency_ms: int, job_id: str | None, *, model: str | None = None) -> None:
        self.db.add(AIUsageRecord(workspace_id=self.workspace_id, job_id=job_id, task=task, provider=self.settings.ai_provider,
                                  model=(model or self.settings.ai_model or "-")[:120], prompt_version=prompt_version, outcome=outcome,
                                  input_tokens=input_tokens, output_tokens=output_tokens, latency_ms=latency_ms))
        self.db.flush()
        logger.info("ai call task=%s outcome=%s in=%s out=%s ms=%s", task, outcome, input_tokens, output_tokens, latency_ms)
