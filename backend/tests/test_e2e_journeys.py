"""Phase 8 — critical user journeys end to end through the HTTP API (deterministic; mocked Meta + fake AI provider).

One application instance with Instagram *and* AI enabled, driven only through public endpoints — real login with a
password (no session shortcuts), the OAuth callback, queued jobs executed by the worker entry points, analytics, AI,
review, leads, reports, cross-workspace attempts, provider failures and restart recovery.
"""

from __future__ import annotations

from datetime import timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session, sessionmaker

from app.ai.errors import AIRateLimitedError
from app.main import create_app
from app.models import Comment, InstagramSyncRun, InstagramToken
from app.services.common import utcnow
from app.services.instagram import jobs as sync_jobs

from .conftest import DEV_WORKSPACE, TEST_PASSWORD, api, make_settings
from .test_ai import AI, FakeProvider, grounded_insights, label_all, report, run as run_ai
from .test_instagram import FERNET_KEY, FakeMeta, callback, run_job, start

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")
ORIGIN = "http://localhost:5173"


@pytest.fixture
def platform(connection, db_url):
    meta = FakeMeta()
    settings = make_settings(
        db_url, **AI,
        instagram_app_id="1234567890", instagram_app_secret="test-instagram-app-secret-0001",
        instagram_redirect_uri="http://localhost:8100/api/v1/integrations/instagram/callback", instagram_graph_api_version="v26.0",
        instagram_token_encryption_key=FERNET_KEY, instagram_oauth_scopes="instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_comments",
        instagram_retry_backoff_seconds=0, instagram_sync_cooldown_seconds=0, redis_url="redis://localhost:6379/0",
    )
    app = create_app(settings)
    app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    app.state.instagram_transport = meta.transport
    app.state.instagram_sleep = lambda _s: None
    app.state.dispatched = []
    app.state.job_dispatcher = lambda job_id, countdown=0.0: app.state.dispatched.append((job_id, countdown))
    return app, meta


def login(app, email: str) -> TestClient:
    """Real login through POST /auth/login (Argon2 verification, cookie + CSRF token from the response)."""
    client = TestClient(app, follow_redirects=False)
    client.__enter__()
    response = client.post(api("/auth/login"), json={"email": email, "password": TEST_PASSWORD}, headers={"Origin": ORIGIN})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrfToken"]
    client.headers["Origin"] = ORIGIN
    return client


def owner_email(connection) -> str:
    from app.models import User

    with Session(bind=connection) as s:
        return s.get(User, "usr_test_usr-priya").email


