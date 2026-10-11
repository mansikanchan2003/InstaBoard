"""Activity-log (audit trail) recording for changes made through the API.

Every user-triggered write records one ``activity_events`` row in the same transaction as the
change itself, so the audit entry and the change are committed — or rolled back — together.
"""

from __future__ import annotations

import secrets
from typing import Any

from sqlalchemy.orm import Session

from app.models import ActivityEvent

from .common import session_member, utcnow

ORIGIN = "InstaBoard API (local development)"


def record_activity(db: Session, **fields: Any) -> ActivityEvent:
    """Low-level: add an audit row with explicit fields (see ``ActivityEvent``)."""
    event = ActivityEvent(
        id=f"EVT_API_{secrets.token_hex(5).upper()}", occurred_at=utcnow(), response_status="200 OK",
        origin=ORIGIN, outcome="success", **fields,
    )
    db.add(event)
    return event


def record_user_change(
    db: Session,
    *,
    category: str,
    kind: str,
    icon: str,
    title: str,
    summary: str,
    target_label: str,
    target_to: str,
    module: str,
    payload: dict[str, Any],
    diff: list[dict[str, str]] | None = None,
    account_id: str | None = None,
    narrative_suffix: str = "Stored in the InstaBoard database only — nothing was sent to Instagram.",
) -> ActivityEvent:
    """Audit entry for a change made by the (demo) session user."""
    actor = session_member(db)
    return record_activity(
        db, category=category, kind=kind, kind_icon=icon, kind_tone="neutral", kind_icon_class="text-text-secondary",
        title=title, summary=summary, narrative=f"{actor.name}: {summary} {narrative_suffix}",
        target={"label": target_label, "to": target_to, "module": module}, actor_id=actor.id, account_id=account_id,
        payload=payload, diff=diff or None,
    )


def diff_rows(before: dict[str, Any], after: dict[str, Any], labels: dict[str, str]) -> list[dict[str, str]]:
    """Field-level before/after rows for the fields that changed."""

    def text(value: Any) -> str:
        if value is None or value == "":
            return "—"
        if isinstance(value, list):
            return ", ".join(map(str, value)) or "—"
        return str(getattr(value, "value", value))

    return [
        {"field": labels.get(key, key), "before": text(before.get(key)), "after": text(after[key])}
        for key in after
        if text(before.get(key)) != text(after[key])
    ]
