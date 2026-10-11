"""Comments, insights, reports, notifications, activity and settings schemas (mirror frontend/src/types)."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import ConfigDict, Field, StringConstraints, field_validator, model_validator

from .base import ApiModel, JsonDoc, optional
from .core import TeamMemberOut

Number = int | float

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]

CommentStatusLiteral = Literal["needs_response", "reviewed", "responded", "resolved", "lead_created", "archived"]


# --- comments ------------------------------------------------------------------------
class InstagramCommentOut(ApiModel):
    __omit_if_none__ = optional("location", "verified", "lead_id")
    id: str
    ref: str
    author_name: str
    handle: str
    location: str | None = None
    verified: bool | None = None
    text: str
    highlights: list[str]
    content_id: str
    campaign_id: str | None
    account_id: str
    received_at: str
    received_label: str
    surface: str
    language: str
    sentiment: Literal["positive", "neutral", "negative"]
    intent: Literal["application", "eligibility", "product", "information", "feedback", "complaint", "other"]
    lead_potential: Literal["high", "medium", "low"]
    intent_score: int
    status: CommentStatusLiteral
    flagged: bool
    lead_id: str | None = None
    suggested_reply: str
    ai: JsonDoc


class CommentListOut(ApiModel):
    items: list[InstagramCommentOut]
    sample_size: int
    total_comments: int


class SentimentTotalsOut(ApiModel):
    positive: int
    neutral: int
    negative: int


class CommentSummaryOut(ApiModel):
    account_id: str
    period: dict[str, str]
    total_comments: int
    total_delta_pct: Number
    baseline_comments: int
    sentiment: SentimentTotalsOut
    potential_leads: int
    potential_leads_delta_label: str
    needs_response: int
    responded: int
    resolved: int
    avg_sentiment_score: Number
    avg_sentiment_delta_pts: Number
    classification_confidence: Number
    intents: list[Any]
    response_queue: list[Any]
    strategic_intel: list[Any]
    strategic_intel_confidence: Number
    peak_note: str


class SentimentTrendPointOut(ApiModel):
    date: str
    positive: int
    neutral: int
    negative: int
    score: Number


class CommentPatchIn(ApiModel):
    model_config = ConfigDict(extra="forbid")

    """PATCH /comments/{id}. Only local triage state — nothing is posted to Instagram."""

    status: CommentStatusLiteral | None = None
    flagged: bool | None = None
    lead_id: str | None = None

    @model_validator(mode="after")
    def _not_empty(self) -> CommentPatchIn:
        if not self.model_fields_set:
            raise ValueError("Provide at least one of: status, flagged, leadId")
        return self


class CommentConvertOut(ApiModel):
    """POST /comments/{id}/convert-to-lead. ``created`` is false on a repeated request or when the
    commenter was already a lead (the comment is linked to that lead instead)."""

    lead: Any
    comment: InstagramCommentOut
    created: bool


class CommentBulkIn(ApiModel):
    ids: list[str] = Field(min_length=1, max_length=500)
    status: CommentStatusLiteral


# --- insights ------------------------------------------------------------------------
class InsightOut(ApiModel):
    __omit_if_none__ = optional("detail", "ai")
    id: str
    category: Literal["campaign", "content", "audience", "comments", "leads"]
    priority: Literal["high", "medium", "low"]
    confidence: int
    title: str
    observed: str
    interpretation: str
    impact: JsonDoc
    primary_link: JsonDoc
    generated_at: str
    status: Literal["new", "reviewed", "saved", "completed", "dismissed"]
    completed_step_ids: list[str]
    detail: JsonDoc | None = None
    # Phase 7: present only on AI-generated insights — provider/model, evidence (with definitions and periods),
    # evidence quality, recommendation, prompt version and timestamps. Absent on demonstration insights.
    ai: JsonDoc | None = None


class RecommendedActionOut(ApiModel):
    __omit_if_none__ = optional("metric_note_tone", "feedback")
    id: str
    priority: Literal["high", "medium", "low"]
    title: str
    rationale: str
    metric: str
    metric_note: str
    metric_note_tone: str | None = None
    impact: str
    target: JsonDoc
    insight_id: str
    status: Literal["pending_review", "reviewed", "done", "dismissed"]
    feedback: str | None = None


class InsightStatusIn(ApiModel):
    status: Literal["new", "reviewed", "saved", "completed", "dismissed"]


class ActionStatusIn(ApiModel):
    status: Literal["pending_review", "reviewed", "done", "dismissed"]
    feedback: str | None = Field(default=None, max_length=2000)


class UpdatedCountOut(ApiModel):
    updated: int


# --- reports -------------------------------------------------------------------------
ReportTypeLiteral = Literal["campaign_performance", "content_reel", "audience", "comments_sentiment", "lead_generation", "executive_summary"]
ReportMetricLiteral = Literal["views", "reach", "engagement", "watchTime", "comments", "leads"]
ReportSectionLiteral = Literal["summary", "kpis", "timeline", "formats", "campaigns", "creatives", "audience", "recommendations"]


class PeriodIn(ApiModel):
    start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def _order(self) -> PeriodIn:
        if self.end < self.start:
            raise ValueError("period.end must be on or after period.start")
        return self


class ReportConfigIn(ApiModel):
    """Body of POST /reports and PUT /reports/{id} (frontend ``ReportConfig``)."""

    title: str = Field(min_length=3, max_length=240)
    type: ReportTypeLiteral
    scope: Literal["campaigns", "account"]
    account_id: str
    campaign_ids: list[str] = Field(max_length=50)
    content_ids: list[str] | None = None
    period: PeriodIn
    metrics: list[ReportMetricLiteral] = Field(min_length=1)
    sections: list[ReportSectionLiteral] = Field(min_length=1)
    compare_baseline: bool
    formats: list[Literal["pdf", "csv"]] = Field(min_length=1)
    schedule: Literal["none", "weekly", "monthly"]
    recipients: list[Email] = Field(default_factory=list, max_length=20)


class ReportArchiveIn(ApiModel):
    archived: bool


class ReportOut(ApiModel):
    __omit_if_none__ = optional("content_ids", "next_run_label", "failure_reason", "narrative")
    id: str
    code: str
    title: str
    type: ReportTypeLiteral
    scope: Literal["campaigns", "account"]
    account_id: str
    campaign_ids: list[str]
    content_ids: list[str] | None = None
    period: dict[str, str]
    metrics: list[str]
    sections: list[str]
    compare_baseline: bool
    formats: list[str]
    schedule: Literal["none", "weekly", "monthly"]
    recipients: list[str]
    status: Literal["ready", "ready_demo", "generating", "scheduled", "failed", "archived"]
    icon: str
    generated_at: str
    generated_label: str
    created_by: str
    next_run_label: str | None = None
    failure_reason: str | None = None
    narrative: JsonDoc | None = None


class ReportReferenceOut(ApiModel):
    boost_spend_inr: dict[str, int]
    cpl_benchmark_inr: int


# --- notifications -------------------------------------------------------------------
NotificationCategoryLiteral = Literal["campaigns", "leads", "content", "account", "ai", "reports"]


class NotificationOut(ApiModel):
    __omit_if_none__ = optional("emphasis", "quote", "href", "secondary_action", "report_id")
    id: str
    category: NotificationCategoryLiteral
    priority: Literal["urgent", "high", "standard"]
    title: str
    body: str
    emphasis: list[str] | None = None
    quote: str | None = None
    time_label: str
    timestamp_label: str
    group: Literal["today", "earlier", "yesterday", "week"]
    read: bool
    href: str | None = None
    icon: str
    tone: Literal["amber", "emerald", "ai", "sky", "slate"]
    badge: JsonDoc
    tags: list[Any]
    primary_action: JsonDoc
    secondary_action: JsonDoc | None = None
    meta: list[Any]
    report_id: str | None = None


class NotificationReadIn(ApiModel):
    read: bool


class NotificationPreferencesIn(ApiModel):
    class Channels(ApiModel):
        in_app: bool
        email_digest: bool

    class Thresholds(ApiModel):
        token_expiry_days: int = Field(ge=1, le=60)
        lead_score: Literal["high", "medium", "any"]
        sentiment_spike_pct: int = Field(ge=1, le=100)

    channels: Channels
    thresholds: Thresholds
    categories: dict[NotificationCategoryLiteral, bool]

    @field_validator("categories")
    @classmethod
    def _all_categories(cls, value: dict[str, bool]) -> dict[str, bool]:
        missing = {"campaigns", "leads", "content", "account", "ai", "reports"} - set(value)
        if missing:
            raise ValueError(f"categories is missing: {', '.join(sorted(missing))}")
        return value


# --- activity ------------------------------------------------------------------------
class ActivityActorOut(ApiModel):
    __omit_if_none__ = optional("icon", "email", "role")
    id: str
    kind: Literal["member", "system", "ai"]
    name: str
    short_label: str
    icon: str | None = None
    email: str | None = None
    role: str | None = None


class ActivityEntryOut(ApiModel):
    __omit_if_none__ = optional("kind_icon_class", "title_tag", "account_id", "outcome_label", "diff")
    id: str
    timestamp: str
    category: str
    kind: str
    kind_icon: str
    kind_tone: str
    kind_icon_class: str | None = None
    title: str
    title_tag: JsonDoc | None = None
    summary: str
    narrative: str
    target: JsonDoc
    actor_id: str
    account_id: str | None = None
    outcome: Literal["success", "in_progress", "warning", "failed", "resolved"]
    outcome_label: str | None = None
    response_status: str
    origin: str
    payload: JsonDoc
    diff: list[Any] | None = None


class ActivitySummaryOut(ApiModel):
    total: int
    previous_period_total: int
    automated: int
    operator: int
    issues: int
    issues_addressed: int
    active_operators: int
    pipeline_health: Number


class TeamInviteOut(TeamMemberOut):
    """POST /workspace/members: the pending member plus a one-time invitation link (shown once)."""

    invite_url: str
    invite_expires_in_hours: int
