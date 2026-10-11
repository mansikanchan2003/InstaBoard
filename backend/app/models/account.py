"""Instagram accounts, their sync audit log, telemetry and account-level analytics.

No access tokens or Meta credentials are stored anywhere in this schema.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, DemoMixin, TimestampMixin, str_enum, WorkspaceOwned
from .enums import AccountStatus, AccountType, AudienceDimension, KpiMetric, SyncRunStatus, SyncTrigger, TrendMetric


class InstagramAccount(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "instagram_accounts"
    __table_args__ = (
        Index("uq_instagram_accounts_primary", "workspace_id", unique=True, postgresql_where=text("is_primary")),
        CheckConstraint("followers >= 0 AND following >= 0 AND media_count >= 0", name="non_negative_counts"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(200))
    handle: Mapped[str] = mapped_column(String(64), unique=True)
    initials: Mapped[str] = mapped_column(String(4))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    type: Mapped[AccountType] = mapped_column(str_enum(AccountType, "account_type"))
    status: Mapped[AccountStatus] = mapped_column(str_enum(AccountStatus, "account_status"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default="false")
    verified: Mapped[bool] = mapped_column(Boolean, server_default="false")
    external_id: Mapped[str] = mapped_column(String(80), unique=True)
    connected_since: Mapped[date] = mapped_column(Date)
    last_synced_label: Mapped[str] = mapped_column(String(120))
    next_sync_label: Mapped[str | None] = mapped_column(String(120))
    status_note: Mapped[str | None] = mapped_column(Text)
    followers: Mapped[int] = mapped_column(Integer)
    following: Mapped[int] = mapped_column(Integer)
    media_count: Mapped[int] = mapped_column(Integer)
    # {media|audience|comments|stories: {level, label, detail}} — display matrix, always read as a whole.
    data_availability: Mapped[dict[str, Any]] = mapped_column()
    scopes: Mapped[list[Any]] = mapped_column()
    position: Mapped[int] = mapped_column(Integer, server_default="0")

    telemetry: Mapped[AccountTelemetry | None] = relationship(cascade="all, delete-orphan", uselist=False)


class AccountTelemetry(TimestampMixin, DemoMixin, Base):
    """Account Detail telemetry tiles, capability matrix and scope grants (presentation document)."""

    __tablename__ = "account_telemetry"

    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), primary_key=True)
    document: Mapped[dict[str, Any]] = mapped_column()


class SyncLog(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    __tablename__ = "sync_logs"
    __table_args__ = (Index("ix_sync_logs_account_executed", "account_id", "executed_at"),)

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"))
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    executed_label: Mapped[str] = mapped_column(String(80))
    trigger: Mapped[SyncTrigger] = mapped_column(str_enum(SyncTrigger, "sync_trigger"))
    trigger_label: Mapped[str] = mapped_column(String(80))
    duration_sec: Mapped[float | None] = mapped_column(Float)
    media: Mapped[int] = mapped_column(Integer)
    comments: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[SyncRunStatus] = mapped_column(str_enum(SyncRunStatus, "sync_run_status"))
    status_label: Mapped[str] = mapped_column(String(80))
    raw: Mapped[dict[str, Any]] = mapped_column()


class AccountReportingPeriod(TimestampMixin, DemoMixin, Base):
    """Period-level aggregates that cannot be derived from the sampled records (the demo dataset holds
    a sample of leads/comments, while these are the period totals reported for the account)."""

    __tablename__ = "account_reporting_periods"

    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), primary_key=True)
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    period_end: Mapped[date] = mapped_column(Date)
    ai_health_score: Mapped[int | None] = mapped_column(Integer)
    # Lead pipeline aggregates (Leads screen KPI strip)
    total_comment_inquiries: Mapped[int] = mapped_column(Integer)
    ai_filtered_potential: Mapped[int] = mapped_column(Integer)
    ai_intent_rate: Mapped[float] = mapped_column(Float)
    converted_operators: Mapped[int] = mapped_column(Integer)
    close_rate: Mapped[float] = mapped_column(Float)

    kpis: Mapped[list[AccountKpi]] = relationship(cascade="all, delete-orphan")

    __table_args__ = (CheckConstraint("period_end >= period_start", name="period_order"),)


class AccountKpi(Base):
    """One KPI value for an account period (value, % change vs baseline, baseline, optional target)."""

    __tablename__ = "account_kpis"
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id", "period_start"],
            ["account_reporting_periods.account_id", "account_reporting_periods.period_start"],
            ondelete="CASCADE",
        ),
    )

    account_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    metric: Mapped[KpiMetric] = mapped_column(str_enum(KpiMetric, "kpi_metric"), primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    delta_pct: Mapped[float | None] = mapped_column(Float)
    baseline: Mapped[float | None] = mapped_column(Float)
    target: Mapped[float | None] = mapped_column(Float)


class AccountDailyMetric(DemoMixin, Base):
    """Daily trend value for the reporting period with the aligned baseline-period value."""

    __tablename__ = "account_daily_metrics"

    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), primary_key=True)
    metric: Mapped[TrendMetric] = mapped_column(str_enum(TrendMetric, "trend_metric"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    current_value: Mapped[float] = mapped_column(Float)
    previous_value: Mapped[float] = mapped_column(Float)


class AudienceSnapshot(TimestampMixin, DemoMixin, Base):
    __tablename__ = "audience_snapshots"
    __table_args__ = (CheckConstraint("gender_male + gender_female + gender_unknown = 100", name="gender_sums_to_100"),)

    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="CASCADE"), primary_key=True)
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    period_end: Mapped[date] = mapped_column(Date)
    follower_growth_pct: Mapped[float] = mapped_column(Float)
    net_new_followers: Mapped[int] = mapped_column(Integer)
    non_follower_reach_pct: Mapped[float] = mapped_column(Float)
    engaged_audience: Mapped[int] = mapped_column(BigInteger)
    gender_male: Mapped[int] = mapped_column(Integer)
    gender_female: Mapped[int] = mapped_column(Integer)
    gender_unknown: Mapped[int] = mapped_column(Integer)
    # Audience Intelligence breakdowns (segments, cities, growth series, AI narrative) — presentation document.
    intelligence: Mapped[dict[str, Any] | None] = mapped_column()

    breakdowns: Mapped[list[AudienceBreakdown]] = relationship(cascade="all, delete-orphan", order_by="AudienceBreakdown.position")


class AudienceBreakdown(Base):
    __tablename__ = "audience_breakdowns"
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id", "period_start"],
            ["audience_snapshots.account_id", "audience_snapshots.period_start"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("account_id", "period_start", "dimension", "label"),
        CheckConstraint("share >= 0 AND share <= 100", name="share_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str] = mapped_column(String(64))
    period_start: Mapped[date] = mapped_column(Date)
    dimension: Mapped[AudienceDimension] = mapped_column(str_enum(AudienceDimension, "audience_dimension"))
    label: Mapped[str] = mapped_column(String(80))
    share: Mapped[float] = mapped_column(Float)
    audience: Mapped[int | None] = mapped_column(Integer)
    delta_pct: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)
    reach: Mapped[int | None] = mapped_column(BigInteger)
    engaged: Mapped[int | None] = mapped_column(Integer)
    leads: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, server_default="0")
