"""Identity: user accounts, server-side sessions and workspace invitations.

* Passwords are stored only as Argon2id hashes.
* Session and invitation tokens are stored only as SHA-256 hashes; the raw token exists in the
  user's cookie / invitation link and is never persisted or logged.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, str_enum
from .enums import MemberAccess


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
        CheckConstraint("password_hash LIKE '$argon2%'", name="argon2_hash"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(254))  # stored lower-case
    name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    # Platform operators (InstaBoard staff). Grants NO access to workspace data by itself.
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, server_default="false")
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSession(Base):
    """A logged-in browser session (server-side, revocable)."""

    __tablename__ = "auth_sessions"
    __table_args__ = (Index("ix_auth_sessions_user_active", "user_id", "revoked_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # public id (safe to show / revoke by)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # sha256(raw cookie token)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Active workspace for this session (validated against membership on every request).
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(String(40))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    ip_address: Mapped[str | None] = mapped_column(String(64))


class Invitation(TimestampMixin, Base):
    """Admin-provisioned onboarding: a one-time link that lets an invited member set a password."""

    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("team_members.id", ondelete="CASCADE"), unique=True)
    email: Mapped[str] = mapped_column(String(254))
    access: Mapped[MemberAccess] = mapped_column(str_enum(MemberAccess, "invitation_access"))
    invited_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
