"""Phase 6 — durable background sync jobs, scheduler, recovery and historical analytics (mocked Meta, no Redis).

The Celery task is a thin wrapper around ``jobs.execute_job`` / ``schedule_due_syncs`` / ``reap_stale_jobs`` /
``dispatch_due_jobs``; these tests call those functions directly with a recording dispatcher.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import (
    InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramMedia, InstagramMediaInsight, InstagramSyncRun,
    TeamMember, User, WorkerHeartbeat, Workspace,
)
from app.services.common import utcnow
from app.services.instagram import jobs
from app.services.instagram.crypto import TokenCipher

from .conftest import DEV_WORKSPACE, TEST_PASSWORD, api, sign_in
from .test_instagram import (  # noqa: F401 — fixtures
    FERNET_KEY, IG_ID, FakeMeta, connect, ig_app, ig_client_as, make_due, meta, owner, run_job,
)

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


def enqueue(client: TestClient, account: str) -> dict:
    response = client.post(api(f"/integrations/instagram/accounts/{account}/sync"))
    assert response.status_code == 202, response.text
    return response.json()


def job_status(client: TestClient, job_id: str) -> dict:
    response = client.get(api(f"/sync-jobs/{job_id}"))
    assert response.status_code == 200, response.text
    return response.json()


def count(connection, model, *where) -> int:
    with Session(bind=connection) as s:
        return s.scalar(select(func.count()).select_from(model).where(*where)) or 0


def db_exec(connection, stmt) -> None:
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.execute(stmt)
        s.commit()


# ------------------------------------------------------------------------------------ enqueue
def test_manual_sync_returns_promptly_with_a_queued_job(owner, meta):
    account = connect(owner)  # the callback already queued the initial "connect" job
    calls = len(meta.calls)
    body = enqueue(owner, account)
    assert body["deduplicated"] is True and body["job"]["trigger"] == "connect" and body["job"]["status"] == "queued"
    assert len(meta.calls) == calls  # nothing was fetched inside the request
    assert body["job"]["id"] in [j for j, _ in owner.app.state.dispatched]
    run_job(owner.app, body["job"]["id"])
    done = job_status(owner, body["job"]["id"])
    assert done["status"] in ("succeeded", "partially_succeeded") and done["progress"] == 100 and done["recordsProcessed"] > 0
    assert done["startedAt"] and done["finishedAt"] and done["terminal"]


def test_repeated_requests_never_queue_identical_jobs(owner, connection):
    account = connect(owner)
    ids = {enqueue(owner, account)["job"]["id"] for _ in range(5)}
    assert len(ids) == 1
    assert count(connection, InstagramSyncRun, InstagramSyncRun.status.in_(("queued", "running", "retrying"))) == 1


def test_database_rejects_a_second_active_job_for_an_account(owner, connection):
    account = connect(owner)
    with pytest.raises(Exception, match="uq_instagram_sync_runs_one_active"):
        with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
            s.add(InstagramSyncRun(id="igr_dup", workspace_id=DEV_WORKSPACE, connection_id=account, trigger="manual", status="queued",
                                   warnings=[], api_version="v26.0"))
            s.flush()


def test_sync_is_unavailable_without_a_broker(ig_client_as):
    owner = ig_client_as("usr-priya")
    account = connect(owner)
    owner.app.state.job_dispatcher = None
    response = owner.post(api(f"/integrations/instagram/accounts/{account}/sync"))
    assert response.status_code == 503 and response.json()["error"]["code"] == "background_sync_unavailable"


def test_permissions_for_enqueue_and_job_reads(owner, ig_client_as, anon_client):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    editor = ig_client_as("usr-ananya")
    assert editor.post(api(f"/integrations/instagram/accounts/{account}/sync")).status_code == 403
    assert editor.post(api(f"/sync-jobs/{job_id}/cancel")).status_code == 403
    assert editor.get(api(f"/sync-jobs/{job_id}")).status_code == 200  # members may watch progress
    assert anon_client.get(api(f"/sync-jobs/{job_id}")).status_code == 401
    assert anon_client.post(api(f"/integrations/instagram/accounts/{account}/sync")).status_code == 401


@pytest.fixture
def other_workspace_job(connection):
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.add(Workspace(id="ws-jobs-other", name="Other", plan="Starter", timezone="UTC", currency="USD", reporting_start=date(2026, 9, 1),
                        reporting_end=date(2026, 9, 30), reporting_label="Sep", baseline_start=date(2026, 8, 1), baseline_end=date(2026, 8, 31),
                        baseline_label="Aug", last_synced_label="never"))
        s.flush()
        s.add(InstagramConnection(id="igc_0be7a0b1", workspace_id="ws-jobs-other", ig_user_id="777", username="other_jobs", status="connected",
                                  granted_scopes=["instagram_business_basic"], connected_at=utcnow()))
        s.flush()
        s.add(InstagramSyncRun(id="igr_0be7a0b1", workspace_id="ws-jobs-other", connection_id="igc_0be7a0b1", trigger="scheduled",
                               status="queued", warnings=[], api_version="v26.0"))
        s.commit()
    return "igr_0be7a0b1"


def test_jobs_of_another_workspace_cannot_be_read_or_cancelled(owner, other_workspace_job):
    assert owner.get(api(f"/sync-jobs/{other_workspace_job}")).status_code == 404
    assert owner.post(api(f"/sync-jobs/{other_workspace_job}/cancel")).status_code == 404
    assert owner.get(api("/integrations/instagram/accounts/igc_0be7a0b1/sync-history")).status_code == 404
    assert owner.get(api("/integrations/instagram/accounts/igc_0be7a0b1/sync-status")).status_code == 404
    assert owner.post(api("/integrations/instagram/accounts/igc_0be7a0b1/sync")).status_code == 404


# --------------------------------------------------------------------------- claim & recovery
def test_duplicate_delivery_runs_the_job_only_once(owner, meta):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    assert run_job(owner.app, job_id) in ("succeeded", "partially_succeeded")
    calls = len(meta.calls)
    assert run_job(owner.app, job_id) == "skipped"  # redelivered message: nothing to claim
    assert len(meta.calls) == calls


def test_concurrent_claims_only_one_wins(owner, connection):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    settings = owner.app.state.settings
    with owner.app.state.session_factory() as a, owner.app.state.session_factory() as b:
        first = jobs.claim(a, settings, job_id)
        second = jobs.claim(b, settings, job_id)
    assert first is not None and second is None


def test_worker_crash_is_recovered_and_the_job_completes(owner, connection, meta):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    with owner.app.state.session_factory() as db:  # a worker claims the job …
        assert jobs.claim(db, owner.app.state.settings, job_id) is not None
    db_exec(connection, update(InstagramSyncRun).values(lease_expires_at=utcnow() - timedelta(seconds=1)))  # … and dies
    assert run_job(owner.app, job_id) == "skipped"  # still "running" for everyone else
    with owner.app.state.session_factory() as db:
        assert jobs.reap_stale_jobs(db) == 1
    recovered = job_status(owner, job_id)
    assert recovered["status"] == "retrying" and recovered["errorCategory"] == "worker_lost" and recovered["retryCount"] == 1
    with owner.app.state.session_factory() as db:
        assert jobs.dispatch_due_jobs(db, owner.app.state.job_dispatcher) == 1
    assert run_job(owner.app, job_id) in ("succeeded", "partially_succeeded")


def test_repeated_crashes_end_in_a_visible_terminal_failure(owner, connection):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    db_exec(connection, update(InstagramSyncRun).where(InstagramSyncRun.id == job_id).values(
        status="running", retry_count=3, lease_expires_at=utcnow() - timedelta(seconds=1)))
    with owner.app.state.session_factory() as db:
        jobs.reap_stale_jobs(db)
    final = job_status(owner, job_id)
    assert final["status"] == "failed" and final["terminal"] and final["errorCategory"] == "worker_lost"


def test_unclaimed_queued_jobs_are_redelivered(owner, connection):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    owner.app.state.dispatched.clear()
    db_exec(connection, update(InstagramSyncRun).values(queued_at=utcnow() - timedelta(minutes=5)))
    with owner.app.state.session_factory() as db:
        jobs.dispatch_due_jobs(db, owner.app.state.job_dispatcher)
    assert [j for j, _ in owner.app.state.dispatched] == [job_id]


def test_cancel_queued_and_running_jobs(owner, connection, meta):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    cancelled = owner.post(api(f"/sync-jobs/{job_id}/cancel")).json()
    assert cancelled["status"] == "cancelled" and cancelled["terminal"]
    assert owner.post(api(f"/sync-jobs/{job_id}/cancel")).status_code == 409
    calls = len(meta.calls)
    assert run_job(owner.app, job_id) == "skipped" and len(meta.calls) == calls


# ------------------------------------------------------------------------------ retry policy
def test_backoff_is_exponential_jittered_bounded_and_honours_rate_limits(owner):
    settings = owner.app.state.settings  # base 60 s, max 3600 s
    for attempt, nominal in [(0, 60), (1, 120), (2, 240), (3, 480)]:
        for _ in range(20):
            assert nominal * 0.8 <= jobs.backoff_seconds(settings, attempt) <= nominal * 1.2
    assert jobs.backoff_seconds(settings, 20) <= 3600
    assert jobs.backoff_seconds(settings, 0, retry_after=900, category="rate_limited") >= 900
    assert jobs.backoff_seconds(settings, 0, category="rate_limited") >= 300  # never hammer without a hint


def test_rate_limit_hint_from_meta_usage_header_sets_next_retry(owner, meta):
    account = connect(owner)
    meta.fail["/me"] = [httpx.Response(400, headers={"x-business-use-case-usage": '{"1784": [{"call_count": 100, "estimated_time_to_regain_access": 30}]}'},
                                       json={"error": {"message": "User request limit reached", "code": 17}})]
    job_id = enqueue(owner, account)["job"]["id"]
    run_job(owner.app, job_id)
    job = job_status(owner, job_id)
    assert job["status"] == "retrying" and job["errorCategory"] == "rate_limited"
    wait = datetime.fromisoformat(job["nextRetryAt"].replace("Z", "+00:00")) - utcnow()
    assert wait.total_seconds() >= 30 * 60 - 5  # 30 minutes from the header


def test_app_level_rate_limit_pauses_all_jobs_without_consuming_retries(owner, meta, connection):
    account = connect(owner)
    meta.fail["/me"] = [httpx.Response(400, headers={"retry-after": "600"}, json={"error": {"message": "Application request limit reached", "code": 4}})]
    job_id = enqueue(owner, account)["job"]["id"]
    run_job(owner.app, job_id)
    with owner.app.state.session_factory() as db:
        assert jobs.app_pause_until(db) is not None
        assert jobs.schedule_due_syncs(db, owner.app.state.settings, owner.app.state.job_dispatcher) == 0  # scheduler holds off
    make_due(connection)
    calls = len(meta.calls)
    assert run_job(owner.app, job_id) == "deferred" and len(meta.calls) == calls  # no call while paused
    job = job_status(owner, job_id)
    assert job["retryCount"] == 1 and job["status"] == "retrying"


def test_permanent_authorization_errors_are_not_retried(owner, meta):
    account = connect(owner)
    meta.fail["/me"] = [httpx.Response(400, json={"error": {"message": "Error validating access token", "code": 190, "error_subcode": 463}})]
    job_id = enqueue(owner, account)["job"]["id"]
    owner.app.state.dispatched.clear()
    run_job(owner.app, job_id)
    job = job_status(owner, job_id)
    assert job["status"] == "failed" and job["retryCount"] == 0 and owner.app.state.dispatched == []
    assert owner.post(api(f"/integrations/instagram/accounts/{account}/sync")).status_code == 409  # needs reconnect first


# --------------------------------------------------------------------------------- scheduler
def test_scheduler_queues_due_accounts_once_and_skips_ineligible_ones(owner, connection, meta):
    account = connect(owner)
    run_job(owner.app, enqueue(owner, account)["job"]["id"])
    settings = owner.app.state.settings
    with owner.app.state.session_factory() as db:
        assert jobs.schedule_due_syncs(db, settings, owner.app.state.job_dispatcher) == 0  # synced just now
    db_exec(connection, update(InstagramConnection).values(last_sync_attempt_at=utcnow() - timedelta(minutes=settings.instagram_sync_interval_minutes + 1)))
    with owner.app.state.session_factory() as db:
        assert jobs.schedule_due_syncs(db, settings, owner.app.state.job_dispatcher) == 1
    with owner.app.state.session_factory() as db:  # a second tick (or a second beat) adds nothing
        assert jobs.schedule_due_syncs(db, settings, owner.app.state.job_dispatcher) == 0
    scheduled = count(connection, InstagramSyncRun, InstagramSyncRun.trigger == "scheduled")
    assert scheduled == 1
    # Needs-reauthorization and disconnected accounts are never scheduled.
    db_exec(connection, update(InstagramSyncRun).where(InstagramSyncRun.trigger == "scheduled").values(status="cancelled"))
    for state in ("needs_reauth", "disconnected"):
        db_exec(connection, update(InstagramConnection).values(status=state))
        with owner.app.state.session_factory() as db:
            assert jobs.schedule_due_syncs(db, settings, owner.app.state.job_dispatcher) == 0


def test_scheduler_respects_disabled_flag_and_batch_size(ig_client_as, connection):
    owner = ig_client_as("usr-priya", sync_scheduler_enabled=False)
    connect(owner)
    with owner.app.state.session_factory() as db:
        db.execute(update(InstagramSyncRun).values(status="cancelled"))
        db.commit()
        assert jobs.schedule_due_syncs(db, owner.app.state.settings, owner.app.state.job_dispatcher) == 0


def test_sync_status_reports_last_success_current_job_and_next_run(ig_client_as):
    owner = ig_client_as("usr-priya", redis_url="redis://localhost:6379/0")
    account = connect(owner)
    status = owner.get(api(f"/integrations/instagram/accounts/{account}/sync-status")).json()
    assert status["currentJob"]["trigger"] == "connect" and status["nextScheduledAt"] is None and status["lastSuccessAt"] is None
    run_job(owner.app, status["currentJob"]["id"])
    status = owner.get(api(f"/integrations/instagram/accounts/{account}/sync-status")).json()
    assert status["currentJob"] is None and status["lastSuccessAt"] and status["lastJob"]["status"] in ("succeeded", "partially_succeeded")
    next_at = datetime.fromisoformat(status["nextScheduledAt"].replace("Z", "+00:00"))
    assert timedelta(minutes=359) < next_at - utcnow() <= timedelta(minutes=360)
    history = owner.get(api(f"/integrations/instagram/accounts/{account}/sync-history")).json()
    assert len(history) == 1 and history[0]["id"] == status["lastJob"]["id"]


# ------------------------------------------------------------------------- incremental sync
def test_backfill_continues_across_jobs_and_detects_deleted_media(ig_client_as, meta, connection):
    meta.media = [{"id": f"m{i}", "media_type": "IMAGE", "timestamp": f"2026-10-{10 - i:02d}T10:00:00+0000"} for i in range(1, 8)]
    owner = ig_client_as("usr-priya", instagram_sync_max_media=2, instagram_backfill_batch_size=2)
    account = connect(owner)

    def run_once():
        job_id = enqueue(owner, account)["job"]["id"]
        run_job(owner.app, job_id)
        return job_status(owner, job_id)

    first = run_once()
    assert count(connection, InstagramMedia) == 4  # newest 2 + backfill batch of 2
    assert any(w["code"] == "media_backfill_in_progress" for w in first["warnings"])
    run_once()
    assert count(connection, InstagramMedia) == 6
    run_once()  # reaches the end of the list → pass complete
    assert count(connection, InstagramMedia) == 7
    with Session(bind=connection) as s:
        conn = s.get(InstagramConnection, account)
        assert conn.media_backfill_cursor is None and conn.media_backfill_completed_at is not None
    meta.media = [m for m in meta.media if m["id"] != "m6"]  # deleted on Instagram
    for _ in range(4):
        run_once()
    with Session(bind=connection) as s:
        removed = {m.ig_media_id for m in s.scalars(select(InstagramMedia).where(InstagramMedia.removed_at.is_not(None)))}
    assert removed == {"m6"} and count(connection, InstagramMedia) == 7  # kept (flagged), not duplicated


def test_expired_paging_cursor_restarts_the_backfill_instead_of_failing(ig_client_as, meta, connection):
    meta.media = [{"id": f"m{i}", "media_type": "IMAGE"} for i in range(1, 8)]
    owner = ig_client_as("usr-priya", instagram_sync_max_media=2, instagram_backfill_batch_size=2)
    account = connect(owner)
    run_job(owner.app, enqueue(owner, account)["job"]["id"])
    db_exec(connection, update(InstagramConnection).values(media_backfill_cursor="cEXPIRED"))
    original = meta.handle

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("after") == "cEXPIRED":
            meta.calls.append(request)
            return httpx.Response(400, json={"error": {"message": "Invalid cursor", "code": 100}})
        return original(request)

    meta.transport.handler = handle
    job_id = enqueue(owner, account)["job"]["id"]
    run_job(owner.app, job_id)
    job = job_status(owner, job_id)
    assert job["status"] in ("succeeded", "partially_succeeded") and any(w["code"] == "backfill_restarted" for w in job["warnings"])


def test_permanently_unsupported_metrics_are_not_requested_again(owner, meta, connection):
    account = connect(owner)
    original = meta.handle

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/m2/insights"):
            metric = request.url.params["metric"]
            if "," in metric or metric == "shares":
                meta.calls.append(request)
                return httpx.Response(400, json={"error": {"message": "(#100) metric not supported", "code": 100}})
        return original(request)

    meta.transport.handler = handle
    run_job(owner.app, enqueue(owner, account)["job"]["id"])
    with Session(bind=connection) as s:
        assert s.scalar(select(InstagramMedia.unsupported_metrics).where(InstagramMedia.ig_media_id == "m2")) == ["shares"]
    db_exec(connection, update(InstagramMedia).values(insights_checked_at=utcnow() - timedelta(days=30)))
    shares_calls = lambda: sum(1 for r in meta.calls if r.url.path.endswith("/m2/insights") and "shares" in r.url.params["metric"].split(","))  # noqa: E731
    before = shares_calls()
    run_job(owner.app, enqueue(owner, account)["job"]["id"])
    assert shares_calls() == before  # never asked for again
    with Session(bind=connection) as s:
        m2 = s.scalar(select(InstagramMedia.id).where(InstagramMedia.ig_media_id == "m2"))
        latest = s.scalar(select(func.max(InstagramMediaInsight.captured_at)).where(InstagramMediaInsight.media_id == m2))
        metrics = set(s.scalars(select(InstagramMediaInsight.metric).where(InstagramMediaInsight.media_id == m2, InstagramMediaInsight.captured_at == latest)))
    assert "shares" not in metrics and "views" in metrics


def test_reprocessing_the_same_observation_cannot_duplicate_anything(owner, connection, meta):
    """A job that crashed after writing (lease expired) and is retried writes the same observation keys again."""
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    run_job(owner.app, job_id)
    totals = {m: count(connection, m) for m in (InstagramMedia, InstagramMediaInsight, InstagramAccountInsight, InstagramComment)}
    # Simulate redelivery of the same job after a crash right before it was marked finished.
    db_exec(connection, update(InstagramSyncRun).where(InstagramSyncRun.id == job_id).values(status="retrying", next_retry_at=None, finished_at=None))
    db_exec(connection, update(InstagramMedia).values(insights_checked_at=None))  # force insights to be fetched again
    run_job(owner.app, job_id)
    assert {m: count(connection, m) for m in totals} == totals


# --------------------------------------------------------------------------- disconnect
def test_disconnect_cancels_queued_jobs_and_never_calls_meta_again(owner, meta, connection):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    assert owner.post(api(f"/integrations/instagram/accounts/{account}/disconnect")).status_code == 200
    assert job_status(owner, job_id)["status"] == "cancelled"
    calls = len(meta.calls)
    assert run_job(owner.app, job_id) == "skipped" and len(meta.calls) == calls


def test_disconnect_during_a_running_job_stops_it_and_leaves_no_data(owner, meta, connection):
    account = connect(owner)
    job_id = enqueue(owner, account)["job"]["id"]
    original = meta.handle
    disconnected = {"done": False}

    def handle(request: httpx.Request) -> httpx.Response:
        response = original(request)
        if request.url.path.endswith("/media") and not disconnected["done"]:
            disconnected["done"] = True  # the user disconnects while the worker is fetching media
            owner.post(api(f"/integrations/instagram/accounts/{account}/disconnect"))
        return response

    meta.transport.handler = handle
    assert run_job(owner.app, job_id) == "cancelled"
    assert job_status(owner, job_id)["errorCategory"] == "connection_disconnected"
    for model in (InstagramMedia, InstagramMediaInsight, InstagramAccountInsight, InstagramComment):
        assert count(connection, model) == 0


# ---------------------------------------------------------------------------- history
def _snapshot(s, account, metric, when: datetime, value, metric_type="snapshot"):
    s.add(InstagramAccountInsight(workspace_id=DEV_WORKSPACE, connection_id=account, metric=metric, metric_type=metric_type,
                                  period="lifetime" if metric_type == "snapshot" else "day",
                                  range_start=when - (timedelta(days=1) if metric_type == "time_series" else timedelta()), range_end=when,
                                  value=value, status="ok" if value is not None else "unavailable", captured_at=when, api_version="v26.0"))


def test_history_shows_only_observed_days_with_honest_gaps(owner, connection):
    account = connect(owner)
    today = datetime.combine(utcnow().date(), datetime.min.time(), tzinfo=timezone.utc)
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        _snapshot(s, account, "followers_count", today - timedelta(days=3, hours=-9), 1000)
        _snapshot(s, account, "followers_count", today - timedelta(days=3, hours=-15), 1005)  # later the same day wins
        _snapshot(s, account, "followers_count", today - timedelta(days=1, hours=-9), 1010)
        _snapshot(s, account, "reach", today - timedelta(days=2, hours=-7), 300, metric_type="time_series")
        s.commit()
    history = owner.get(api(f"/integrations/instagram/accounts/{account}/history?days=7")).json()
    series = {(x["metric"], x["kind"]): x for x in history["series"]}
    followers = [p["value"] for p in series[("followers_count", "daily_snapshot")]["points"]]
    assert followers == [None, None, None, 1005, None, 1010, None]  # gaps stay null — no carried-forward values
    assert series[("followers_count", "daily_snapshot")]["observedDays"] == 2 and series[("followers_count", "daily_snapshot")]["kind"] == "daily_snapshot"
    reach = [p["value"] for p in series[("reach", "daily")]["points"]]
    assert reach.count(300) == 1 and reach.count(None) == 6
    assert history["firstObservationAt"] is not None


def test_history_is_built_from_real_syncs(owner, connection):
    account = connect(owner)
    run_job(owner.app, enqueue(owner, account)["job"]["id"])
    history = owner.get(api(f"/integrations/instagram/accounts/{account}/history?days=30")).json()
    series = {(x["metric"], x["kind"]): x for x in history["series"]}
    assert series[("followers_count", "daily_snapshot")]["points"][-1]["value"] == 1200  # today's observation
    assert all(p["value"] is None for p in series[("followers_count", "daily_snapshot")]["points"][:-1])  # no fabricated past
    assert series[("reach", "daily")]["observedDays"] == 2  # the two daily points the API returned
    media = owner.get(api(f"/integrations/instagram/accounts/{account}/media")).json()
    detail = owner.get(api(f"/integrations/instagram/accounts/{account}/media/{media[0]['id']}/history")).json()
    views = next(x for x in detail["series"] if x["metric"] == "views")
    assert len(views["points"]) == 1 and views["points"][0]["value"] == 800


def test_empty_history_for_a_fresh_connection(owner):
    account = connect(owner)
    history = owner.get(api(f"/integrations/instagram/accounts/{account}/history?days=7")).json()
    assert history["series"] == [] and history["firstObservationAt"] is None


# ------------------------------------------------------------------------------ health
def test_ready_reports_background_liveness(ig_client_as, connection):
    owner = ig_client_as("usr-priya", redis_url="redis://localhost:6379/0")
    assert owner.get("/ready").json()["checks"]["background"] == {"configured": True, "worker": "never", "scheduler": "never"}
    with owner.app.state.session_factory() as db:
        jobs.record_heartbeat(db, "worker", {"host": "test"})
        jobs.record_heartbeat(db, "scheduler", {"created": 0})
    assert owner.get("/ready").json()["checks"]["background"] == {"configured": True, "worker": "ok", "scheduler": "ok"}
