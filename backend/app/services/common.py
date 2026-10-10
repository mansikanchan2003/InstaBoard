"""Shared helpers for the service layer (formatting that must match the frontend demo data)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import InstagramAccount, ReferenceDocument, TeamMember, Workspace

IST = timezone(timedelta(hours=5, minutes=30))
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def day_label(value: date) -> str:
    """date(2024, 10, 1) → 'Oct 1' (trend-point labels)."""
    return f"{MONTHS[value.month - 1]} {value.day}"


def iso_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def iso_ist(value: datetime) -> str:
    """'2024-10-31T14:22:00+05:30' (comments, sync logs)."""
    return value.astimezone(IST).isoformat(timespec="seconds")


def ist_wallclock(value: datetime) -> str:
    """'2024-10-31T10:30:00' — IST wall-clock without offset (activity log, reports)."""
    return value.astimezone(IST).replace(tzinfo=None).isoformat(timespec="seconds")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def current_workspace(db: Session) -> Workspace:
    """The workspace of the (demo) session user.

    There is no authentication yet: a single seeded "session user" stands in for the signed-in
    operator. When auth is added, resolve the workspace from the authenticated principal instead.
    """
    workspace = db.scalar(select(Workspace).join(TeamMember).where(TeamMember.is_session_user.is_(True)).limit(1))
    if workspace is None:
        raise NotFoundError("Workspace", "current")
    return workspace


def session_member(db: Session) -> TeamMember:
    member = db.scalar(select(TeamMember).where(TeamMember.is_session_user.is_(True)).limit(1))
    if member is None:
        raise NotFoundError("Team member", "session user")
    return member


def get_account(db: Session, account_id: str) -> InstagramAccount:
    account = db.get(InstagramAccount, account_id)
    if account is None:
        raise NotFoundError("Instagram account", account_id)
    return account


def reference(db: Session, key: str):
    doc = db.get(ReferenceDocument, key)
    if doc is None:
        raise NotFoundError("Reference document", key)
    return doc.document


def next_position_first(db: Session, column) -> int:
    """Position that sorts a new row before all existing ones (the UI lists newest first)."""
    return (db.scalar(select(func.min(column))) or 0) - 1
