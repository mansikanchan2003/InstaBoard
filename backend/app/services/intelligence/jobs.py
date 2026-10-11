"""Durable AI jobs on the existing Celery worker (same guarantees as Phase 6 sync jobs).

* One active job per (workspace, idempotency key): repeated requests return the running job.
* Atomic claim + lease renewed at every progress update; ``reap_stale_ai_jobs`` recovers crashed workers.
* Retries only for retryable AI errors (rate limit, timeout, provider unavailable, invalid output) and unexpected
  exceptions, with exponential backoff + jitter honouring ``Retry-After``, up to ``max_retries``. Disabled AI,
  exhausted budgets and auth/config errors fail immediately with a clear category.
* Work is idempotent (cache keys, classification versions, input hashes), so a retry never duplicates results.
"""

from __future__ import annotations

import logging
import random
import secrets
from collections.abc import Callable
from datetime import date, timedelta

from sqlalchemy import and_, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.ai.errors import AIBudgetExceededError, AIDisabledError, AIError
from app.ai.service import AIGateway
from app.core.config import Settings
from app.core.errors import ApiError, ConflictError, NotFoundError
from app.core.tenancy import bind_workspace
from app.models import AIJob, Workspace
from app.models.enums import AIJobKind, AIJobStatus
from app.services.common import utcnow

from . import comments as comment_ai
from . import insights as insight_ai
from . import leads as lead_ai

logger = logging.getLogger("instaboard.ai.jobs")
ACTIVE = ("queued", "running", "retrying")
TERMINAL = ("succeeded", "partially_succeeded", "failed", "cancelled")
LEASE = timedelta(minutes=10)
UNDELIVERED_AFTER = timedelta(minutes=2)
Dispatcher = Callable[[str, float], None]


class AIUnavailableApiError(ApiError):
    status_code = 503
    code = "ai_disabled"


class AIBudgetApiError(ApiError):
    status_code = 429
    code = "ai_budget_exceeded"


def to_api_error(exc: AIError) -> ApiError:
    if isinstance(exc, AIDisabledError):
        return AIUnavailableApiError(exc.safe_message)
    if isinstance(exc, AIBudgetExceededError):
        return AIBudgetApiError(exc.safe_message)
    return ApiError(exc.safe_message)


def enqueue(db: Session, settings: Settings, *, workspace_id: str, kind: AIJobKind, params: dict, idempotency_key: str,
            member_id: str | None, trigger: str = "manual") -> tuple[AIJob, bool]:
    if not settings.ai_enabled:
        raise AIUnavailableApiError(AIDisabledError.message)
    try:
        AIGateway(settings, db, workspace_id).check_budget()
    except AIBudgetExceededError as exc:
        raise AIBudgetApiError(exc.safe_message) from None
    job_id = f"aij_{secrets.token_hex(8)}"
    created = db.execute(insert(AIJob).values(
        id=job_id, workspace_id=workspace_id, kind=kind.value, status=AIJobStatus.queued.value, params=params, idempotency_key=idempotency_key[:160],
        requested_by_member_id=member_id, trigger=trigger, queued_at=utcnow(), result={}, max_retries=settings.ai_max_retries,
    ).on_conflict_do_nothing(index_elements=["workspace_id", "idempotency_key"], index_where=text("status IN ('queued', 'running', 'retrying')"))
        .returning(AIJob.id)).scalar()
    db.flush()
    if created:
        return db.get(AIJob, created), True
    existing = db.scalar(select(AIJob).where(AIJob.workspace_id == workspace_id, AIJob.idempotency_key == idempotency_key[:160],
                                             AIJob.status.in_(ACTIVE)))
    assert existing is not None
    return existing, False


def get_job(db: Session, job_id: str) -> AIJob:
    job = db.get(AIJob, job_id)  # tenant-filtered
    if job is None:
        raise NotFoundError("AI job", job_id)
    return job


def cancel(db: Session, job: AIJob) -> AIJob:
    if job.status.value not in ("queued", "retrying"):
        raise ConflictError(f"The job is {job.status.value} and cannot be cancelled.")
    _finish(job, AIJobStatus.cancelled, "cancelled", "Cancelled by a workspace member.")
    return job


def claim(db: Session, job_id: str) -> AIJob | None:
    now = utcnow()
    claimed = db.execute(update(AIJob).where(
        AIJob.id == job_id, AIJob.status.in_(("queued", "retrying")), or_(AIJob.next_retry_at.is_(None), AIJob.next_retry_at <= now),
    ).values(status=AIJobStatus.running.value, started_at=now, lease_expires_at=now + LEASE, next_retry_at=None)
        .returning(AIJob.id).execution_options(synchronize_session=False)).scalar()
    db.commit()
    return db.get(AIJob, claimed, populate_existing=True) if claimed else None


def _finish(job: AIJob, status: AIJobStatus, category: str | None = None, message: str | None = None) -> None:
    job.status, job.finished_at, job.lease_expires_at, job.next_retry_at = status, utcnow(), None, None
    job.error_category, job.error_message = category, message
    if status in (AIJobStatus.succeeded, AIJobStatus.partially_succeeded):
        job.progress, job.progress_stage = 100, "done"


def backoff(settings: Settings, attempt: int, retry_after: float | None) -> float:
    delay = settings.ai_retry_backoff_seconds * 15 * (2 ** attempt) * random.uniform(0.8, 1.2)
    return float(max(delay, retry_after or 0.0, 1.0))


