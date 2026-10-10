"""Seed idempotency and migration checks."""

from __future__ import annotations

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import func, inspect, select

from app.models import Base, Campaign, Lead
from app.seed.loader import load_demo_data, seed_demo_data

from .conftest import alembic_config, migrate_and_seed


def _counts(session) -> dict[str, int]:
    return {t.name: session.scalar(select(func.count()).select_from(t)) for t in Base.metadata.sorted_tables}


def test_seed_is_idempotent(db_session):
    before = _counts(db_session)
    report = seed_demo_data(db_session)
    assert report.total_inserted == 0
    assert _counts(db_session) == before


def test_seed_keeps_api_changes_unless_reset(db_session):
    lead = db_session.get(Lead, "lead-ramesh-maurya")
    lead.status = "converted"
    db_session.flush()
    seed_demo_data(db_session)
    db_session.refresh(lead)
    assert lead.status.value == "converted"  # default mode leaves existing rows alone

    before = _counts(db_session)
    seed_demo_data(db_session, reset=True)
    db_session.refresh(lead)
    assert lead.status.value == "new"  # reset restores the demo value
    assert _counts(db_session) == before  # …without duplicating anything


def test_seed_preserves_frontend_ids_and_relationships(db_session):
    data = load_demo_data()
    assert set(db_session.scalars(select(Campaign.id))) == {c["id"] for c in data["campaigns"]}
    lead = db_session.get(Lead, "lead-deepak-tiwari")
    assert lead.campaign_id == "sbi-csp-october" and lead.content_id == "sbi-csp-mitra-reel"


def test_models_and_migrations_are_in_sync(connection):
    context = MigrationContext.configure(connection, opts={"compare_type": True})
    assert compare_metadata(context, Base.metadata) == []


def test_migrations_downgrade_and_upgrade_cleanly(engine, db_url):
    """Runs last-in-file: rebuilds the schema from scratch and re-seeds for any later tests."""
    cfg = alembic_config(db_url)
    command.downgrade(cfg, "base")
    tables = set(inspect(engine).get_table_names())
    assert tables <= {"alembic_version"}
    command.upgrade(cfg, "head")
    assert {t.name for t in Base.metadata.sorted_tables} <= set(inspect(engine).get_table_names())
    migrate_and_seed(engine, db_url)
