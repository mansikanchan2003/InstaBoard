"""Leads, comments and comment analytics."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, SmallInteger, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, DemoMixin, TimestampMixin, str_enum, WorkspaceOwned
from .enums import CommentIntent, CommentSentiment, CommentStatus, LeadPotential, LeadSource, LeadStatus


class Lead(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="score_range"),
        # One lead per Instagram handle per workspace, case-insensitively (comment → lead de-duplicates on this).
        Index("uq_leads_workspace_handle_lower", "workspace_id", text("lower(handle)"), unique=True),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id", ondelete="RESTRICT"), index=True)
    content_id: Mapped[str | None] = mapped_column(ForeignKey("content_items.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    handle: Mapped[str] = mapped_column(String(64))
    location: Mapped[str] = mapped_column(String(120))
    score: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[LeadStatus] = mapped_column(str_enum(LeadStatus, "lead_status"), index=True)
    source: Mapped[LeadSource] = mapped_column(str_enum(LeadSource, "lead_source"))
    last_contact_label: Mapped[str] = mapped_column(String(60))
    first_message: Mapped[str] = mapped_column(Text)
    phone_masked: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)
    # The comment this lead was converted from (unique → a retried conversion cannot create a second lead).
    source_comment_id: Mapped[str | None] = mapped_column(ForeignKey("comments.id", ondelete="SET NULL", use_alter=True), unique=True)
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class Comment(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "comments"
    __table_args__ = (
        CheckConstraint("intent_score >= 0 AND intent_score <= 100", name="intent_score_range"),
        UniqueConstraint("workspace_id", "ref"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    ref: Mapped[str] = mapped_column(String(40))  # unique per workspace
    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), index=True)
    content_id: Mapped[str] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), index=True)
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id", ondelete="SET NULL"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"), index=True)
    author_name: Mapped[str] = mapped_column(String(160))
    handle: Mapped[str] = mapped_column(String(64), index=True)
    location: Mapped[str | None] = mapped_column(String(120))
    verified: Mapped[bool | None] = mapped_column(Boolean)
    text: Mapped[str] = mapped_column(Text)
    highlights: Mapped[list[Any]] = mapped_column()
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_label: Mapped[str] = mapped_column(String(60))
    surface: Mapped[str] = mapped_column(String(40))
    language: Mapped[str] = mapped_column(String(40))
    sentiment: Mapped[CommentSentiment] = mapped_column(str_enum(CommentSentiment, "comment_sentiment"), index=True)
    intent: Mapped[CommentIntent] = mapped_column(str_enum(CommentIntent, "comment_intent"), index=True)
    lead_potential: Mapped[LeadPotential] = mapped_column(str_enum(LeadPotential, "lead_potential"))
    intent_score: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[CommentStatus] = mapped_column(str_enum(CommentStatus, "comment_status"), index=True)
    flagged: Mapped[bool] = mapped_column(Boolean, server_default="false")
    suggested_reply: Mapped[str] = mapped_column(Text)
    # AI triage analysis (summary, qualifier, tier) — stored as produced, read as a whole.
    ai: Mapped[dict[str, Any]] = mapped_column()
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class CommentPeriodSummary(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    """Comment analytics for an account period. Totals cover every comment in the period; the
    ``comments`` table only holds the sampled rows that the UI lists."""

    __tablename__ = "comment_period_summaries"

    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), primary_key=True)
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    period_end: Mapped[date] = mapped_column(Date)
    total_comments: Mapped[int] = mapped_column(Integer)
    total_delta_pct: Mapped[float] = mapped_column(Float)
    baseline_comments: Mapped[int] = mapped_column(Integer)
    sentiment_positive: Mapped[int] = mapped_column(Integer)
    sentiment_neutral: Mapped[int] = mapped_column(Integer)
    sentiment_negative: Mapped[int] = mapped_column(Integer)
    potential_leads: Mapped[int] = mapped_column(Integer)
    potential_leads_delta_label: Mapped[str] = mapped_column(String(80))
    # Period total awaiting review at import time; the live figure subtracts sampled comments triaged since.
    needs_response_total: Mapped[int] = mapped_column(Integer)
    needs_response_sample_baseline: Mapped[int] = mapped_column(Integer)
    responded: Mapped[int] = mapped_column(Integer)
    resolved: Mapped[int] = mapped_column(Integer)
    avg_sentiment_score: Mapped[float] = mapped_column(Float)
    avg_sentiment_delta_pts: Mapped[float] = mapped_column(Float)
    classification_confidence: Mapped[float] = mapped_column(Float)
    intents: Mapped[list[Any]] = mapped_column()
    response_queue: Mapped[list[Any]] = mapped_column()
    strategic_intel: Mapped[list[Any]] = mapped_column()
    strategic_intel_confidence: Mapped[float] = mapped_column(Float)
    peak_note: Mapped[str] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("sentiment_positive + sentiment_neutral + sentiment_negative = total_comments", name="sentiment_sums_to_total"),
    )


class CommentSentimentDaily(WorkspaceOwned, DemoMixin, Base):
    __tablename__ = "comment_sentiment_daily"

    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    positive: Mapped[int] = mapped_column(Integer)
    neutral: Mapped[int] = mapped_column(Integer)
    negative: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float)