def execute_ai_job(session_factory, settings: Settings, *, provider_factory=None, dispatcher: Dispatcher | None, job_id: str,
                   sleep: Callable[[float], None] | None = None) -> str:
    with session_factory() as db:
        job = claim(db, job_id)
        if job is None:
            return "skipped"
        bind_workspace(db, job.workspace_id)
        gateway_kwargs = {"provider_factory": provider_factory} if provider_factory else {}
        if sleep is not None:
            gateway_kwargs["sleep"] = sleep
        gateway = AIGateway(settings, db, job.workspace_id, **gateway_kwargs)

        def progress(stage: str, pct: int) -> None:
            job.progress_stage, job.progress = stage, max(job.progress, min(pct, 99))
            job.lease_expires_at = utcnow() + LEASE
            db.commit()

        retry_in: float | None = None
        try:
            result = _run(db, settings, gateway, job, progress)
            job.result = result
            partial = bool(result.get("rejected")) or bool(result.get("unlabelled"))
            _finish(job, AIJobStatus.partially_succeeded if partial else AIJobStatus.succeeded)
        except AIError as exc:
            db.rollback()
            if exc.retryable and job.retry_count < job.max_retries:
                retry_in = backoff(settings, job.retry_count, exc.retry_after)
                job.status, job.retry_count = AIJobStatus.retrying, job.retry_count + 1
                job.next_retry_at, job.lease_expires_at = utcnow() + timedelta(seconds=retry_in), None
                job.error_category = exc.category
                job.error_message = f"{exc.safe_message} Retry {job.retry_count} of {job.max_retries} is scheduled."
            else:
                _finish(job, AIJobStatus.failed, exc.category, exc.safe_message)
        except ApiError as exc:  # e.g. lead not found / validation — not retryable
            db.rollback()
            _finish(job, AIJobStatus.failed, exc.code, exc.message)
        except Exception as exc:  # noqa: BLE001 — log the class only (no prompts/comment text)
            db.rollback()
            logger.error("ai job crashed job=%s kind=%s error=%s", job.id, job.kind.value, exc.__class__.__name__)
            if job.retry_count < job.max_retries:
                retry_in = backoff(settings, job.retry_count, None)
                job.status, job.retry_count = AIJobStatus.retrying, job.retry_count + 1
                job.next_retry_at, job.lease_expires_at = utcnow() + timedelta(seconds=retry_in), None
                job.error_category, job.error_message = "internal_error", "An internal error interrupted the job; it will be retried."
            else:
                _finish(job, AIJobStatus.failed, "internal_error", "An internal error interrupted the job.")
        finally:
            gateway.close()
        db.commit()
        logger.info("ai job finished job=%s kind=%s status=%s category=%s", job.id, job.kind.value, job.status.value, job.error_category)
        if retry_in is not None and dispatcher:
            dispatcher(job.id, retry_in)
        return job.status.value


def _run(db: Session, settings: Settings, gateway: AIGateway, job: AIJob, progress) -> dict:
    p = job.params or {}
    if job.kind == AIJobKind.insights:
        result = insight_ai.generate_insights(db, settings, gateway, workspace_id=job.workspace_id, start=date.fromisoformat(p["start"]),
                                              end=date.fromisoformat(p["end"]), job_id=job.id, progress=progress)
    elif job.kind == AIJobKind.comment_classification:
        result = comment_ai.classify(db, settings, gateway, source=p["source"], ids=p.get("commentIds"), job_id=job.id, progress=progress)
    elif job.kind == AIJobKind.lead_summary:
        progress("summarising", 30)
        result = lead_ai.summarize(db, gateway, lead_id=p["leadId"], job_id=job.id)
    else:  # pragma: no cover
        raise ApiError("Unknown AI job kind.")
    db.flush()
    return result


def reap_stale_ai_jobs(db: Session) -> int:
    now = utcnow()
    stale = list(db.scalars(select(AIJob).where(AIJob.status == AIJobStatus.running, AIJob.lease_expires_at < now).with_for_update(skip_locked=True)))
    for job in stale:
        if job.retry_count < job.max_retries:
            job.status, job.retry_count, job.next_retry_at, job.lease_expires_at = AIJobStatus.retrying, job.retry_count + 1, now, None
            job.error_category, job.error_message = "worker_lost", "The worker stopped during the job; it will be retried."
        else:
            _finish(job, AIJobStatus.failed, "worker_lost", "The worker stopped repeatedly during the job.")
    db.commit()
    return len(stale)


def dispatch_due_ai_jobs(db: Session, dispatcher: Dispatcher) -> int:
    now = utcnow()
    ids = list(db.scalars(select(AIJob.id).where(or_(
        and_(AIJob.status == AIJobStatus.queued, AIJob.queued_at < now - UNDELIVERED_AFTER),
        and_(AIJob.status == AIJobStatus.retrying, AIJob.next_retry_at <= now))).limit(100)))
    for job_id in ids:
        dispatcher(job_id, 0.0)
    return len(ids)


def schedule_insights(db: Session, settings: Settings, dispatcher: Dispatcher) -> int:
    """Daily scheduled insight runs (opt-in). Uses each workspace's reporting period; the analysis cache and insight
    fingerprints make unchanged data cost nothing and never duplicate insights."""
    if not (settings.ai_enabled and settings.ai_scheduled_insights_enabled):
        return 0
    created = []
    for ws in db.scalars(select(Workspace)):
        key = f"insights:{ws.reporting_start}:{ws.reporting_end}"
        try:
            job, new = enqueue(db, settings, workspace_id=ws.id, kind=AIJobKind.insights, params={"start": str(ws.reporting_start), "end": str(ws.reporting_end)},
                               idempotency_key=key, member_id=None, trigger="scheduled")
        except ApiError:
            continue  # budget exhausted for this workspace
        if new:
            created.append(job.id)
    db.commit()
    for job_id in created:
        dispatcher(job_id, 0.0)
    return len(created)
