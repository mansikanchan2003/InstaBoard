"""Authentication & sessions: login, enumeration safety, rate limits, cookies, CSRF, expiry,
revocation, password change and invitation onboarding."""

from __future__ import annotations

from datetime import timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import select, text, update

from app.models import AuthSession, User
from app.services.common import utcnow

from .conftest import TEST_PASSWORD, UNREACHABLE_DB, api, make_settings

PRIYA = "priya.sharma@eko.example"


def login(client, email=PRIYA, password=TEST_PASSWORD, **headers):
    return client.post(api("/auth/login"), json={"email": email, "password": password}, headers=headers)


def adopt(client, response):
    """Use the CSRF token returned by login for later unsafe requests."""
    client.headers["X-CSRF-Token"] = response.json()["csrfToken"]
    return client


# ------------------------------------------------------------------------------------------ login
def test_login_sets_a_hardened_session_cookie(anon_client):
    response = login(anon_client)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["email"] == PRIYA and body["role"] == "Owner" and body["workspace"]["id"] == "ws-eko-india"
    assert "write" in body["permissions"] and "admins:manage" in body["permissions"] and len(body["csrfToken"]) == 64
    cookie = response.headers["set-cookie"].lower()
    assert "instaboard_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
    assert "secure" not in cookie  # COOKIE_SECURE=false in development; enforced true in production (see config tests)


def test_passwords_are_never_returned_or_stored_in_plaintext(anon_client, db_session):
    response = login(anon_client)
    assert TEST_PASSWORD not in response.text and "argon2" not in response.text and "password" not in response.json()["user"]
    user = db_session.scalar(select(User).where(User.email == PRIYA))
    assert user.password_hash.startswith("$argon2id$") and TEST_PASSWORD not in user.password_hash
    me = adopt(anon_client, response).get(api("/auth/me")).text
    assert "argon2" not in me and TEST_PASSWORD not in me


def test_invalid_credentials_do_not_reveal_which_part_was_wrong(anon_client):
    wrong_password = login(anon_client, password="not-the-password")
    unknown_email = login(anon_client, email="nobody@eko.example")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json() == {"error": {"code": "not_authenticated", "message": "Invalid email or password.", "details": None}}
    cookie = wrong_password.headers.get("set-cookie", "").lower()
    assert "instaboard_session=" not in cookie or "max-age=0" in cookie  # no session is issued (only a cookie deletion)


def test_repeated_failures_are_rate_limited(anon_client):
    for _ in range(5):
        assert login(anon_client, password="wrong-password-123").status_code == 401
    limited = login(anon_client)  # even the right password is refused while limited
    assert limited.status_code == 429 and limited.json()["error"]["code"] == "rate_limited"
    assert int(limited.headers["retry-after"]) > 0


def test_login_rejects_foreign_origins_and_extra_fields(anon_client):
    assert login(anon_client, Origin="https://evil.example").status_code == 403
    assert login(anon_client, Origin="http://localhost:5173").status_code == 200
    extra = anon_client.post(api("/auth/login"), json={"email": PRIYA, "password": TEST_PASSWORD, "role": "Owner"})
    assert extra.status_code == 422


# -------------------------------------------------------------------------------- session checks
def test_protected_endpoints_reject_anonymous_requests(anon_client):
    for path in ["/auth/me", "/campaigns", "/settings", "/activity", "/workspace/members"]:
        response = anon_client.get(api(path))
        assert response.status_code == 401, path
        assert response.json()["error"]["code"] == "not_authenticated"


def test_unknown_session_token_is_rejected(anon_client):
    anon_client.cookies.set("instaboard_session", "forged-token-value")
    response = anon_client.get(api("/campaigns"))
    assert response.status_code == 401 and response.json()["error"]["code"] == "session_expired"


def test_csrf_token_is_required_for_state_changes(client):
    token = client.headers.pop("X-CSRF-Token")
    assert client.get(api("/campaigns")).status_code == 200  # reads need no CSRF token
    missing = client.patch(api("/leads/lead-sunita-devi"), json={"status": "lost"})
    assert missing.status_code == 403 and missing.json()["error"]["code"] == "csrf_failed"
    wrong = client.patch(api("/leads/lead-sunita-devi"), json={"status": "lost"}, headers={"X-CSRF-Token": "0" * 64})
    assert wrong.status_code == 403
    ok = client.patch(api("/leads/lead-sunita-devi"), json={"status": "lost"}, headers={"X-CSRF-Token": token})
    assert ok.status_code == 200


