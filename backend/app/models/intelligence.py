"""AI insights (stored output only — no model is called in this phase), reports, notifications, activity."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, SmallInteger, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, DemoMixin, TimestampMixin, str_enum, WorkspaceOwned
from .enums import (
    ActionStatus,
    ActivityCategory,
    ActivityOutcome,
    ActorKind,
    InsightCategory,
    InsightPriority,
    InsightStatus,
    NotificationCategory,
    NotificationGroup,
    NotificationPriority,
    NotificationTone,
    ReportSchedule,
    ReportScope,
    ReportStatus,
    ReportType,
)


class Insight(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "insights"
    __table_args__ = (
        CheckConstraint("confidence >= 0 AND confidence <= 100", name="confidence_range"),
        CheckConstraint("origin IN ('demo', 'ai')", name="origin_values"),
        Index("uq_insights_workspace_fingerprint", "workspace_id", "fingerprint", unique=True, postgresql_where=text("fingerprint IS NOT NULL")),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    category: Mapped[InsightCategory] = mapped_column(str_enum(InsightCategory, "insight_category"), index=True)
    priority: Mapped[InsightPriority] = mapped_column(str_enum(InsightPriority, "insight_priority"), index=True)
    confidence: Mapped[int] = mapped_column(SmallInteger)
    title: Mapped[str] = mapped_column(Text)
    observed: Mapped[str] = mapped_column(Text)
    interpretation: Mapped[str] = mapped_column(Text)
    impact: Mapped[dict[str, Any]] = mapped_column()
    primary_link: Mapped[dict[str, Any]] = mapped_column()
    generated_label: Mapped[str] = mapped_column(String(80))
    status: Mapped[InsightStatus] = mapped_column(str_enum(InsightStatus, "insight_status"), index=True)
    completed_step_ids: Mapped[list[Any]] = mapped_column()
    # Evidence layout (telemetry table, reasoning, action steps, artifacts, audit) — presentation document.
    detail: Mapped[dict[str, Any] | None] = mapped_column()
    position: Mapped[int] = mapped_column(Integer, server_default="0")
    # Phase 7 provenance. origin='demo' rows are the seeded demonstration output; origin='ai' rows were generated
    # from database evidence by the configured model (details + evidence in ``ai_meta`` / ``detail``).
    origin: Mapped[str] = mapped_column(String(8), server_default="demo")
    fingerprint: Mapped[str | None] = mapped_column(String(64))  # dedupe key for AI insights
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_meta: Mapped[dict[str, Any] | None] = mapped_column()

    actions: Mapped[list[RecommendedAction]] = relationship(back_populates="insight", cascade="all, delete-orphan")


class RecommendedAction(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "recommended_actions"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    insight_id: Mapped[str] = mapped_column(ForeignKey("insights.id", ondelete="CASCADE"), index=True)
    priority: Mapped[InsightPriority] = mapped_column(str_enum(InsightPriority, "action_priority"))
    title: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    metric: Mapped[str] = mapped_column(String(80))
    metric_note: Mapped[str] = mapped_column(String(120))
    metric_note_tone: Mapped[str | None] = mapped_column(String(20))
    impact: Mapped[str] = mapped_column(Text)
    target: Mapped[dict[str, Any]] = mapped_column()
    status: Mapped[ActionStatus] = mapped_column(str_enum(ActionStatus, "action_status"), index=True)
    feedback: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, server_default="0")

    insight: Mapped[Insight] = relationship(back_populates="actions")


class Report(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    """A saved report configuration. Figures are computed on read from campaign/content data
    (the frontend's report engine), so reports never store stale totals."""

    __tablename__ = "reports"
    __table_args__ = (CheckConstraint("period_end >= period_start", name="period_order"), UniqueConstraint("workspace_id", "code"))

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    code: Mapped[str] = mapped_column(String(40))  # unique per workspace
    title: Mapped[str] = mapped_column(String(240))
    type: Mapped[ReportType] = mapped_column(str_enum(ReportType, "report_type"), index=True)
    scope: Mapped[ReportScope] = mapped_column(str_enum(ReportScope, "report_scope"))
    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="RESTRICT"), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    metrics: Mapped[list[Any]] = mapped_column()
    sections: Mapped[list[Any]] = mapped_column()
    compare_baseline: Mapped[bool] = mapped_column(Boolean)
    formats: Mapped[list[Any]] = mapped_column()
    schedule: Mapped[ReportSchedule] = mapped_column(str_enum(ReportSchedule, "report_schedule"))
    # Saved only — nothing is ever emailed in this phase.
    recipients: Mapped[list[Any]] = mapped_column()
    has_content_focus: Mapped[bool] = mapped_column(Boolean, server_default="false")
    status: Mapped[ReportStatus] = mapped_column(str_enum(ReportStatus, "report_status"), index=True)
    icon: Mapped[str] = mapped_column(String(40))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    generated_label: Mapped[str] = mapped_column(String(120))
    created_by: Mapped[str] = mapped_column(String(160))
    next_run_label: Mapped[str | None] = mapped_column(String(120))
    failure_reason: Mapped[str | None] = mapped_column(Text)
    narrative: Mapped[dict[str, Any] | None] = mapped_column()

    campaign_links: Mapped[list[ReportCampaign]] = relationship(cascade="all, delete-orphan", order_by="ReportCampaign.position", lazy="selectin")
    content_links: Mapped[list[ReportContentItem]] = relationship(cascade="all, delete-orphan", order_by="ReportContentItem.position", lazy="selectin")


