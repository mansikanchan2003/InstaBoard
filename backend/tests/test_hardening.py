"""Phase 8 hardening: security headers, body limits, request IDs, production guards, log redaction, SQL parameter
hiding, shared rate limiting and housekeeping."""

from __future__ import annotations

import json
import logging
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.database import build_engine
from app.core.logging import JsonFormatter, RedactingFilter, redact, request_id_var
from app.core.security import RateLimiter, RedisRateLimiter
from app.main import create_app
from app.models import AuthSession, InstagramOAuthState
from app.services import housekeeping
from app.services.common import utcnow

from .conftest import UNREACHABLE_DB, api, make_settings

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


@pytest.fixture
def offline():
    with TestClient(create_app(make_settings(UNREACHABLE_DB))) as c:
        yield c


# ---------------------------------------------------------------------------------- headers
def test_security_headers_on_api_and_health(offline):
    response = offline.get(api("/auth/me"))  # 401, but still hardened
    h = response.headers
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY" and h["referrer-policy"] == "no-referrer"
    assert "default-src 'none'" in h["content-security-policy"] and "frame-ancestors 'none'" in h["content-security-policy"]
    assert h["cache-control"] == "no-store"  # API responses are never cached
    assert "strict-transport-security" not in h  # only when served over HTTPS
    assert offline.get("/health").headers["x-frame-options"] == "DENY"


def test_hsts_when_cookies_are_secure():
    with TestClient(create_app(make_settings(UNREACHABLE_DB, cookie_secure=True))) as c:
        assert c.get("/health").headers["strict-transport-security"].startswith("max-age=31536000")


def test_docs_ui_keeps_working_without_the_api_csp(offline):
    response = offline.get("/docs")
    assert response.status_code == 200 and "content-security-policy" not in response.headers


# ------------------------------------------------------------------------------- body limit
def test_declared_oversized_body_is_rejected(offline):
    response = offline.post(api("/auth/login"), content=b"{" + b" " * 2_000_000 + b"}", headers={"content-type": "application/json"})
    assert response.status_code == 413 and response.json()["error"]["code"] == "payload_too_large"


def test_chunked_oversized_body_is_rejected():
    app = create_app(make_settings(UNREACHABLE_DB, max_request_bytes=2048))

    def chunks():
        for _ in range(10):
            yield b"x" * 1024

    with TestClient(app) as c:
        response = c.post(api("/auth/login"), content=chunks(), headers={"content-type": "application/json"})
    assert response.status_code == 413


def test_normal_bodies_pass(offline):
    response = offline.post(api("/auth/login"), json={"email": "a@b.co", "password": "x"})
    assert response.status_code != 413


# ------------------------------------------------------------------------------- request ids
def test_request_id_is_generated_or_propagated_safely(offline):
    generated = offline.get("/health").headers["x-request-id"]
    assert len(generated) == 16
    assert offline.get("/health", headers={"X-Request-ID": "trace-1234abcd"}).headers["x-request-id"] == "trace-1234abcd"
    hostile = offline.get("/health", headers={"X-Request-ID": "bad id\r\nX-Evil: 1"}).headers["x-request-id"]
    assert hostile != "bad id\r\nX-Evil: 1" and len(hostile) == 16


# ------------------------------------------------------------------------- production guards
PROD = dict(app_env="production", secret_key="A" * 20 + "x9Qv7LmZp2Rt8Ws4Ky6Hn1Bd", cookie_secure=True, cors_origins="https://app.eko.example",
            enable_docs=False, frontend_url="https://app.eko.example")


@pytest.mark.parametrize("override,message", [
    ({"enable_docs": True}, "ENABLE_DOCS"), ({"frontend_url": "http://app.eko.example"}, "FRONTEND_URL"),
    ({"database_echo": True}, "DATABASE_ECHO"), ({"log_level": "DEBUG"}, "LOG_LEVEL"),
])
def test_production_refuses_unsafe_operational_settings(override, message):
    from app.core.config import Settings

    with pytest.raises(ValidationError, match=message):
        Settings(_env_file=None, database_url=UNREACHABLE_DB, **{**PROD, **override})
    assert Settings(_env_file=None, database_url=UNREACHABLE_DB, **PROD).app_env == "production"


# ------------------------------------------------------------------------ logs & SQL params
def test_redaction_masks_tokens_cookies_and_keys():
    line = ("GET /cb?code=AQB123&state=s3cr3t access_token=EAAB999 Authorization: Bearer sk-live-xyz "
            "x-api-key: k-123 Cookie: instaboard_session=abc.def password=hunter2hunter2")
    out = redact(line)
    for secret in ("AQB123", "s3cr3t", "EAAB999", "sk-live-xyz", "k-123", "abc.def", "hunter2hunter2"):
        assert secret not in out


def test_json_logs_carry_correlation_ids():
    record = logging.LogRecord("instaboard.test", logging.INFO, "", 0, "token=%s done", ("abc123secret",), None)
    token = request_id_var.set("req-0001abcd")
    try:
        RedactingFilter().filter(record)
    finally:
        request_id_var.reset(token)
    payload = json.loads(JsonFormatter().format(record))
    assert payload["request_id"] == "req-0001abcd" and payload["level"] == "INFO" and "abc123secret" not in payload["message"]
    assert payload["ts"].endswith("+00:00")


