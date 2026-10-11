"""Live Instagram data from the Instagram API with Instagram Login (Phase 5).

These tables hold *provider-sourced* records only (``source = 'instagram_api'``); the demonstration
dataset stays in the existing ``instagram_accounts`` / ``content_items`` / ``comments`` tables
(``is_demo = true``), so live and demo numbers are never mixed in one total.

Provider identifiers (``ig_user_id``, ``ig_media_id``, ``ig_comment_id``) are kept separate from the
internal primary keys. Every table is workspace-owned, so the tenant filter in ``app.core.tenancy``
applies. Access tokens live only in ``instagram_tokens`` — encrypted, deferred-loaded and never part
of an API schema.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, WorkspaceOwned, str_enum
from .enums import IgConnectionStatus, IgSyncStatus

PROVIDER_SOURCE = "instagram_api"


class InstagramConnection(WorkspaceOwned, TimestampMixin, Base):
    """An authorized Instagram professional account connected to one workspace."""

    __tablename__ = "instagram_connections"
    __table_args__ = (
        UniqueConstraint("workspace_id", "ig_user_id"),
        CheckConstraint("source = 'instagram_api'", name="provider_source"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(32), server_default=PROVIDER_SOURCE)
    # Instagram professional account ID (``user_id`` on /me) and the app-scoped user ID (``id`` / token user_id).
    ig_user_id: Mapped[str] = mapped_column(String(64))
    app_scoped_user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    username: Mapped[str] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(200))
    account_type: Mapped[str | None] = mapped_column(String(32))
    profile_picture_url: Mapped[str | None] = mapped_column(Text)
    # Counts as returned by the API; NULL means "not returned", never 0.
    followers_count: Mapped[int | None] = mapped_column(Integer)
    follows_count: Mapped[int | None] = mapped_column(Integer)
    media_count: Mapped[int | None] = mapped_column(Integer)
    profile_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[IgConnectionStatus] = mapped_column(str_enum(IgConnectionStatus, "ig_connection_status"), index=True)
    granted_scopes: Mapped[list[Any]] = mapped_column()
    connected_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # last *successful* sync
    last_sync_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_status: Mapped[str | None] = mapped_column(String(16))
    # Our own safe error code/message (never raw provider payloads or tokens).
    last_error_code: Mapped[str | None] = mapped_column(String(64))
    last_error_message: Mapped[str | None] = mapped_column(Text)
    disconnected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Incremental sync state (Phase 6). The backfill cursor is Meta's opaque paging cursor (not a secret);
    # a full pass that reaches the end of the media list is what allows deleted media to be detected.
    media_backfill_cursor: Mapped[str | None] = mapped_column(Text)
    media_full_pass_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    media_backfill_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Account metrics Instagram rejected outright for this account (error #100) — not requested again.
    unsupported_account_metrics: Mapped[list[Any]] = mapped_column(server_default=text("'[]'::jsonb"))


class InstagramToken(WorkspaceOwned, Base):
    """Encrypted long-lived Instagram User access token for a connection (one row, deleted on disconnect)."""

    __tablename__ = "instagram_tokens"

    connection_id: Mapped[str] = mapped_column(ForeignKey("instagram_connections.id", ondelete="CASCADE"), primary_key=True)
    # Fernet ciphertext; only app.services.instagram.tokens reads it.
    ciphertext: Mapped[str] = mapped_column(Text, nullable=False, deferred=True)
    key_version: Mapped[int] = mapped_column(Integer)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InstagramOAuthState(WorkspaceOwned, Base):
    """Single-use OAuth ``state`` (only its SHA-256 digest is stored) bound to the initiating session."""

    __tablename__ = "instagram_oauth_states"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    member_id: Mapped[str] = mapped_column(ForeignKey("team_members.id", ondelete="CASCADE"))
    session_id: Mapped[str] = mapped_column(ForeignKey("auth_sessions.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InstagramMedia(WorkspaceOwned, TimestampMixin, Base):
    __tablename__ = "instagram_media"
    __table_args__ = (
        UniqueConstraint("connection_id", "ig_media_id"),
        Index("ix_instagram_media_connection_posted", "connection_id", "posted_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("instagram_connections.id", ondelete="CASCADE"))
    ig_media_id: Mapped[str] = mapped_column(String(64))
    media_type: Mapped[str | None] = mapped_column(String(32))
    media_product_type: Mapped[str | None] = mapped_column(String(32))
    caption: Mapped[str | None] = mapped_column(Text)
    permalink: Mapped[str | None] = mapped_column(Text)
    shortcode: Mapped[str | None] = mapped_column(String(64))
    media_url: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    like_count: Mapped[int | None] = mapped_column(Integer)
    comments_count: Mapped[int | None] = mapped_column(Integer)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Set when the API reports the media no longer exists (deleted on Instagram).
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Last insight request for this media (drives refresh prioritisation) and metrics Instagram rejected for it.
    insights_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unsupported_metrics: Mapped[list[Any]] = mapped_column(server_default=text("'[]'::jsonb"))


class InstagramMediaInsight(WorkspaceOwned, Base):
    """One metric observation for one media object. ``captured_at`` is the job's fixed observation time, so a
    retried or redelivered job cannot add a second observation. ``value`` is NULL with ``status='unavailable'``
    when the metric was requested but not returned — it is never stored as a fabricated zero."""

    __tablename__ = "instagram_media_insights"
    __table_args__ = (
        UniqueConstraint("media_id", "metric", "captured_at"),
        CheckConstraint("status IN ('ok', 'unavailable')", name="status_values"),
        CheckConstraint("(status = 'ok') = (value IS NOT NULL)", name="value_matches_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    media_id: Mapped[str] = mapped_column(ForeignKey("instagram_media.id", ondelete="CASCADE"), index=True)
    metric: Mapped[str] = mapped_column(String(64))
    period: Mapped[str] = mapped_column(String(32))
    value: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    api_version: Mapped[str] = mapped_column(String(16))
    unit: Mapped[str] = mapped_column(String(16), server_default="count")
    source: Mapped[str] = mapped_column(String(32), server_default="instagram_api")


class InstagramAccountInsight(WorkspaceOwned, Base):
    """Account-level metric for a time range. Re-fetching the same range updates the value (Meta may revise
    data for up to 48 hours); a new range is a new row, so history is preserved.

    metric_type: ``total_value`` (sum over [range_start, range_end]), ``time_series`` (one day) or ``snapshot``
    (a profile count such as followers_count observed at range_end, de-duplicated per hour)."""

    __tablename__ = "instagram_account_insights"
    __table_args__ = (
        UniqueConstraint("connection_id", "metric", "metric_type", "period", "range_start", "range_end", name="uq_instagram_account_insights_range"),
        CheckConstraint("status IN ('ok', 'unavailable')", name="status_values"),
        CheckConstraint("(status = 'ok') = (value IS NOT NULL)", name="value_matches_status"),
        CheckConstraint("range_end >= range_start", name="range_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("instagram_connections.id", ondelete="CASCADE"), index=True)
    metric: Mapped[str] = mapped_column(String(64))
    metric_type: Mapped[str] = mapped_column(String(16))  # total_value | time_series
    period: Mapped[str] = mapped_column(String(16))
    range_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    range_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    value: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    api_version: Mapped[str] = mapped_column(String(16))
    unit: Mapped[str] = mapped_column(String(16), server_default="count")
    source: Mapped[str] = mapped_column(String(32), server_default="instagram_api")


class InstagramComment(WorkspaceOwned, TimestampMixin, Base):
    """Organic comment on connected media (only fetched when instagram_business_manage_comments is granted)."""

    __tablename__ = "instagram_comments"
    __table_args__ = (UniqueConstraint("connection_id", "ig_comment_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("instagram_connections.id", ondelete="CASCADE"), index=True)
    media_id: Mapped[str] = mapped_column(ForeignKey("instagram_media.id", ondelete="CASCADE"), index=True)
    ig_comment_id: Mapped[str] = mapped_column(String(64))
    parent_ig_comment_id: Mapped[str | None] = mapped_column(String(64))
    text: Mapped[str | None] = mapped_column(Text)
    username: Mapped[str | None] = mapped_column(String(64))
    like_count: Mapped[int | None] = mapped_column(Integer)
    hidden: Mapped[bool | None] = mapped_column(Boolean)
    commented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class InstagramSyncRun(WorkspaceOwned, Base):
    """Durable sync job (Phase 6) — also the sync audit, kept after disconnect. Holds counts, progress and a
    sanitized error category/message; never tokens or provider payloads.

    At most one *active* job (queued / running / retrying) per account is enforced by a partial unique index,
    so neither the scheduler nor repeated clicks can queue duplicates. A worker claims a job atomically and
    holds a lease it renews while working; an expired lease means the worker died and the job is recovered."""

    __tablename__ = "instagram_sync_runs"
    __table_args__ = (
        Index("ix_instagram_sync_runs_connection_started", "connection_id", "started_at"),
        Index("uq_instagram_sync_runs_one_active", "connection_id", unique=True,
              postgresql_where=text("status IN ('queued', 'running', 'retrying')")),
        Index("ix_instagram_sync_runs_status_due", "status", "next_retry_at"),
        CheckConstraint("progress BETWEEN 0 AND 100", name="progress_range"),
        CheckConstraint("trigger IN ('connect', 'manual', 'scheduled')", name="trigger_values"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("instagram_connections.id", ondelete="CASCADE"))
    trigger: Mapped[str] = mapped_column(String(16))  # connect | manual | scheduled
    triggered_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Fixed observation timestamp for every snapshot this job writes (same value across retries).
    observation_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[IgSyncStatus] = mapped_column(str_enum(IgSyncStatus, "ig_sync_status"))
    progress: Mapped[int] = mapped_column(Integer, server_default="0")
    progress_stage: Mapped[str | None] = mapped_column(String(32))
    records_processed: Mapped[int] = mapped_column(Integer, server_default="0")
    media_fetched: Mapped[int] = mapped_column(Integer, server_default="0")
    media_insights_fetched: Mapped[int] = mapped_column(Integer, server_default="0")
    account_insights_fetched: Mapped[int] = mapped_column(Integer, server_default="0")
    comments_fetched: Mapped[int] = mapped_column(Integer, server_default="0")
    warnings: Mapped[list[Any]] = mapped_column()
    retry_count: Mapped[int] = mapped_column(Integer, server_default="0")
    max_retries: Mapped[int] = mapped_column(Integer, server_default="3")
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_requested: Mapped[bool] = mapped_column(Boolean, server_default="false")
    error_category: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    api_version: Mapped[str] = mapped_column(String(16))


class WorkerHeartbeat(Base):
    """Liveness of the background pipeline (global, not tenant data): written by the worker on start-up and
    by the beat-scheduled maintenance/scheduler tasks, read by ``/ready``."""

    __tablename__ = "worker_heartbeats"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    detail: Mapped[dict[str, Any]] = mapped_column()


class InstagramDataDeletionRequest(Base):
    """Meta data-deletion callback receipts (global: the request carries no workspace). Only a hash of the
    Instagram user ID is kept so the receipt itself holds no personal data."""

    __tablename__ = "instagram_data_deletion_requests"

    confirmation_code: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider_user_hash: Mapped[str] = mapped_column(String(64), index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    connections_affected: Mapped[int] = mapped_column(Integer, server_default="0")