class ReportCampaign(Base):
    __tablename__ = "report_campaigns"

    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True, index=True)
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class ReportContentItem(Base):
    __tablename__ = "report_content_items"

    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True)
    content_id: Mapped[str] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class Notification(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    category: Mapped[NotificationCategory] = mapped_column(str_enum(NotificationCategory, "notification_category"), index=True)
    priority: Mapped[NotificationPriority] = mapped_column(str_enum(NotificationPriority, "notification_priority"))
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    emphasis: Mapped[list[Any] | None] = mapped_column()
    quote: Mapped[str | None] = mapped_column(Text)
    time_label: Mapped[str] = mapped_column(String(60))
    timestamp_label: Mapped[str] = mapped_column(String(80))
    group: Mapped[NotificationGroup] = mapped_column("group_key", str_enum(NotificationGroup, "notification_group"))
    read: Mapped[bool] = mapped_column(Boolean, server_default="false", index=True)
    href: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(40))
    tone: Mapped[NotificationTone] = mapped_column(str_enum(NotificationTone, "notification_tone"))
    badge: Mapped[dict[str, Any]] = mapped_column()
    tags: Mapped[list[Any]] = mapped_column()
    primary_action: Mapped[dict[str, Any]] = mapped_column()
    secondary_action: Mapped[dict[str, Any] | None] = mapped_column()
    meta: Mapped[list[Any]] = mapped_column()
    report_id: Mapped[str | None] = mapped_column(ForeignKey("reports.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class ActivityActor(DemoMixin, Base):
    """System / AI actors in the audit log. Human actors are ``team_members`` rows."""

    __tablename__ = "activity_actors"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    kind: Mapped[ActorKind] = mapped_column(str_enum(ActorKind, "actor_kind"))
    name: Mapped[str] = mapped_column(String(160))
    short_label: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str | None] = mapped_column(String(40))
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class ActivityEvent(WorkspaceOwned, DemoMixin, Base):
    __tablename__ = "activity_events"
    __table_args__ = (Index("ix_activity_events_occurred_at", "occurred_at"),)

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    category: Mapped[ActivityCategory] = mapped_column(str_enum(ActivityCategory, "activity_category"), index=True)
    kind: Mapped[str] = mapped_column(String(80))
    kind_icon: Mapped[str] = mapped_column(String(40))
    kind_tone: Mapped[str] = mapped_column(String(20))
    kind_icon_class: Mapped[str | None] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(Text)
    title_tag: Mapped[dict[str, Any] | None] = mapped_column()
    summary: Mapped[str] = mapped_column(Text)
    narrative: Mapped[str] = mapped_column(Text)
    target: Mapped[dict[str, Any]] = mapped_column()
    # Either a team_members.id or an activity_actors.id (validated by the service layer).
    actor_id: Mapped[str] = mapped_column(String(80), index=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="SET NULL"), index=True)
    outcome: Mapped[ActivityOutcome] = mapped_column(str_enum(ActivityOutcome, "activity_outcome"), index=True)
    outcome_label: Mapped[str | None] = mapped_column(String(80))
    response_status: Mapped[str] = mapped_column(String(80))
    origin: Mapped[str] = mapped_column(String(160))
    payload: Mapped[dict[str, Any]] = mapped_column()
    diff: Mapped[list[Any] | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