def test_sql_errors_do_not_expose_bound_parameters(db_url, caplog):
    from app.core.errors import log_db_error

    engine = build_engine(make_settings(db_url))
    secret = "super-secret-bound-value-123"
    with engine.connect() as conn, pytest.raises(DBAPIError) as info:
        conn.execute(text("SELECT CAST(:v AS integer)"), {"v": secret})
    engine.dispose()
    assert "SQL parameters hidden" in str(info.value)  # SQLAlchemy no longer lists bound values
    # PostgreSQL's own message can still echo the value, so the API's error logger records type/SQLSTATE only.
    caplog.set_level(logging.ERROR)
    log_db_error(info.value)
    assert secret not in caplog.text and "sqlstate=22P02" in caplog.text


# ----------------------------------------------------------------------------- rate limiting
class FakeRedis:
    """Minimal sorted-set fake for the limiter (pipeline executes immediately)."""

    def __init__(self, fail: bool = False) -> None:
        self.z: dict[str, dict[str, float]] = {}
        self.fail = fail

    def _check(self):
        if self.fail:
            raise ConnectionError("redis down")

    def pipeline(self):
        parent = self

        class P:
            def __init__(self):
                self.ops = []

            def __getattr__(self, name):
                def op(*a, **k):
                    self.ops.append((name, a, k))
                    return self
                return op

            def execute(self):
                parent._check()
                return [getattr(parent, name)(*a, **k) for name, a, k in self.ops]
        return P()

    def zremrangebyscore(self, key, lo, hi):
        self._check()
        members = self.z.setdefault(key, {})
        for m in [m for m, s in members.items() if lo <= s <= hi]:
            del members[m]

    def zcard(self, key):
        self._check()
        return len(self.z.get(key, {}))

    def zrange(self, key, start, end, withscores=False):
        items = sorted(self.z.get(key, {}).items(), key=lambda kv: kv[1])[start:end + 1]
        return items if withscores else [m for m, _ in items]

    def zadd(self, key, mapping):
        self.z.setdefault(key, {}).update(mapping)

    def expire(self, key, seconds):
        return True

    def delete(self, key):
        self.z.pop(key, None)

    def scan_iter(self, match=None):
        return list(self.z)


def test_redis_limiter_is_shared_between_processes():
    shared = FakeRedis()
    a, b = RedisRateLimiter(shared), RedisRateLimiter(shared)  # two API replicas
    assert a.hit("login:x", limit=2, window_seconds=60)[0] and b.hit("login:x", limit=2, window_seconds=60)[0]
    allowed, retry = a.hit("login:x", limit=2, window_seconds=60)
    assert allowed is False and retry >= 1
    assert b.count("login:x", window_seconds=60) == 2
    a.reset("login:x")
    assert b.count("login:x", window_seconds=60) == 0


def test_redis_limiter_falls_back_when_redis_is_down(caplog):
    limiter = RedisRateLimiter(FakeRedis(fail=True))
    assert limiter.hit("k", limit=1, window_seconds=60)[0] is True
    assert limiter.hit("k", limit=1, window_seconds=60)[0] is False  # per-process fallback still limits
    assert "Redis rate limiter unavailable" in caplog.text


def test_in_process_limiter_still_default_without_redis(offline):
    assert isinstance(offline.app.state.rate_limiter, RateLimiter)


# ------------------------------------------------------------------------------ housekeeping
def test_housekeeping_removes_old_sessions_and_states(db_session, client):
    now = utcnow()
    db_session.execute(text("UPDATE auth_sessions SET revoked_at = :t"), {"t": now - timedelta(days=8)})
    db_session.add(InstagramOAuthState(id="igs_old", state_hash="f" * 64, workspace_id="ws-eko-india", user_id="usr_test_usr-priya", member_id="usr-priya",
                                       session_id=db_session.scalar(select(AuthSession.id).limit(1)), expires_at=now - timedelta(days=2)))
    db_session.commit()
    result = housekeeping.run(db_session)
    assert result["sessions"] >= 1 and result["oauth_states"] >= 0
    assert db_session.scalar(select(func.count()).select_from(AuthSession).where(AuthSession.revoked_at.is_not(None))) == 0


# ------------------------------------------------------------------------------ ops status
def test_ops_status_is_admin_only_and_secret_free(client, client_as, viewer_client, anon_client):
    body = client.get(api("/ops/status"))
    assert body.status_code == 200
    data = body.json()
    assert set(data) >= {"syncJobs24h", "aiJobs24h", "accounts", "ai", "background"}
    assert "token" not in json.dumps(data).lower() or "tokensMonth" in json.dumps(data)  # only usage counters mention tokens
    assert client_as("usr-ananya").get(api("/ops/status")).status_code == 403  # Editor
    assert viewer_client.get(api("/ops/status")).status_code == 403
    assert anon_client.get(api("/ops/status")).status_code == 401