def test_state_changes_from_foreign_origins_are_refused(client):
    response = client.patch(api("/leads/lead-sunita-devi"), json={"status": "lost"}, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def _current_session(db_session, client) -> AuthSession:
    sessions = db_session.scalars(select(AuthSession).where(AuthSession.user_agent == "pytest").order_by(AuthSession.created_at.desc()))
    return next(iter(sessions))


def test_idle_and_absolute_expiry(client, db_session):
    session = _current_session(db_session, client)
    db_session.execute(update(AuthSession).where(AuthSession.id == session.id).values(idle_expires_at=utcnow() - timedelta(seconds=1)))
    db_session.commit()
    expired = client.get(api("/campaigns"))
    assert expired.status_code == 401 and expired.json()["error"]["code"] == "session_expired"
    assert "instaboard_session=" in expired.headers.get("set-cookie", "")  # dead cookie is cleared


def test_absolute_expiry_cannot_be_extended(client, db_session):
    session = _current_session(db_session, client)
    db_session.execute(update(AuthSession).where(AuthSession.id == session.id).values(absolute_expires_at=utcnow() - timedelta(seconds=1)))
    db_session.commit()
    assert client.get(api("/campaigns")).status_code == 401


def test_activity_renews_the_idle_timeout(client, db_session):
    session = _current_session(db_session, client)
    stale = utcnow() - timedelta(minutes=5)
    db_session.execute(update(AuthSession).where(AuthSession.id == session.id).values(last_seen_at=stale, idle_expires_at=utcnow() + timedelta(minutes=1)))
    db_session.commit()
    assert client.get(api("/campaigns")).status_code == 200
    db_session.expire_all()
    renewed = db_session.get(AuthSession, session.id)
    assert renewed.idle_expires_at > utcnow() + timedelta(minutes=100) and renewed.idle_expires_at <= renewed.absolute_expires_at


def test_logout_revokes_the_session(client):
    assert client.post(api("/auth/logout")).status_code == 204
    after = client.get(api("/campaigns"))
    assert after.status_code == 401 and after.json()["error"]["code"] == "session_expired"


# --------------------------------------------------------------------------------- password change
def test_password_change_rules_and_revocation(client_as, anon_client):
    first = client_as("usr-ananya")
    second = client_as("usr-ananya")  # another browser
    assert first.post(api("/auth/password"), json={"currentPassword": "wrong", "newPassword": "x" * 20}).status_code == 422
    weak = first.post(api("/auth/password"), json={"currentPassword": TEST_PASSWORD, "newPassword": "short"})
    assert weak.status_code == 422 and weak.json()["error"]["details"]["field"] == "newPassword"
    changed = first.post(api("/auth/password"), json={"currentPassword": TEST_PASSWORD, "newPassword": "a-much-better-passphrase-91"})
    assert changed.status_code == 200 and changed.json()["revokedSessions"] >= 1
    assert first.get(api("/auth/me")).status_code == 200  # this session stays signed in
    assert second.get(api("/auth/me")).status_code == 401  # the other one is signed out
    assert login(anon_client, email="ananya.iyer@eko.example").status_code == 401
    assert login(anon_client, email="ananya.iyer@eko.example", password="a-much-better-passphrase-91").status_code == 200


def test_sessions_can_be_listed_and_revoked(client_as):
    a = client_as("usr-rahul")
    b = client_as("usr-rahul")
    sessions = a.get(api("/auth/sessions")).json()
    assert len(sessions) >= 2 and sum(1 for x in sessions if x["current"]) == 1
    assert a.post(api("/auth/sessions/revoke-others")).json()["revoked"] >= 1
    assert b.get(api("/auth/me")).status_code == 401
    assert a.delete(api("/auth/sessions/ses_doesnotexist")).status_code == 404


def test_removing_a_member_signs_them_out(client, client_as):
    editor = client_as("usr-ananya")
    assert editor.get(api("/campaigns")).status_code == 200
    assert client.delete(api("/workspace/members/usr-ananya")).status_code == 200
    assert editor.get(api("/campaigns")).status_code == 401


def test_security_events_are_audited_without_secrets(anon_client, client):
    adopt(anon_client, login(anon_client))
    events = client.get(api("/activity"), params={"category": "security", "limit": 5}).json()
    signed_in = next(e for e in events if e["title"] == "Signed In")
    assert TEST_PASSWORD not in str(signed_in) and "token" not in str(signed_in["payload"]).lower().replace("session_id", "")


# ------------------------------------------------------------------------------------- invitations
def _invite(client, email="new.analyst@eko.example", access="Viewer"):
    response = client.post(api("/workspace/members"), json={"email": email, "access": access})
    assert response.status_code == 201, response.text
    url = response.json()["inviteUrl"]
    assert "/accept-invite#token=" in url  # fragment: never sent to (or logged by) any server
    return url.split("#token=")[1]


def test_invitation_onboarding(client, anon_client, db_session):
    token = _invite(client)
    preview = anon_client.post(api("/auth/invitations/preview"), json={"token": token})
    assert preview.status_code == 200 and preview.json()["role"] == "Viewer" and preview.json()["accountExists"] is False
    weak = anon_client.post(api("/auth/invitations/accept"), json={"token": token, "name": "Neha", "password": "short"})
    assert weak.status_code == 422
    accepted = anon_client.post(api("/auth/invitations/accept"), json={"token": token, "name": "Neha Analyst", "password": "analyst-passphrase-2024"})
    assert accepted.status_code == 200 and accepted.json()["role"] == "Viewer" and "httponly" in accepted.headers["set-cookie"].lower()
    reused = anon_client.post(api("/auth/invitations/accept"), json={"token": token, "password": "analyst-passphrase-2024"})
    assert reused.status_code == 404  # one-time
    stored = db_session.execute(text("SELECT token_hash FROM invitations")).scalars().all()
    assert token not in stored  # only the hash is stored


def test_expired_or_unknown_invitations_look_the_same(client, anon_client, db_session):
    token = _invite(client, email="late@eko.example")
    db_session.execute(text("UPDATE invitations SET expires_at = now() - interval '1 minute'"))
    db_session.commit()
    expired = anon_client.post(api("/auth/invitations/preview"), json={"token": token})
    unknown = anon_client.post(api("/auth/invitations/preview"), json={"token": "x" * 43})
    assert expired.status_code == unknown.status_code == 404
    assert expired.json()["error"]["message"] == unknown.json()["error"]["message"]


# ---------------------------------------------------------------------------------- configuration
def test_production_refuses_missing_or_weak_secrets():
    base = dict(database_url=UNREACHABLE_DB, cors_origins="https://app.eko.example", cookie_secure=True, enable_docs=False,
                frontend_url="https://app.eko.example")  # Phase 8: docs off + https frontend are also required
    with pytest.raises(ValidationError, match="SECRET_KEY must be set"):
        _prod(**base)
    with pytest.raises(ValidationError, match="placeholder"):
        _prod(**base, secret_key="change-me-change-me-change-me-change-me")
    with pytest.raises(ValidationError, match="COOKIE_SECURE"):
        _prod(**{**base, "cookie_secure": False}, secret_key="A" * 20 + "x9Qv7LmZp2Rt8Ws4Ky6Hn1Bd")
    with pytest.raises(ValidationError, match="localhost"):
        _prod(**{**base, "cors_origins": "http://localhost:5173"}, secret_key="A" * 20 + "x9Qv7LmZp2Rt8Ws4Ky6Hn1Bd")
    ok = _prod(**base, secret_key="A" * 20 + "x9Qv7LmZp2Rt8Ws4Ky6Hn1Bd")
    assert ok.cookie_secure is True


def test_blank_secret_key_means_unset_not_an_empty_key():
    from app.core.config import Settings

    dev = Settings(_env_file=None, app_env="development", database_url=UNREACHABLE_DB, secret_key="  ", cookie_domain="")
    assert dev.secret_key is None and dev.cookie_domain is None
    assert len(dev.signing_key) >= 32  # ephemeral random key, never b""
    with pytest.raises(ValidationError, match="SECRET_KEY must be set"):
        _prod(database_url=UNREACHABLE_DB, cors_origins="https://app.eko.example", cookie_secure=True, secret_key="")


def _prod(**kwargs):
    from app.core.config import Settings

    return Settings(_env_file=None, app_env="production", **kwargs)  # type: ignore[call-arg]


def test_development_uses_an_ephemeral_key_when_unset():
    settings = make_settings(UNREACHABLE_DB)
    assert len(settings.signing_key) >= 32 and settings.signing_key == settings.signing_key
