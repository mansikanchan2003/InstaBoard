"""Phase 5 — Instagram API with Instagram Login, against a *mocked* Meta (httpx.MockTransport).

No real Meta credentials, network access or Instagram account are used: every provider response below is
fabricated test data shaped like the documented API responses.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.main import create_app
from app.models import (
    InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramMedia, InstagramMediaInsight, InstagramOAuthState,
    InstagramSyncRun, InstagramToken,
)
from app.services.common import utcnow
from app.services.instagram.crypto import TokenCipher, TokenDecryptError

from .conftest import DEV_WORKSPACE, UNREACHABLE_DB, api, make_settings, sign_in

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

APP_SECRET = "test-instagram-app-secret-0001"
SHORT = "SHORT-LIVED-TEST-TOKEN-aaaa"
LONG = "LONG-LIVED-TEST-TOKEN-bbbb"
REFRESHED = "REFRESHED-TEST-TOKEN-cccc"
IG_ID = "17841400000000001"
SCOPED_ID = "9001"
FERNET_KEY = Fernet.generate_key().decode()
ALL_SCOPES = "instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_comments"


def ig_settings(db_url: str, **overrides):
    values = dict(
        instagram_app_id="1234567890", instagram_app_secret=APP_SECRET,
        instagram_redirect_uri="http://localhost:8100/api/v1/integrations/instagram/callback",
        instagram_graph_api_version="v26.0", instagram_token_encryption_key=FERNET_KEY,
        instagram_oauth_scopes=ALL_SCOPES, instagram_retry_backoff_seconds=0, instagram_sync_cooldown_seconds=0,
    )
    values.update(overrides)
    return make_settings(db_url, **values)


class FakeMeta:
    """Routes requests to canned, documented-shape responses; ``fail`` queues errors per path suffix."""

    def __init__(self) -> None:
        self.calls: list[httpx.Request] = []
        self.fail: dict[str, list] = {}
        self.permissions = ALL_SCOPES
        self.profile = {"id": SCOPED_ID, "user_id": IG_ID, "username": "eko_live_test", "name": "Eko Live (test)",
                        "account_type": "BUSINESS", "followers_count": 1200, "follows_count": 10, "media_count": 3}
        self.media = [
            {"id": "m1", "media_type": "VIDEO", "permalink": "https://instagram.com/p/m1", "timestamp": "2026-10-05T10:00:00+0000",
             "like_count": 40, "comments_count": 2, "thumbnail_url": "https://cdn.example/m1.jpg", "caption": "Reel one"},
            {"id": "m2", "media_type": "IMAGE", "permalink": "https://instagram.com/p/m2", "timestamp": "2026-10-03T10:00:00+0000",
             "like_count": 12, "comments_count": 0},
            {"id": "m3", "media_type": "CAROUSEL_ALBUM", "permalink": "https://instagram.com/p/m3", "timestamp": "2026-10-01T10:00:00+0000"},
        ]
        self.transport = httpx.MockTransport(self.handle)

    def count(self, suffix: str) -> int:
        return sum(1 for r in self.calls if r.url.path.endswith(suffix))

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        path = request.url.path
        for suffix, queue in self.fail.items():
            if path.endswith(suffix) and queue:
                item = queue.pop(0)
                if isinstance(item, Exception):
                    raise item
                return item
        params = dict(request.url.params)
        if request.url.host == "api.instagram.com" and path == "/oauth/access_token":
            form = parse_qs(request.content.decode())
            assert form["client_secret"] == [APP_SECRET] and form["grant_type"] == ["authorization_code"]
            if form["code"] != ["good-code"]:
                return httpx.Response(400, json={"error_type": "OAuthException", "code": 400, "error_message": "Matching code was not found"})
            return httpx.Response(200, json={"access_token": SHORT, "user_id": SCOPED_ID, "permissions": self.permissions})
        if path == "/access_token":
            assert params["grant_type"] == "ig_exchange_token" and params["access_token"] == SHORT
            return httpx.Response(200, json={"access_token": LONG, "token_type": "bearer", "expires_in": 5_184_000})
        if path == "/refresh_access_token":
            return httpx.Response(200, json={"access_token": REFRESHED, "token_type": "bearer", "expires_in": 5_184_000})
        assert path.startswith("/v26.0/"), path
        token = params.get("access_token")
        if token not in (LONG, REFRESHED):
            return httpx.Response(400, json={"error": {"message": "Invalid OAuth access token", "type": "OAuthException", "code": 190}})
        if path == "/v26.0/me":
            return httpx.Response(200, json=self.profile)
        if path == f"/v26.0/{IG_ID}/media":
            if params.get("after") == "c1":
                return httpx.Response(200, json={"data": self.media[2:], "paging": {"cursors": {"before": "c1b"}}})
            return httpx.Response(200, json={"data": self.media[:2], "paging": {"cursors": {"after": "c1"}, "next": "https://graph.instagram.com/next"}})
        if path == f"/v26.0/{IG_ID}/insights":
            if params["metric_type"] == "time_series":
                return httpx.Response(200, json={"data": [{"name": "reach", "period": "day", "values": [
                    {"value": 30, "end_time": "2026-10-09T07:00:00+0000"}, {"value": 45, "end_time": "2026-10-10T07:00:00+0000"}]}]})
            data = [{"name": m, "period": "day", "total_value": {"value": v}} for m, v in (("reach", 900), ("views", 2500), ("likes", 52))
                    if m in params["metric"].split(",")]
            return httpx.Response(200, json={"data": data})  # other metrics: empty → unavailable
        if path.endswith("/insights"):
            media_id = path.split("/")[2]
            values = {"m1": {"views": 800, "reach": 500, "likes": 40, "comments": 2, "shares": 3, "saved": 4, "total_interactions": 49},
                      "m2": {"views": 90, "reach": 70}, "m3": {"reach": 20}}[media_id]
            requested = params["metric"].split(",")
            return httpx.Response(200, json={"data": [{"name": k, "period": "lifetime", "values": [{"value": v}]}
                                                       for k, v in values.items() if k in requested]})
        if path.endswith("/comments"):
            if path.split("/")[2] != "m1":
                return httpx.Response(200, json={"data": []})
            return httpx.Response(200, json={"data": [
                {"id": "c1", "text": "Great!", "timestamp": "2026-10-05T11:00:00+0000", "username": "fan_one", "like_count": 1,
                 "replies": {"data": [{"id": "c1r", "text": "Thanks", "timestamp": "2026-10-05T12:00:00+0000", "username": "eko_live_test",
                                       "parent_id": "c1"}]}},
                {"id": "c2", "text": "How to apply?", "timestamp": "2026-10-05T11:30:00+0000", "username": "fan_two"},
            ]})
        return httpx.Response(404, json={"error": {"message": "Unknown path", "code": 100, "error_subcode": 33}})


@pytest.fixture
def meta() -> FakeMeta:
    return FakeMeta()


@pytest.fixture
def ig_app(connection, db_url, meta):
    def _make(**overrides):
        app = create_app(ig_settings(db_url, **overrides))
        app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
        app.state.instagram_transport = meta.transport
        app.state.instagram_sleep = lambda _seconds: None
        return app
    return _make


@pytest.fixture
def ig_client_as(ig_app, connection):
    opened: list[TestClient] = []

    def _make(member_id: str = "usr-priya", app=None, **overrides) -> TestClient:
        app = app or ig_app(**overrides)
        client = TestClient(app, follow_redirects=False)
        client.__enter__()
        opened.append(client)
        return sign_in(app, client, connection, user_id=f"usr_test_{member_id}")

    yield _make
    for c in opened:
        c.__exit__(None, None, None)


@pytest.fixture
def owner(ig_client_as) -> TestClient:
    return ig_client_as("usr-priya")


def start(client: TestClient) -> str:
    response = client.post(api("/integrations/instagram/connect"))
    assert response.status_code == 200, response.text
    url = urlparse(response.json()["authorizationUrl"])
    assert (url.scheme, url.netloc, url.path) == ("https", "www.instagram.com", "/oauth/authorize")
    return parse_qs(url.query)["state"][0]


def callback(client: TestClient, **params) -> dict:
    response = client.get(api("/integrations/instagram/callback"), params=params)
    assert response.status_code == 303
    location = urlparse(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == "http://localhost:5173/accounts"
    return {k: v[0] for k, v in parse_qs(location.query).items()}


def connect(client: TestClient) -> str:
    result = callback(client, code="good-code", state=start(client))
    assert result["instagram"] == "connected", result
    return result["account"]


def sync(client: TestClient, account_id: str) -> dict:
    response = client.post(api(f"/integrations/instagram/accounts/{account_id}/sync"))
    assert response.status_code == 200, response.text
    return response.json()


# ------------------------------------------------------------------------------- configuration
def test_disabled_without_configuration(client):
    status = client.get(api("/integrations/instagram/status")).json()
    assert status["enabled"] is False and "INSTAGRAM_APP_SECRET" in status["missingConfig"]
    assert all("=" not in name for name in status["missingConfig"])  # names only, never values
    denied = client.post(api("/integrations/instagram/connect"))
    assert denied.status_code == 503 and denied.json()["error"]["code"] == "integration_disabled"
    assert client.get(api("/integrations/instagram/accounts")).json() == []


def test_partial_or_unsafe_configuration_is_rejected():
    with pytest.raises(ValidationError, match="Incomplete Instagram integration"):
        make_settings(UNREACHABLE_DB, instagram_app_id="123")
    with pytest.raises(ValidationError, match="https"):
        ig_settings(UNREACHABLE_DB, instagram_redirect_uri="http://app.example/api/v1/integrations/instagram/callback")
    with pytest.raises(ValidationError, match="publishing and messaging are out of scope"):
        ig_settings(UNREACHABLE_DB, instagram_oauth_scopes="instagram_business_basic,instagram_business_content_publish")
    with pytest.raises(ValidationError, match="Fernet"):
        ig_settings(UNREACHABLE_DB, instagram_token_encryption_key="not-a-key")
    with pytest.raises(ValidationError, match="v26.0"):
        ig_settings(UNREACHABLE_DB, instagram_graph_api_version="latest")
    assert ig_settings(UNREACHABLE_DB).instagram_enabled


def test_token_cipher_rotation_and_tamper_detection():
    old_key, new_key = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    old = TokenCipher(old_key, 1)
    ciphertext, version = old.encrypt(LONG)
    assert LONG not in ciphertext and version == 1
    rotated = TokenCipher(new_key, 2, previous_keys=f"1:{old_key}")
    assert rotated.decrypt(ciphertext, 1) == LONG
    assert rotated.encrypt(LONG)[1] == 2
    with pytest.raises(TokenDecryptError):
        TokenCipher(new_key, 2).decrypt(ciphertext, 1)
    with pytest.raises(TokenDecryptError):
        old.decrypt(ciphertext[:-4] + "AAAA", 1)


# ------------------------------------------------------------------------------- authorization
def test_anonymous_users_cannot_use_the_integration(anon_client):
    for method, path in [("GET", "/status"), ("POST", "/connect"), ("GET", "/accounts"), ("POST", "/accounts/igc_abc123/sync"),
                         ("POST", "/accounts/igc_abc123/disconnect"), ("GET", "/accounts/igc_abc123/media")]:
        assert anon_client.request(method, api(f"/integrations/instagram{path}")).status_code == 401, path


def test_only_owners_and_admins_can_connect_sync_or_disconnect(ig_client_as, owner):
    account = connect(owner)
    editor = ig_client_as("usr-ananya")
    assert editor.post(api("/integrations/instagram/connect")).status_code == 403
    assert editor.post(api(f"/integrations/instagram/accounts/{account}/sync")).status_code == 403
    assert editor.post(api(f"/integrations/instagram/accounts/{account}/disconnect")).status_code == 403
    assert editor.get(api("/integrations/instagram/accounts")).status_code == 200  # reading is fine
    admin = ig_client_as("usr-rahul")
    assert admin.post(api("/integrations/instagram/connect")).status_code == 200


def test_connect_requires_csrf(owner):
    owner.headers.pop("X-CSRF-Token")
    assert owner.post(api("/integrations/instagram/connect")).json()["error"]["code"] == "csrf_failed"


# ----------------------------------------------------------------------------------- OAuth flow
def test_full_connect_flow_stores_only_an_encrypted_token(owner, connection, meta):
    state = start(owner)
    url = urlparse(owner.post(api("/integrations/instagram/connect")).json()["authorizationUrl"])
    query = parse_qs(url.query)
    assert query["client_id"] == ["1234567890"] and query["response_type"] == ["code"]
    assert query["redirect_uri"] == ["http://localhost:8100/api/v1/integrations/instagram/callback"]
    assert query["scope"] == [ALL_SCOPES] and "code_challenge" not in query  # no PKCE: not defined for this flow
    result = callback(owner, code="good-code#_", state=state)
    assert result["instagram"] == "connected"
    with Session(bind=connection) as s:
        conn = s.get(InstagramConnection, result["account"])
        token = s.get(InstagramToken, conn.id)
        assert conn.workspace_id == DEV_WORKSPACE and conn.ig_user_id == IG_ID and conn.username == "eko_live_test"
        assert conn.source == "instagram_api" and conn.status.value == "connected"
        assert token.ciphertext != LONG and LONG not in token.ciphertext and SHORT not in token.ciphertext
        assert TokenCipher(FERNET_KEY, 1).decrypt(token.ciphertext, token.key_version) == LONG
        assert token.expires_at is not None and token.expires_at > utcnow() + timedelta(days=59)
        # Only a digest of the state is stored, and it is consumed.
        stored = s.scalars(select(InstagramOAuthState)).all()
        assert all(row.state_hash != state and len(row.state_hash) == 64 for row in stored)
        assert any(row.consumed_at for row in stored)
    for path in ["/accounts", f"/accounts/{result['account']}", "/status"]:
        body = owner.get(api(f"/integrations/instagram{path}")).text
        assert LONG not in body and SHORT not in body and APP_SECRET not in body and "ciphertext" not in body
    account = owner.get(api(f"/integrations/instagram/accounts/{result['account']}")).json()
    assert account["followersCount"] == 1200 and account["insightsAvailable"] and account["commentsAvailable"]


def test_state_is_single_use(owner, meta):
    state = start(owner)
    assert callback(owner, code="good-code", state=state)["instagram"] == "connected"
    exchanges = meta.count("/oauth/access_token")
    assert callback(owner, code="good-code", state=state) == {"instagram": "error", "reason": "state_used"}
    assert meta.count("/oauth/access_token") == exchanges  # replay never reaches Meta


def test_expired_unknown_and_missing_state(owner, connection, meta):
    state = start(owner)
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(update(InstagramOAuthState).values(expires_at=utcnow() - timedelta(seconds=1)))
        s.commit()
    assert callback(owner, code="good-code", state=state)["reason"] == "state_expired"
    assert callback(owner, code="good-code", state="x" * 43)["reason"] == "invalid_state"
    assert callback(owner, code="good-code")["reason"] == "invalid_state"
    assert meta.count("/oauth/access_token") == 0


def test_callback_must_come_from_the_initiating_session(owner, ig_client_as, ig_app, connection, meta):
    state = start(owner)
    other = ig_client_as("usr-rahul")  # a different signed-in admin cannot complete Priya's flow
    assert callback(other, code="good-code", state=state)["reason"] == "session_mismatch"
    state = start(owner)
    with TestClient(ig_app(), follow_redirects=False) as anonymous:
        assert callback(anonymous, code="good-code", state=state)["reason"] == "session_mismatch"
    assert meta.count("/oauth/access_token") == 0


def test_denied_and_malformed_callbacks(owner, meta):
    assert callback(owner, state=start(owner), error="access_denied", error_reason="user_denied")["reason"] == "access_denied"
    assert callback(owner, state=start(owner), error="server_error")["reason"] == "authorization_failed"
    assert callback(owner, state=start(owner))["reason"] == "invalid_callback"
    assert callback(owner, state=start(owner), code="bad-code")["reason"] == "exchange_failed"
    # A crafted next/redirect parameter is ignored: the redirect target is always FRONTEND_URL/accounts.
    response = owner.get(api("/integrations/instagram/callback"), params={"state": "x", "redirect_uri": "https://evil.example"})
    assert response.headers["location"].startswith("http://localhost:5173/accounts?")
    assert meta.count("/oauth/access_token") == 1  # only the bad-code attempt reached Meta


def test_missing_basic_permission_and_non_professional_accounts(owner, meta, connection):
    meta.permissions = "instagram_business_manage_insights"
    assert callback(owner, code="good-code", state=start(owner))["reason"] == "permission_missing"
    meta.permissions = ALL_SCOPES
    meta.profile = {**meta.profile, "account_type": "PERSONAL"}
    assert callback(owner, code="good-code", state=start(owner))["reason"] == "not_professional"
    with Session(bind=connection) as s:
        assert s.scalar(select(func.count()).select_from(InstagramConnection)) == 0
        assert s.scalar(select(func.count()).select_from(InstagramToken)) == 0


def test_reconnecting_updates_the_same_connection(owner, connection):
    first = connect(owner)
    second = connect(owner)
    assert first == second
    with Session(bind=connection) as s:
        assert s.scalar(select(func.count()).select_from(InstagramConnection)) == 1


# ------------------------------------------------------------------------------------ ingestion
def test_sync_ingests_profile_media_insights_and_comments_idempotently(owner, connection, meta):
    account = connect(owner)
    run = sync(owner, account)
    assert run["status"] == "partial" or run["status"] == "success"
    assert run["mediaFetched"] == 3 and run["commentsFetched"] == 3
    assert meta.count(f"/{IG_ID}/media") == 2  # followed the cursor to page 2

    media = owner.get(api(f"/integrations/instagram/accounts/{account}/media")).json()
    assert [m["igMediaId"] for m in media] == ["m1", "m2", "m3"]
    m2 = {i["metric"]: i for i in media[1]["insights"]}
    assert m2["views"]["value"] == 90 and m2["reach"]["value"] == 70
    assert m2["saved"] == {**m2["saved"], "value": None, "status": "unavailable"}  # not a fabricated 0
    assert media[2]["likeCount"] is None  # missing field stays null

    insights = owner.get(api(f"/integrations/instagram/accounts/{account}/insights")).json()
    totals = {t["metric"]: t for t in insights["totals"]}
    assert totals["reach"]["value"] == 900 and totals["views"]["value"] == 2500
    assert totals["accounts_engaged"]["value"] is None and "accounts_engaged" in insights["unavailableMetrics"]
    assert [p["value"] for p in insights["reachDaily"]] == [30, 45]
    assert "impressions" not in json.dumps(insights) and "plays" not in json.dumps(insights)

    comments = owner.get(api(f"/integrations/instagram/accounts/{account}/comments")).json()
    assert {c["igCommentId"] for c in comments} == {"c1", "c1r", "c2"}
    assert next(c for c in comments if c["igCommentId"] == "c1r")["parentIgCommentId"] == "c1"

    sync(owner, account)  # second run: no duplicates, new insight snapshot (history kept)
    with Session(bind=connection) as s:
        assert s.scalar(select(func.count()).select_from(InstagramMedia)) == 3
        assert s.scalar(select(func.count()).select_from(InstagramComment)) == 3
        snapshots = s.scalar(select(func.count(func.distinct(InstagramMediaInsight.captured_at))))
        assert snapshots == 2
        assert s.scalar(select(func.count()).select_from(InstagramAccountInsight).where(InstagramAccountInsight.metric_type == "time_series")) == 2
        assert s.scalar(select(func.count()).select_from(InstagramSyncRun)) == 2
    assert owner.get(api(f"/integrations/instagram/accounts/{account}")).json()["lastSyncedAt"] is not None


def test_media_missing_from_a_complete_listing_is_marked_removed(owner, meta):
    account = connect(owner)
    sync(owner, account)
    meta.media = meta.media[:2]
    sync(owner, account)
    media = {m["igMediaId"]: m for m in owner.get(api(f"/integrations/instagram/accounts/{account}/media")).json()}
    assert media["m3"]["removed"] is True and media["m1"]["removed"] is False


def test_insights_and_comments_need_their_permissions(owner, meta):
    meta.permissions = "instagram_business_basic"
    account = connect(owner)
    run = sync(owner, account)
    assert run["status"] == "success" and run["mediaInsightsFetched"] == 0 and run["commentsFetched"] == 0
    assert any(w["code"] == "insights_not_granted" for w in run["warnings"])
    assert meta.count("/insights") == 0 and meta.count("/comments") == 0


def test_transient_errors_are_retried_with_a_bound(owner, meta):
    account = connect(owner)
    meta.fail["/me"] = [httpx.Response(500, json={"error": {"message": "x", "code": 2, "is_transient": True}}), httpx.ConnectTimeout("t")]
    assert sync(owner, account)["status"] in ("success", "partial")
    assert meta.count("/me") == 4  # 1 at connect + 3 attempts (1 + 2 retries)

    meta.fail["/me"] = [httpx.ReadTimeout("t")] * 5
    run = sync(owner, account)
    assert run["status"] == "failed" and run["errorCode"] == "provider_error"
    account_row = owner.get(api(f"/integrations/instagram/accounts/{account}")).json()
    assert account_row["status"] == "error" and "temporarily unavailable" in account_row["lastErrorMessage"]


def test_rate_limits_are_not_retried(owner, meta):
    account = connect(owner)
    calls = meta.count("/me")
    meta.fail["/me"] = [httpx.Response(400, json={"error": {"message": "Application request limit reached", "code": 4}})]
    run = sync(owner, account)
    assert run["status"] == "failed" and run["errorCode"] == "rate_limited"
    assert meta.count("/me") == calls + 1


def test_manual_sync_cooldown(ig_client_as):
    owner = ig_client_as("usr-priya", instagram_sync_cooldown_seconds=60)
    account = connect(owner)
    sync(owner, account)
    again = owner.post(api(f"/integrations/instagram/accounts/{account}/sync"))
    assert again.status_code == 429 and int(again.headers["Retry-After"]) > 0


# ------------------------------------------------------------------------------ token lifecycle
def test_revoked_token_marks_the_account_for_reauthorization(owner, meta):
    account = connect(owner)
    meta.fail["/me"] = [httpx.Response(400, json={"error": {"message": "Error validating access token", "type": "OAuthException", "code": 190, "error_subcode": 460}})]
    run = sync(owner, account)
    assert run["status"] == "failed" and run["errorCode"] == "token_invalid"
    assert owner.get(api(f"/integrations/instagram/accounts/{account}")).json()["status"] == "needs_reauth"


def test_expired_token_is_never_used(owner, connection, meta):
    account = connect(owner)
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(update(InstagramToken).values(expires_at=utcnow() - timedelta(minutes=1)))
        s.commit()
    before = len(meta.calls)
    run = sync(owner, account)
    assert run["errorCode"] == "token_expired" and len(meta.calls) == before
    assert owner.get(api(f"/integrations/instagram/accounts/{account}")).json()["status"] == "needs_reauth"


def test_token_is_refreshed_near_expiry_but_not_when_fresh(owner, connection, meta):
    account = connect(owner)
    sync(owner, account)
    assert meta.count("/refresh_access_token") == 0  # fresh token: < 24 h old, far from expiry
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(update(InstagramToken).values(issued_at=utcnow() - timedelta(days=50), expires_at=utcnow() + timedelta(days=10)))
        s.commit()
    sync(owner, account)
    assert meta.count("/refresh_access_token") == 1
    with Session(bind=connection) as s:
        token = s.get(InstagramToken, account)
        assert TokenCipher(FERNET_KEY, 1).decrypt(token.ciphertext, token.key_version) == REFRESHED
        assert token.refreshed_at is not None and token.expires_at > utcnow() + timedelta(days=59)


# ----------------------------------------------------------------------------------- disconnect
def test_disconnect_deletes_token_and_data_and_stops_api_use(owner, connection, meta):
    account = connect(owner)
    sync(owner, account)
    response = owner.post(api(f"/integrations/instagram/accounts/{account}/disconnect"))
    assert response.status_code == 200 and response.json()["status"] == "disconnected"
    with Session(bind=connection) as s:
        assert s.get(InstagramToken, account) is None
        assert s.scalar(select(func.count()).select_from(InstagramMedia)) == 0
        assert s.scalar(select(func.count()).select_from(InstagramMediaInsight)) == 0
        assert s.scalar(select(func.count()).select_from(InstagramComment)) == 0
        assert s.scalar(select(func.count()).select_from(InstagramAccountInsight)) == 0
        assert s.scalar(select(func.count()).select_from(InstagramSyncRun)) == 1  # audit kept
        demo_campaigns = s.execute(select(func.count()).select_from(InstagramConnection)).scalar()
        assert demo_campaigns == 1  # tombstone row
    before = len(meta.calls)
    assert owner.post(api(f"/integrations/instagram/accounts/{account}/sync")).status_code == 409
    assert owner.get(api(f"/integrations/instagram/accounts/{account}")).status_code == 404
    assert owner.get(api("/integrations/instagram/accounts")).json() == []
    assert len(meta.calls) == before  # no Instagram call with the deleted credentials
    assert owner.get(api("/campaigns")).status_code == 200 and len(owner.get(api("/campaigns")).json()) > 0  # unrelated data intact


# ------------------------------------------------------------------------------------ isolation
@pytest.fixture
def other_tenant_connection(connection):
    from tests.test_isolation import OTHER  # noqa: F401 — reuse the second-tenant id
    from app.models import TeamMember, User, Workspace
    from datetime import date

    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.add(Workspace(id="ws-ig-other", name="Other IG Co", plan="Starter", timezone="UTC", currency="USD", reporting_start=date(2026, 9, 1),
                        reporting_end=date(2026, 9, 30), reporting_label="Sep", baseline_start=date(2026, 8, 1), baseline_end=date(2026, 8, 31),
                        baseline_label="Aug", last_synced_label="never"))
        s.flush()
        ciphertext, version = TokenCipher(FERNET_KEY, 1).encrypt("OTHER-TENANT-TOKEN")
        s.add(InstagramConnection(id="igc_0be70001", workspace_id="ws-ig-other", ig_user_id="555", username="other_brand",
                                  status="connected", granted_scopes=["instagram_business_basic"], connected_at=utcnow()))
        s.flush()
        s.add(InstagramToken(connection_id="igc_0be70001", workspace_id="ws-ig-other", ciphertext=ciphertext, key_version=version, issued_at=utcnow()))
        s.add(InstagramMedia(id="igm_0be70001", workspace_id="ws-ig-other", connection_id="igc_0be70001", ig_media_id="om1",
                             first_seen_at=utcnow(), last_seen_at=utcnow()))
        s.commit()
    return "igc_0be70001"


def test_workspaces_cannot_see_or_touch_each_others_instagram_accounts(owner, other_tenant_connection, meta):
    other = other_tenant_connection
    assert owner.get(api("/integrations/instagram/accounts")).json() == []
    assert owner.get(api("/integrations/instagram/status")).json()["connectedAccounts"] == 0
    for method, path in [("GET", ""), ("GET", "/media"), ("GET", "/insights"), ("GET", "/comments"), ("GET", "/sync-runs"),
                         ("POST", "/disconnect")]:
        response = owner.request(method, api(f"/integrations/instagram/accounts/{other}{path}"))
        assert response.status_code == 404, (method, path, response.status_code)
    assert owner.post(api(f"/integrations/instagram/accounts/{other}/sync")).status_code == 404
    assert "OTHER-TENANT-TOKEN" not in json.dumps([c.content.decode(errors="ignore") for c in meta.calls])
    assert len(meta.calls) == 0


def test_same_instagram_account_in_two_workspaces_stays_separate(owner, other_tenant_connection, connection, meta):
    meta.profile = {**meta.profile, "user_id": "555"}  # the other tenant's IG account
    account = connect(owner)
    assert account != other_tenant_connection
    with Session(bind=connection) as s:
        assert s.get(InstagramConnection, other_tenant_connection).workspace_id == "ws-ig-other"
        assert s.get(InstagramConnection, account).workspace_id == DEV_WORKSPACE


# ------------------------------------------------------------------------------- logs & secrets
def test_tokens_and_secrets_never_reach_logs(owner, meta, caplog):
    caplog.set_level(logging.DEBUG)
    account = connect(owner)
    meta.fail["/me"] = [httpx.Response(500, json={"error": {"message": f"boom {LONG}", "code": 1}})] * 3
    sync(owner, account)
    sync(owner, account)
    text = caplog.text
    for secret in (SHORT, LONG, APP_SECRET, "good-code", FERNET_KEY):
        assert secret not in text


# --------------------------------------------------------------------------- Meta callbacks
def signed_request(payload: dict, secret: str = APP_SECRET) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"algorithm": "HMAC-SHA256", **payload}).encode()).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{sig}.{body}"


def test_deauthorize_callback_deletes_tokens(owner, connection, ig_app):
    account = connect(owner)
    with TestClient(ig_app()) as meta_client:
        bad = meta_client.post(api("/integrations/instagram/deauthorize"), data={"signed_request": signed_request({"user_id": SCOPED_ID}, "wrong")})
        assert bad.status_code == 400
        ok = meta_client.post(api("/integrations/instagram/deauthorize"), data={"signed_request": signed_request({"user_id": SCOPED_ID})})
        assert ok.status_code == 200 and ok.json()["connections"] == 1
    with Session(bind=connection) as s:
        assert s.get(InstagramToken, account) is None
    assert owner.get(api(f"/integrations/instagram/accounts/{account}")).json()["status"] == "needs_reauth"


def test_data_deletion_callback_purges_and_returns_a_receipt(owner, connection, ig_app):
    account = connect(owner)
    sync(owner, account)
    with TestClient(ig_app()) as meta_client:
        response = meta_client.post(api("/integrations/instagram/data-deletion"), data={"signed_request": signed_request({"user_id": SCOPED_ID})})
        assert response.status_code == 200
        receipt = response.json()
        assert receipt["url"].endswith(f"/integrations/instagram/data-deletion/{receipt['confirmationCode']}")
        status = meta_client.get(api(f"/integrations/instagram/data-deletion/{receipt['confirmationCode']}")).json()
        assert status["status"] == "completed"
    with Session(bind=connection) as s:
        conn = s.get(InstagramConnection, account)
        assert conn.status.value == "disconnected" and conn.username == "deleted" and conn.ig_user_id != IG_ID
        assert s.scalar(select(func.count()).select_from(InstagramMedia)) == 0
        assert s.get(InstagramToken, account) is None
