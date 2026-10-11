from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, DemoMixin, TimestampMixin, WorkspaceOwned, str_enum
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


class TeamMember(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    """Workspace membership (and its role). ``user_id`` is set once the person has an account —
    invited members have no user until they accept their invitation."""

    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "email"),
        Index("uq_team_members_workspace_user", "workspace_id", "user_id", unique=True, postgresql_where=text("user_id IS NOT NULL")),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(254))  # stored lower-case
    role: Mapped[str] = mapped_column(String(120))
    access: Mapped[MemberAccess] = mapped_column(str_enum(MemberAccess, "member_access"))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[MemberStatus] = mapped_column(str_enum(MemberStatus, "member_status"))
    last_active_label: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer, server_default="0")

    workspace: Mapped[Workspace] = relationship(back_populates="members", foreign_keys="TeamMember.workspace_id")


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
    """Global, non-tenant reference content (e.g. the Instagram scope catalog, trigger definitions).
    Anything belonging to one workspace lives in ``workspace_documents`` instead."""

    __tablename__ = "reference_documents"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    description: Mapped[str] = mapped_column(Text, server_default="")
    document: Mapped[Any] = mapped_column(JSONB)


class WorkspaceDocument(WorkspaceOwned, TimestampMixin, DemoMixin, Base):
    """Workspace-specific presentation documents (AI overview copy, executive brief, account summary…)."""

    __tablename__ = "workspace_documents"
    __table_args__ = (UniqueConstraint("workspace_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(80))
    document: Mapped[Any] = mapped_column(JSONB)