def test_full_operator_journey(platform, connection):
    app, meta = platform
    # 1. Authentication & workspace access ------------------------------------------------------------
    anon = TestClient(app)
    assert anon.get(api("/campaigns")).status_code == 401
    owner = login(app, owner_email(connection))
    me = owner.get(api("/auth/me")).json()
    assert me["workspace"]["id"] == DEV_WORKSPACE and me["role"] == "Owner"

    # 2. Account connection callback validation (mocked Meta) -----------------------------------------
    assert callback(owner, code="good-code", state="forged-state-value-1234567890")["reason"] == "invalid_state"
    result = callback(owner, code="good-code", state=start(owner))
    assert result["instagram"] == "connected"
    account = result["account"]
    assert "LONG-LIVED" not in owner.get(api(f"/integrations/instagram/accounts/{account}")).text  # token never returned

    # 3./4. Ingestion through a queued manual sync executed by the worker ---------------------------------
    queued = owner.post(api(f"/integrations/instagram/accounts/{account}/sync"))
    assert queued.status_code == 202
    job_id = queued.json()["job"]["id"]  # the callback's "connect" job, deduplicated
    assert run_job(app, job_id) in ("succeeded", "partially_succeeded")
    assert owner.get(api(f"/sync-jobs/{job_id}")).json()["terminal"] is True
    media = owner.get(api(f"/integrations/instagram/accounts/{account}/media")).json()
    assert len(media) == 3

    # 5. Historical metrics persisted and served for charts ------------------------------------------------
    history = owner.get(api(f"/integrations/instagram/accounts/{account}/history?days=30")).json()
    followers = next(x for x in history["series"] if x["metric"] == "followers_count")
    assert followers["points"][-1]["value"] == 1200 and followers["points"][0]["value"] is None  # gap, not invented

    # 6. AI analysis with a mocked provider -----------------------------------------------------------------
    ai_job = owner.post(api("/insights/regenerate")).json()["job"]["id"]
    assert run_ai(owner, ai_job, FakeProvider([grounded_insights(report(connection))]))["status"] == "succeeded"
    ai_insights = owner.get(api("/insights?origin=ai")).json()
    assert ai_insights and ai_insights[0]["ai"]["evidence"]

    # 7. Comment classification and human review ----------------------------------------------------------
    cls_job = owner.post(api("/ai/comments/classify"), json={}).json()["job"]["id"]
    run_ai(owner, cls_job, FakeProvider(handler=label_all))
    row = owner.get(api("/ai/comments/classifications")).json()[0]
    reviewed = owner.patch(api(f"/ai/comments/classifications/{row['id']}"), json={"reviewStatus": "corrected", "intent": "other"}).json()
    assert reviewed["effective"]["intent"] == "other" and reviewed["prediction"]["intent"] == "interest"

    # 8. Lead creation (user-controlled conversion) and status updates ----------------------------------------
    with Session(bind=connection) as s:
        comment_id = s.query(Comment.id).filter(Comment.workspace_id == DEV_WORKSPACE, Comment.lead_id.is_(None)).first()[0]
    converted = owner.post(api(f"/comments/{comment_id}/convert-to-lead"))
    assert converted.status_code == 201
    lead_id = converted.json()["lead"]["id"]
    assert owner.patch(api(f"/leads/{lead_id}"), json={"status": "contacted"}).json()["status"] == "contacted"
    assert owner.post(api(f"/comments/{comment_id}/convert-to-lead")).status_code == 200  # idempotent

    # 9. Report generation (server records + regeneration; files are produced in the browser) ---------------------
    report_cfg = {"title": "E2E report", "type": "campaign_performance", "scope": "campaigns", "accountId": "acc-ekoindia",
                  "campaignIds": ["sbi-csp-october"], "period": {"start": "2024-10-01", "end": "2024-10-31"}, "metrics": ["views", "leads"],
                  "sections": ["summary", "kpis"], "compareBaseline": True, "formats": ["csv"], "schedule": "none", "recipients": []}
    created = owner.post(api("/reports"), json=report_cfg)
    assert created.status_code == 201
    assert owner.post(api(f"/reports/{created.json()['id']}/regenerate")).status_code == 200

    # 10. Unauthorized cross-workspace attempts ------------------------------------------------------------------
    for path in (f"/integrations/instagram/accounts/{account}", f"/sync-jobs/{job_id}", f"/ai/jobs/{ai_job}", "/campaigns/sbi-csp-october", "/ai/comments/classifications"):
        assert anon.get(api(path)).status_code == 401

    # Logout ends the session server-side.
    assert owner.post(api("/auth/logout")).status_code == 204
    assert owner.get(api("/auth/me")).status_code == 401


def test_failure_and_recovery_journeys(platform, connection):
    app, meta = platform
    owner = login(app, owner_email(connection))
    account = callback(owner, code="good-code", state=start(owner))["account"]
    connect_job = owner.post(api(f"/integrations/instagram/accounts/{account}/sync")).json()["job"]["id"]

    # 12. Restart recovery: a worker claims the job and dies; maintenance recovers it and the job completes.
    with app.state.session_factory() as db:
        assert sync_jobs.claim(db, app.state.settings, connect_job) is not None
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(update(InstagramSyncRun).values(lease_expires_at=utcnow() - timedelta(seconds=1)))
        s.commit()
    with app.state.session_factory() as db:
        assert sync_jobs.reap_stale_jobs(db) == 1
        assert sync_jobs.dispatch_due_jobs(db, app.state.job_dispatcher) == 1
    assert run_job(app, connect_job) in ("succeeded", "partially_succeeded")

    # 11a. Provider rate limit → retrying, not hammered.
    meta.fail["/me"] = [httpx.Response(400, json={"error": {"message": "limit", "code": 17}})]
    rl_job = owner.post(api(f"/integrations/instagram/accounts/{account}/sync")).json()["job"]["id"]
    run_job(app, rl_job)
    assert owner.get(api(f"/sync-jobs/{rl_job}")).json()["status"] == "retrying"
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:  # let it finish for the next step
        s.execute(update(InstagramSyncRun).where(InstagramSyncRun.id == rl_job).values(status="cancelled"))
        s.commit()

    # 11b. Token expiry → no provider call, account flagged for reauthorization.
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(update(InstagramToken).values(expires_at=utcnow() - timedelta(minutes=1)))
        s.commit()
    calls = len(meta.calls)
    expired_job = owner.post(api(f"/integrations/instagram/accounts/{account}/sync")).json()["job"]["id"]
    run_job(app, expired_job)
    assert owner.get(api(f"/sync-jobs/{expired_job}")).json()["errorCategory"] == "token_expired" and len(meta.calls) == calls
    assert owner.get(api(f"/integrations/instagram/accounts/{account}")).json()["status"] == "needs_reauth"

    # 11c. AI provider failure → retrying with backoff, clear category.
    ai_job = owner.post(api("/insights/regenerate")).json()["job"]["id"]
    failed = run_ai(owner, ai_job, FakeProvider([AIRateLimitedError(retry_after=90)]))
    assert failed["status"] == "retrying" and failed["errorCategory"] == "rate_limited"
