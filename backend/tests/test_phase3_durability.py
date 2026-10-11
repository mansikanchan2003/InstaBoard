"""Durability and transaction tests that use REAL commits (no outer test transaction).

Each test cleans up the rows it creates. They prove that a 2xx response means the change is
committed and visible to a completely separate connection, and that a failure part-way through a
multi-record operation leaves nothing behind.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import ActivityEvent, Campaign, Comment, Lead, Notification
from app.services import engagement

from .conftest import api, make_settings


@pytest.fixture
def committing_client(engine, db_url):
    """Signed in (real committed session) as the development Owner; every request commits for real."""
    from app.core.security import csrf_token_for
    from app.models import AuthSession, User
    from app.services.auth import _new_session

    app = create_app(make_settings(db_url))
    with Session(engine) as s, s.begin():
        token, session = _new_session(s, app.state.settings, s.get(User, "usr_test_usr-priya"), "ws-eko-india", user_agent="pytest", ip="testclient")
        session_id, digest = session.id, session.token_hash
    with TestClient(app, raise_server_exceptions=False) as client:
        client.cookies.set(app.state.settings.session_cookie_name, token)
        client.headers["X-CSRF-Token"] = csrf_token_for(app.state.settings.signing_key, digest)
        yield client
    app.state.engine.dispose()
    with Session(engine) as s, s.begin():
        s.execute(delete(AuthSession).where(AuthSession.id == session_id))


def _fresh(engine) -> Session:
    return Session(engine)


def test_created_campaign_is_visible_to_a_separate_connection(committing_client, engine):
    response = committing_client.post(api("/campaigns"), json={
        "name": "Durability check", "objective": "Engagement", "accountId": "acc-ekoindia", "status": "draft",
    })
    assert response.status_code == 201
    campaign_id = response.json()["id"]
    try:
        with _fresh(engine) as other:
            row = other.get(Campaign, campaign_id)
            assert row is not None and row.name == "Durability check" and row.is_demo is False
            assert other.scalar(select(func.count()).select_from(ActivityEvent).where(ActivityEvent.payload["campaign_id"].astext == campaign_id)) == 1
    finally:
        with _fresh(engine) as other, other.begin():
            other.execute(delete(ActivityEvent).where(ActivityEvent.payload["campaign_id"].astext == campaign_id))
            other.execute(delete(Campaign).where(Campaign.id == campaign_id))


def test_notification_read_state_persists_across_sessions(committing_client, engine):
    try:
        assert committing_client.patch(api("/notifications/ntf-token-ekomitracare"), json={"read": True}).status_code == 200
        with _fresh(engine) as other:
            assert other.get(Notification, "ntf-token-ekomitracare").read is True
        assert committing_client.get(api("/notifications/unread-count")).json() == 2
    finally:
        with _fresh(engine) as other, other.begin():
            other.execute(update(Notification).where(Notification.id == "ntf-token-ekomitracare").values(read=False))


def test_failed_conversion_rolls_back_every_write(committing_client, engine, monkeypatch):
    with _fresh(engine) as other:
        lead_handles = select(func.lower(Lead.handle))
        comment = other.scalar(select(Comment).where(
            Comment.lead_id.is_(None), Comment.campaign_id.is_not(None), func.lower(Comment.handle).not_in(lead_handles)).limit(1))
        comment_id, status_before = comment.id, comment.status
        leads_before = other.scalar(select(func.count()).select_from(Lead))

    def boom(*args, **kwargs):  # fail AFTER the lead insert and comment update, before commit
        raise RuntimeError("simulated failure while writing the audit entry")

    monkeypatch.setattr(engagement, "record_user_change", boom)
    response = committing_client.post(api(f"/comments/{comment_id}/convert-to-lead"))
    assert response.status_code == 500 and response.json()["error"]["code"] == "internal_error"
    assert "simulated" not in response.text  # internals are not leaked

    with _fresh(engine) as other:
        assert other.scalar(select(func.count()).select_from(Lead)) == leads_before
        refreshed = other.get(Comment, comment_id)
        assert refreshed.lead_id is None and refreshed.status == status_before
