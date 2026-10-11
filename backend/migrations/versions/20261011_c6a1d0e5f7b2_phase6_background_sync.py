"""phase6 background sync and historical analytics

Turns ``instagram_sync_runs`` into durable background jobs (queued / running / succeeded / partially_succeeded /
retrying / failed / cancelled) with claim leases, retries and progress; adds incremental-sync state to
connections and media; adds unit/source provenance to insight observations; adds ``worker_heartbeats``.

Existing rows are kept: success → succeeded, partial → partially_succeeded, and any stale ``running`` row
(Phase 5 synchronous sync interrupted) → failed. Nothing is backfilled with invented history.

Revision ID: c6a1d0e5f7b2
Revises: b15e91cdc0fb
Create Date: 2026-10-11 21:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c6a1d0e5f7b2"
down_revision: Union[str, None] = "b15e91cdc0fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_STATES = ("queued", "running", "succeeded", "partially_succeeded", "retrying", "failed", "cancelled")
OLD_STATES = ("running", "success", "partial", "failed")


def _in(values: tuple[str, ...]) -> str:
    return "status IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    # --- connections: incremental sync state
    op.add_column("instagram_connections", sa.Column("media_backfill_cursor", sa.Text(), nullable=True))
    op.add_column("instagram_connections", sa.Column("media_full_pass_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("instagram_connections", sa.Column("media_backfill_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("instagram_connections", sa.Column("unsupported_account_metrics", postgresql.JSONB(astext_type=sa.Text()),
                                                     server_default=sa.text("'[]'::jsonb"), nullable=False))
    # --- media: insight refresh bookkeeping
    op.add_column("instagram_media", sa.Column("insights_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("instagram_media", sa.Column("unsupported_metrics", postgresql.JSONB(astext_type=sa.Text()),
                                               server_default=sa.text("'[]'::jsonb"), nullable=False))
    op.execute("UPDATE instagram_media m SET insights_checked_at = (SELECT max(captured_at) FROM instagram_media_insights i WHERE i.media_id = m.id)")
    # --- observation provenance
    for table in ("instagram_media_insights", "instagram_account_insights"):
        op.add_column(table, sa.Column("unit", sa.String(length=16), server_default="count", nullable=False))
        op.add_column(table, sa.Column("source", sa.String(length=32), server_default="instagram_api", nullable=False))

    # --- sync runs → durable jobs
    op.drop_constraint("ig_sync_status", "instagram_sync_runs", type_="check")
    op.alter_column("instagram_sync_runs", "status", type_=sa.String(length=27), existing_type=sa.String(length=15))
    op.execute("UPDATE instagram_sync_runs SET status = 'succeeded' WHERE status = 'success'")
    op.execute("UPDATE instagram_sync_runs SET status = 'partially_succeeded' WHERE status = 'partial'")
    op.execute("UPDATE instagram_sync_runs SET status = 'failed', finished_at = coalesce(finished_at, now()), "
               "error_message = coalesce(error_message, 'Interrupted before background jobs existed.') WHERE status = 'running'")
    op.create_check_constraint("ig_sync_status", "instagram_sync_runs", _in(NEW_STATES))
    op.alter_column("instagram_sync_runs", "error_code", new_column_name="error_category")
    op.alter_column("instagram_sync_runs", "started_at", nullable=True, existing_type=sa.DateTime(timezone=True))
    op.add_column("instagram_sync_runs", sa.Column("queued_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.add_column("instagram_sync_runs", sa.Column("observation_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.execute("UPDATE instagram_sync_runs SET queued_at = started_at, observation_at = started_at WHERE started_at IS NOT NULL")
    for name, column in (
        ("progress", sa.Column("progress", sa.Integer(), server_default="0", nullable=False)),
        ("progress_stage", sa.Column("progress_stage", sa.String(length=32), nullable=True)),
        ("records_processed", sa.Column("records_processed", sa.Integer(), server_default="0", nullable=False)),
        ("retry_count", sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False)),
        ("max_retries", sa.Column("max_retries", sa.Integer(), server_default="3", nullable=False)),
        ("next_retry_at", sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True)),
        ("lease_expires_at", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True)),
        ("heartbeat_at", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True)),
        ("cancel_requested", sa.Column("cancel_requested", sa.Boolean(), server_default="false", nullable=False)),
    ):
        op.add_column("instagram_sync_runs", column)
    op.execute("UPDATE instagram_sync_runs SET progress = 100, records_processed = media_fetched + media_insights_fetched "
               "+ account_insights_fetched + comments_fetched WHERE status <> 'failed'")
    op.create_check_constraint("progress_range", "instagram_sync_runs", "progress BETWEEN 0 AND 100")
    op.create_check_constraint("trigger_values", "instagram_sync_runs", "trigger IN ('connect', 'manual', 'scheduled')")
    op.create_index("uq_instagram_sync_runs_one_active", "instagram_sync_runs", ["connection_id"], unique=True,
                    postgresql_where=sa.text("status IN ('queued', 'running', 'retrying')"))
    op.create_index("ix_instagram_sync_runs_status_due", "instagram_sync_runs", ["status", "next_retry_at"])

    op.create_table(
        "worker_heartbeats",
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_worker_heartbeats")),
    )


def downgrade() -> None:
    op.drop_table("worker_heartbeats")
    op.drop_index("ix_instagram_sync_runs_status_due", table_name="instagram_sync_runs")
    op.drop_index("uq_instagram_sync_runs_one_active", table_name="instagram_sync_runs")
    op.drop_constraint("trigger_values", "instagram_sync_runs", type_="check")
    op.drop_constraint("progress_range", "instagram_sync_runs", type_="check")
    for name in ("cancel_requested", "heartbeat_at", "lease_expires_at", "next_retry_at", "max_retries", "retry_count",
                 "records_processed", "progress_stage", "progress", "observation_at", "queued_at"):
        op.drop_column("instagram_sync_runs", name)
    op.execute("DELETE FROM instagram_sync_runs WHERE started_at IS NULL")
    op.alter_column("instagram_sync_runs", "started_at", nullable=False, existing_type=sa.DateTime(timezone=True))
    op.alter_column("instagram_sync_runs", "error_category", new_column_name="error_code")
    op.drop_constraint("ig_sync_status", "instagram_sync_runs", type_="check")
    op.execute("UPDATE instagram_sync_runs SET status = 'success' WHERE status = 'succeeded'")
    op.execute("UPDATE instagram_sync_runs SET status = 'partial' WHERE status = 'partially_succeeded'")
    op.execute("UPDATE instagram_sync_runs SET status = 'failed' WHERE status IN ('queued', 'retrying', 'cancelled')")
    op.alter_column("instagram_sync_runs", "status", type_=sa.String(length=15), existing_type=sa.String(length=27))
    op.create_check_constraint("ig_sync_status", "instagram_sync_runs", _in(OLD_STATES))
    for table in ("instagram_account_insights", "instagram_media_insights"):
        op.drop_column(table, "source")
        op.drop_column(table, "unit")
    op.drop_column("instagram_media", "unsupported_metrics")
    op.drop_column("instagram_media", "insights_checked_at")
    for name in ("unsupported_account_metrics", "media_backfill_completed_at", "media_full_pass_started_at", "media_backfill_cursor"):
        op.drop_column("instagram_connections", name)
