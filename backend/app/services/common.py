"""Shared helpers for the service layer (formatting that must match the frontend demo data)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import InstagramAccount, ReferenceDocument, TeamMember, Workspace, WorkspaceDocument

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


AUTH_KEY = "auth"


def auth_context(db: Session):
    """The authenticated request context bound by ``app.api.deps.require_auth``."""
    ctx = db.info.get(AUTH_KEY)
    if ctx is None:  # a service was called outside an authenticated request — fail closed
        raise RuntimeError("No authenticated workspace context on this database session")
    return ctx


def current_workspace(db: Session) -> Workspace:
    """The workspace of the authenticated session (validated against membership on every request)."""
    workspace = db.get(Workspace, auth_context(db).workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace", "current")
    return workspace


def session_member(db: Session) -> TeamMember:
    """The authenticated user's membership in the active workspace."""
    member = db.get(TeamMember, auth_context(db).member_id)
    if member is None:
        raise NotFoundError("Team member", "current")
    return member


def get_account(db: Session, account_id: str) -> InstagramAccount:
    account = db.get(InstagramAccount, account_id)
    if account is None:
        raise NotFoundError("Instagram account", account_id)
    return account


def reference(db: Session, key: str):
    """Global (non-tenant) reference content."""
    doc = db.get(ReferenceDocument, key)
    if doc is None:
        raise NotFoundError("Reference document", key)
    return doc.document


def workspace_doc(db: Session, key: str):
    """Document belonging to the active workspace (tenant-filtered)."""
    doc = db.scalar(select(WorkspaceDocument).where(WorkspaceDocument.key == key))
    if doc is None:
        raise NotFoundError("Workspace document", key)
    return doc.document


def next_position_first(db: Session, column) -> int:
    """Position that sorts a new row before all existing ones (the UI lists newest first)."""
    return (db.scalar(select(func.min(column))) or 0) - 1
