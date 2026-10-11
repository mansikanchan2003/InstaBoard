"""Periodic cleanup run by the worker's maintenance task (every minute; cheap indexed deletes).

* auth sessions: expired (idle or absolute) or revoked more than ``SESSION_RETENTION`` ago — kept briefly so
  "signed out elsewhere" and audit lookups still resolve;
* Instagram OAuth states: consumed or expired for more than a day;
* AI analysis cache entries past their expiry.

Activity/audit events, sync and AI job history are *not* deleted here (they are the audit trail).
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from app.models import AIAnalysisCache, AuthSession, InstagramOAuthState
from app.services.common import utcnow

SESSION_RETENTION = timedelta(days=7)
STATE_RETENTION = timedelta(days=1)


def run(db: Session) -> dict[str, int]:
    now = utcnow()
    sessions = db.execute(delete(AuthSession).where(or_(
        AuthSession.absolute_expires_at < now - SESSION_RETENTION,
        AuthSession.idle_expires_at < now - SESSION_RETENTION,
        AuthSession.revoked_at < now - SESSION_RETENTION,
    ))).rowcount or 0
    states = db.execute(delete(InstagramOAuthState).where(or_(
        InstagramOAuthState.expires_at < now - STATE_RETENTION,
        InstagramOAuthState.consumed_at < now - STATE_RETENTION,
    ))).rowcount or 0
    cache = db.execute(delete(AIAnalysisCache).where(AIAnalysisCache.expires_at < now)).rowcount or 0
    db.commit()
    return {"sessions": sessions, "oauth_states": states, "analysis_cache": cache}
