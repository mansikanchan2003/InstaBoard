"""AI intelligence API shapes. No provider keys, prompts or raw model output appear here."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field, model_validator

from .base import ApiModel


class _In(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")


class AIStatusOut(ApiModel):
    enabled: bool
    provider: str
    model: str | None
    capabilities: list[str]
    usage: dict[str, Any]
    limits: dict[str, Any]
    limits_note: str
    scheduled_insights: bool


class AIJobOut(ApiModel):
    id: str
    kind: str
    status: str
    terminal: bool
    trigger: str
    params: dict[str, Any]
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    progress: int
    progress_stage: str | None
    result: dict[str, Any]
    retry_count: int
    max_retries: int
    next_retry_at: datetime | None
    error_category: str | None
    error_message: str | None


class EnqueuedAIJobOut(ApiModel):
    job: AIJobOut
    deduplicated: bool


class InsightsRequestIn(_In):
    start: date | None = None
    end: date | None = None

    @model_validator(mode="after")
    def _both_or_neither(self):
        if (self.start is None) != (self.end is None):
            raise ValueError("Provide both start and end, or neither (the workspace reporting period is used).")
        return self


class ClassifyRequestIn(_In):
    source: Literal["workspace", "instagram"] = "workspace"
    comment_ids: list[str] | None = Field(default=None, max_length=200)


class ClassificationOut(ApiModel):
    id: str
    source: str
    comment_id: str
    classifier_version: str
    prediction: dict[str, Any]  # sentiment, intent, leadSignal, priority, uncertainty, explanation
    injection_suspected: bool
    review_status: str
    reviewed: dict[str, Any] | None
    reviewed_at: datetime | None
    effective: dict[str, Any]  # human-reviewed values where present, else the prediction
    created_at: datetime


class ClassificationReviewIn(_In):
    review_status: Literal["confirmed", "corrected"]
    sentiment: Literal["positive", "neutral", "negative"] | None = None
    intent: Literal["product_inquiry", "pricing_inquiry", "contact_request", "interest", "complaint_support", "spam_irrelevant", "other"] | None = None
    lead_signal: bool | None = None


class LeadSummaryOut(ApiModel):
    id: str
    lead_id: str
    summary: str
    follow_up_reason: str
    suggested_next_action: str
    uncertainty: str
    injection_suspected: bool
    version: str
    created_at: datetime
