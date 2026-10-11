"""AI intelligence persistence (Phase 7): durable AI jobs, usage accounting, analysis cache, comment classifications
and lead summaries. Original comments/leads are never modified by AI; predictions live here, separately from
human-reviewed values."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, WorkspaceOwned, str_enum
from .enums import AIJobKind, AIJobStatus


class AIJob(WorkspaceOwned, Base):
    """A queued AI task (insights / comment classification / lead summary), executed by the Celery worker.
    At most one *active* job per (workspace, idempotency_key) — repeated requests return the running job."""

    __tablename__ = "ai_jobs"
    __table_args__ = (
        Index("uq_ai_jobs_one_active", "workspace_id", "idempotency_key", unique=True,
              postgresql_where=text("status IN ('queued', 'running', 'retrying')")),
        Index("ix_ai_jobs_status_due", "status", "next_retry_at"),
        CheckConstraint("progress BETWEEN 0 AND 100", name="progress_range"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[AIJobKind] = mapped_column(str_enum(AIJobKind, "ai_job_kind"), index=True)
    status: Mapped[AIJobStatus] = mapped_column(str_enum(AIJobStatus, "ai_job_status"), index=True)
    params: Mapped[dict[str, Any]] = mapped_column()
    idempotency_key: Mapped[str] = mapped_column(String(160))
    requested_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    trigger: Mapped[str] = mapped_column(String(16), server_default="manual")  # manual | scheduled
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    progress: Mapped[int] = mapped_column(Integer, server_default="0")
    progress_stage: Mapped[str | None] = mapped_column(String(40))
    result: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    retry_count: Mapped[int] = mapped_column(Integer, server_default="0")
    max_retries: Mapped[int] = mapped_column(Integer, server_default="2")
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_category: Mapped[str | None] = mapped_column(String(40))
    error_message: Mapped[str | None] = mapped_column(Text)


class AIUsageRecord(WorkspaceOwned, Base):
    """One provider call: provider-reported tokens (if any), latency and outcome. Never prompts or outputs."""

    __tablename__ = "ai_usage_records"
    __table_args__ = (Index("ix_ai_usage_workspace_created", "workspace_id", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_jobs.id", ondelete="SET NULL"), index=True)
    task: Mapped[str] = mapped_column(String(40))
    provider: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(40))
    outcome: Mapped[str] = mapped_column(String(40))  # ok | <error category>
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIAnalysisCache(WorkspaceOwned, Base):
    """Result of one insight analysis, keyed by evidence hash + period + prompt version + model configuration.
    The same key within its validity window is answered from here without a model call."""

    __tablename__ = "ai_analysis_cache"
    __table_args__ = (UniqueConstraint("workspace_id", "cache_key"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(64))
    evidence_hash: Mapped[str] = mapped_column(String(64))
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    prompt_version: Mapped[str] = mapped_column(String(40))
    model_key: Mapped[str] = mapped_column(String(200))
    insight_ids: Mapped[list[Any]] = mapped_column()
    outcome: Mapped[dict[str, Any]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CommentClassification(WorkspaceOwned, Base):
    """AI prediction for one comment under one classifier version, plus the optional human review.
    ``source``: ``workspace`` (comments table) or ``instagram`` (instagram_comments, Phase 5)."""

    __tablename__ = "comment_classifications"
    __table_args__ = (
        UniqueConstraint("workspace_id", "source", "comment_id", "classifier_version", name="uq_comment_classifications_version"),
        Index("ix_comment_classifications_comment", "workspace_id", "source", "comment_id"),
        CheckConstraint("source IN ('workspace', 'instagram')", name="source_values"),
        CheckConstraint("review_status IN ('unreviewed', 'confirmed', 'corrected')", name="review_values"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(16))
    comment_id: Mapped[str] = mapped_column(String(80))
    text_hash: Mapped[str] = mapped_column(String(64))
    classifier_version: Mapped[str] = mapped_column(String(200))  # prompt version + provider/model
    sentiment: Mapped[str] = mapped_column(String(16))
    intent: Mapped[str] = mapped_column(String(32))
    lead_signal: Mapped[bool] = mapped_column(Boolean)
    priority: Mapped[str] = mapped_column(String(8))
    uncertainty: Mapped[str] = mapped_column(String(8))
    explanation: Mapped[str] = mapped_column(Text)
    injection_suspected: Mapped[bool] = mapped_column(Boolean, server_default="false")
    review_status: Mapped[str] = mapped_column(String(16), server_default="unreviewed")
    reviewed_sentiment: Mapped[str | None] = mapped_column(String(16))
    reviewed_intent: Mapped[str | None] = mapped_column(String(32))
    reviewed_lead_signal: Mapped[bool | None] = mapped_column(Boolean)
    reviewed_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_jobs.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LeadAISummary(WorkspaceOwned, Base):
    """AI follow-up summary for a lead; keyed by an input hash so unchanged context is not re-sent to the model."""

    __tablename__ = "lead_ai_summaries"
    __table_args__ = (UniqueConstraint("lead_id", "input_hash", "version"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    input_hash: Mapped[str] = mapped_column(String(64))
    version: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    follow_up_reason: Mapped[str] = mapped_column(Text)
    suggested_next_action: Mapped[str] = mapped_column(Text)
    uncertainty: Mapped[str] = mapped_column(String(8))
    injection_suspected: Mapped[bool] = mapped_column(Boolean, server_default="false")
    job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_jobs.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
