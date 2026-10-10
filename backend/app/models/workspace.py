from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, DemoMixin, TimestampMixin, str_enum
from .enums import MemberAccess, MemberStatus


class Workspace(TimestampMixin, DemoMixin, Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    plan: Mapped[str] = mapped_column(String(60))
    timezone: Mapped[str] = mapped_column(String(80))
    currency: Mapped[str] = mapped_column(String(40))
    reporting_start: Mapped[date] = mapped_column(Date)
    reporting_end: Mapped[date] = mapped_column(Date)
    reporting_label: Mapped[str] = mapped_column(String(120))
    baseline_start: Mapped[date] = mapped_column(Date)
    baseline_end: Mapped[date] = mapped_column(Date)
    baseline_label: Mapped[str] = mapped_column(String(120))
    last_synced_label: Mapped[str] = mapped_column(String(120))

    members: Mapped[list[TeamMember]] = relationship(back_populates="workspace", cascade="all, delete-orphan", order_by="TeamMember.position")


class TeamMember(TimestampMixin, DemoMixin, Base):
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "email"),
        # At most one demo "session user" per workspace (stand-in until real authentication exists).
        Index("uq_team_members_session_user", "workspace_id", unique=True, postgresql_where=text("is_session_user")),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(254))  # stored lower-case
    role: Mapped[str] = mapped_column(String(120))
    access: Mapped[MemberAccess] = mapped_column(str_enum(MemberAccess, "member_access"))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[MemberStatus] = mapped_column(str_enum(MemberStatus, "member_status"))
    last_active_label: Mapped[str] = mapped_column(String(80))
    is_session_user: Mapped[bool] = mapped_column(Boolean, server_default="false")
    position: Mapped[int] = mapped_column(Integer, server_default="0")

    workspace: Mapped[Workspace] = relationship(back_populates="members")


class WorkspaceSettings(TimestampMixin, DemoMixin, Base):
    """Workspace configuration (one row per workspace). Sections are validated by Pydantic on write."""

    __tablename__ = "workspace_settings"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True)
    general: Mapped[dict[str, Any]] = mapped_column()
    sync: Mapped[dict[str, Any]] = mapped_column()
    ai: Mapped[dict[str, Any]] = mapped_column()
    notifications: Mapped[dict[str, Any]] = mapped_column()
    notification_preferences: Mapped[dict[str, Any]] = mapped_column()
    updated_at_label: Mapped[str] = mapped_column(String(120))
    updated_by: Mapped[str] = mapped_column(String(160))


class ReferenceDocument(TimestampMixin, DemoMixin, Base):
    """Read-only reference / presentation content keyed by name (e.g. scope catalog, AI overview copy).

    Used for singleton documents that have no relational structure of their own.
    """

    __tablename__ = "reference_documents"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    description: Mapped[str] = mapped_column(Text, server_default="")
    document: Mapped[Any] = mapped_column(JSONB)
