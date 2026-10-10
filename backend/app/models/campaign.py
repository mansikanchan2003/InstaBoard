from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, DemoMixin, TimestampMixin, str_enum
from .enums import CampaignHealth, CampaignObjective, CampaignStatus, FunnelStage, MetricPeriod, ThumbnailType


class Campaign(TimestampMixin, DemoMixin, Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="date_order"),
        CheckConstraint("creatives_count >= 0", name="creatives_non_negative"),
        CheckConstraint("budget_inr IS NULL OR budget_inr >= 0", name="budget_non_negative"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    objective: Mapped[CampaignObjective] = mapped_column(str_enum(CampaignObjective, "campaign_objective"), index=True)
    focus: Mapped[str] = mapped_column(String(120))
    status: Mapped[CampaignStatus] = mapped_column(str_enum(CampaignStatus, "campaign_status"), index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    # RESTRICT: an account with campaigns cannot be deleted by accident.
    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="RESTRICT"), index=True)
    creatives_count: Mapped[int] = mapped_column(Integer, server_default="0")
    creatives_note: Mapped[str | None] = mapped_column(String(120))
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    thumbnail_type: Mapped[ThumbnailType | None] = mapped_column(str_enum(ThumbnailType, "thumbnail_type"))
    owner: Mapped[str] = mapped_column(String(160))
    budget_inr: Mapped[int | None] = mapped_column(BigInteger)
    lead_goal: Mapped[int | None] = mapped_column(Integer)
    primary_age_group: Mapped[str | None] = mapped_column(String(20))
    target_regions: Mapped[list[Any]] = mapped_column()
    hashtags: Mapped[list[Any]] = mapped_column()
    health: Mapped[CampaignHealth | None] = mapped_column(str_enum(CampaignHealth, "campaign_health"))
    # Paid boost spend (INR) used by the Reports screen for cost-per-lead.
    boost_spend_inr: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, server_default="0")

    metrics: Mapped[list[CampaignMetrics]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    detail_extras: Mapped[CampaignDetailExtras | None] = relationship(cascade="all, delete-orphan", uselist=False)


class CampaignMetrics(Base):
    """Campaign totals for the reporting period (``current``) and the baseline period."""

    __tablename__ = "campaign_metrics"
    __table_args__ = (
        CheckConstraint(
            "views >= 0 AND reach >= 0 AND likes >= 0 AND comments >= 0 AND shares >= 0 AND saves >= 0 AND leads >= 0",
            name="non_negative",
        ),
    )

    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    period: Mapped[MetricPeriod] = mapped_column(str_enum(MetricPeriod, "metric_period"), primary_key=True)
    views: Mapped[int] = mapped_column(BigInteger)
    reach: Mapped[int] = mapped_column(BigInteger)
    engagement_rate: Mapped[float] = mapped_column(Float)
    likes: Mapped[int] = mapped_column(Integer)
    comments: Mapped[int] = mapped_column(Integer)
    shares: Mapped[int] = mapped_column(Integer)
    saves: Mapped[int] = mapped_column(Integer)
    leads: Mapped[int] = mapped_column(Integer)
    conversion_rate: Mapped[float] = mapped_column(Float)


class CampaignDetailExtras(TimestampMixin, DemoMixin, Base):
    """Campaign Detail presentation data (progression series, AI analysis copy, comment snapshot)."""

    __tablename__ = "campaign_detail_extras"

    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    progression: Mapped[dict[str, Any] | None] = mapped_column()
    analysis: Mapped[list[Any] | None] = mapped_column()
    comments_snapshot: Mapped[dict[str, Any] | None] = mapped_column()
    quick_view_recommendation: Mapped[str | None] = mapped_column(Text)


class CampaignLeadFunnelStage(Base):
    __tablename__ = "campaign_lead_funnel_stages"
    __table_args__ = (CheckConstraint("count >= 0", name="count_non_negative"),)

    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    stage: Mapped[FunnelStage] = mapped_column(str_enum(FunnelStage, "funnel_stage"), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)


class CampaignLeadChannel(Base):
    __tablename__ = "campaign_lead_channels"
    __table_args__ = (UniqueConstraint("campaign_id", "label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    share: Mapped[float] = mapped_column(Float)
    leads: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, server_default="0")
