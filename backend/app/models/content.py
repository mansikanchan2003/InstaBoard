from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, DemoMixin, TimestampMixin, str_enum, WorkspaceOwned
from .enums import ContentType


class ContentItem(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    """Instagram media item (reel / post / carousel / story) with its period totals."""

    __tablename__ = "content_items"
    __table_args__ = (
        CheckConstraint(
            "views >= 0 AND reach >= 0 AND likes >= 0 AND comments >= 0 AND shares >= 0 AND saves >= 0 AND leads >= 0",
            name="non_negative",
        ),
        CheckConstraint("retention IS NULL OR (retention >= 0 AND retention <= 100)", name="retention_range"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("instagram_accounts.id", ondelete="RESTRICT"), index=True)
    # Organic content has no campaign; deleting a campaign keeps its content.
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    caption: Mapped[str] = mapped_column(Text)
    type: Mapped[ContentType] = mapped_column(str_enum(ContentType, "content_type"), index=True)
    published_at: Mapped[date] = mapped_column(Date, index=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    slides: Mapped[int | None] = mapped_column(Integer)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    thumbnail_alt: Mapped[str] = mapped_column(Text)
    is_top_performer: Mapped[bool | None] = mapped_column(Boolean)
    views: Mapped[int] = mapped_column(BigInteger)
    reach: Mapped[int] = mapped_column(BigInteger)
    likes: Mapped[int] = mapped_column(Integer)
    comments: Mapped[int] = mapped_column(Integer)
    shares: Mapped[int] = mapped_column(Integer)
    saves: Mapped[int] = mapped_column(Integer)
    engagement_rate: Mapped[float] = mapped_column(Float)
    leads: Mapped[int] = mapped_column(Integer)
    retention: Mapped[float | None] = mapped_column(Float)
    position: Mapped[int] = mapped_column(Integer, server_default="0")


class ContentAnalytics(TimestampMixin, DemoMixin, Base):
    """Reel / Content Analytics breakdowns (retention curve, discovery, audit…). Only some items have it."""

    __tablename__ = "content_analytics"

    content_id: Mapped[str] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True)
    document: Mapped[dict[str, Any]] = mapped_column()
