"""Durable Instagram sync jobs: enqueue, atomic claim, execution with lease/heartbeat, retries, recovery, scheduling.

PostgreSQL is the source of truth; the queue (Celery on Redis) only carries "job X is ready" messages:

* **One active job per account** — a partial unique index on ``instagram_sync_runs(connection_id)`` for
  queued/running/retrying rows. Enqueueing uses ``INSERT … ON CONFLICT DO NOTHING`` and returns the existing
  active job, so repeated clicks and overlapping scheduler ticks cannot build a queue of identical jobs.
* **Atomic claim** — a worker moves a job to ``running`` with one conditional ``UPDATE … RETURNING`` and takes a
  lease. A duplicate delivery (or a second worker) finds nothing to claim and does nothing.
* **Lease + heartbeat** — renewed at every stage; ``reap_stale_jobs`` turns expired leases (worker crash, kill,
  restart) back into ``retrying`` (or ``failed`` once retries are exhausted). Nothing stays ``running`` forever.
* **Retries** — only for transient categories, exponential backoff with jitter, honouring rate-limit hints, up to
  ``INSTAGRAM_JOB_MAX_RETRIES``. Authorization errors are terminal and flag the account for reauthorization.
* **App-wide rate limit** — Meta error #4 (app-level) pauses *all* Instagram calls until the hinted time.
* **Lost messages** — ``dispatch_due_jobs`` re-sends queued jobs nobody picked up and retrying jobs that are due.
"""

from __future__ import annotations

import logging
import random
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import and_, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, ConflictError, NotFoundError
from app.core.tenancy import bind_workspace
from app.models import InstagramConnection, InstagramSyncRun, WorkerHeartbeat
from app.models.enums import ACTIVE_JOB_STATES, IgConnectionStatus, IgSyncStatus
from app.services.auth import RateLimitedError
from app.services.common import utcnow

from .connections import mark_needs_reauth, purge_provider_data
from .crypto import TokenCipher
from .provider import InstagramClient, ProviderError
from .sync import JobCancelled, StopSync, SyncEngine

logger = logging.getLogger("instaboard.sync")

Dispatcher = Callable[[str, float], None]  # (job_id, countdown_seconds)
ACTIVE_WHERE = text("status IN ('queued', 'running', 'retrying')")
RETRYABLE = {"rate_limited", "provider_unavailable", "bad_response", "internal_error", "worker_lost"}
REAUTH = {"token_invalid", "token_expired", "token_missing", "token_unreadable", "permission_denied"}
APP_PAUSE_KEY = "instagram:app_rate_limit"
UNDELIVERED_AFTER = timedelta(minutes=2)  # a queued job not claimed by then is re-sent
SCHEDULER_LOCK = 0x16_5CED  # pg_advisory_xact_lock key: one effective scheduler tick at a time


class SyncUnavailableError(ApiError):
    status_code = 503
    code = "background_sync_unavailable"

    def __init__(self) -> None:
        super().__init__("Background sync is not running on this server (REDIS_URL is not configured). See README → Background sync.")


# ----------------------------------------------------------------------------------- enqueue
@dataclass
class EnqueueResult:
    job: InstagramSyncRun
    created: bool


def enqueue(db: Session, settings: Settings, connection: InstagramConnection, *, trigger: str, member_id: str | None,
            enforce_cooldown: bool = False) -> EnqueueResult:
    if connection.status == IgConnectionStatus.disconnected:
        raise ConflictError("This Instagram account is disconnected.")
    if connection.status == IgConnectionStatus.needs_reauth:
        raise ConflictError("This Instagram account needs to be reconnected before it can sync.", details={"reason": "needs_reauth"})
    active = _active_job(db, connection.id)
    if active is not None:
        return EnqueueResult(active, False)
    if enforce_cooldown and settings.instagram_sync_cooldown_seconds:
        last = db.scalar(select(func.max(InstagramSyncRun.queued_at)).where(InstagramSyncRun.connection_id == connection.id))
        if last is not None:
            wait = last + timedelta(seconds=settings.instagram_sync_cooldown_seconds) - utcnow()
            if wait.total_seconds() > 0:
                raise RateLimitedError(int(wait.total_seconds()) + 1)
    now = utcnow()
    job_id = f"igr_{secrets.token_hex(8)}"
    created = db.execute(insert(InstagramSyncRun).values(
        id=job_id, workspace_id=connection.workspace_id, connection_id=connection.id, trigger=trigger,
        triggered_by_member_id=member_id, queued_at=now, observation_at=now, status=IgSyncStatus.queued.value,
        warnings=[], max_retries=settings.instagram_job_max_retries, api_version=settings.instagram_graph_api_version or "",
    ).on_conflict_do_nothing(index_elements=["connection_id"], index_where=ACTIVE_WHERE).returning(InstagramSyncRun.id)).scalar()
    db.flush()
    job = db.get(InstagramSyncRun, created) if created else _active_job(db, connection.id)
    assert job is not None
    return EnqueueResult(job, bool(created))


def _active_job(db: Session, connection_id: str) -> InstagramSyncRun | None:
    return db.scalar(select(InstagramSyncRun).where(InstagramSyncRun.connection_id == connection_id,
                                                    InstagramSyncRun.status.in_(ACTIVE_JOB_STATES)))


def cancel(db: Session, job: InstagramSyncRun) -> InstagramSyncRun:
    if job.status.value not in ACTIVE_JOB_STATES:
        raise ConflictError(f"The job is already {job.status.value}.")
    if job.status == IgSyncStatus.running:
        job.cancel_requested = True  # the worker stops at its next checkpoint
    else:
        _finish(job, IgSyncStatus.cancelled, category="cancelled", message="Cancelled by a workspace member.")
    return job


# ------------------------------------------------------------------------------------- claim
def claim(db: Session, settings: Settings, job_id: str) -> InstagramSyncRun | None:
    """Queued/retrying (and due) → running, atomically. Returns None for duplicates, early or finished jobs."""
    now = utcnow()
    claimed = db.execute(
        update(InstagramSyncRun)
        .where(InstagramSyncRun.id == job_id, InstagramSyncRun.status.in_(("queued", "retrying")),
               or_(InstagramSyncRun.next_retry_at.is_(None), InstagramSyncRun.next_retry_at <= now))
        .values(status=IgSyncStatus.running.value, started_at=now, heartbeat_at=now, next_retry_at=None,
                lease_expires_at=now + timedelta(seconds=settings.instagram_job_lease_seconds))
        .returning(InstagramSyncRun.id)
        .execution_options(synchronize_session=False)
    ).scalar()
    db.commit()
    return db.get(InstagramSyncRun, claimed, populate_existing=True) if claimed else None


# ----------------------------------------------------------------------------------- execute
def execute_job(session_factory, settings: Settings, *, client_factory: Callable[[], InstagramClient],
                cipher_factory: Callable[[], TokenCipher], dispatcher: Dispatcher | None, job_id: str) -> str:
    """Run one delivery of a job. Safe to call more than once for the same job (only one claim succeeds)."""
    with session_factory() as db:
        pause = app_pause_until(db)
        if pause is not None:  # app-wide rate limit: defer without consuming a retry
            deferred = db.execute(update(InstagramSyncRun).where(
                InstagramSyncRun.id == job_id, InstagramSyncRun.status.in_(("queued", "retrying")))
                .values(status=IgSyncStatus.retrying.value, next_retry_at=pause).execution_options(synchronize_session=False)).rowcount
            db.commit()
            if deferred and dispatcher:
                dispatcher(job_id, max(1.0, (pause - utcnow()).total_seconds()))
            return "deferred"
        job = claim(db, settings, job_id)
        if job is None:
            return "skipped"
        bind_workspace(db, job.workspace_id)
        connection = db.get(InstagramConnection, job.connection_id)
        log = {"job": job.id, "connection": job.connection_id, "trigger": job.trigger, "attempt": job.retry_count + 1}
        if connection is None or connection.status == IgConnectionStatus.disconnected:
            _finish(job, IgSyncStatus.cancelled, category="connection_disconnected", message="The account was disconnected; nothing was fetched.")
            db.commit()
            return job.status.value
        if connection.status == IgConnectionStatus.needs_reauth:
            _finish(job, IgSyncStatus.failed, category="reauth_required", message="The account must be reconnected before it can sync.")
            db.commit()
            return job.status.value
        if job.cancel_requested:
            _finish(job, IgSyncStatus.cancelled, category="cancelled", message="Cancelled by a workspace member.")
            db.commit()
            return job.status.value
        connection.last_sync_attempt_at = utcnow()
        connection.last_sync_status = IgSyncStatus.running.value
        db.commit()
        logger.info("sync job started %s", log)

        def checkpoint(stage: str, progress: int) -> None:
            db.refresh(job, ["cancel_requested"])
            db.refresh(connection, ["status"])
            if connection.status == IgConnectionStatus.disconnected:
                job.cancel_requested = True
            now = utcnow()
            job.progress_stage, job.progress = stage, max(job.progress, min(progress, 99))
            job.heartbeat_at, job.lease_expires_at = now, now + timedelta(seconds=settings.instagram_job_lease_seconds)
            db.commit()
            if job.cancel_requested:
                raise JobCancelled()

        retry_in: float | None = None
        client = client_factory()
        try:
            status = SyncEngine(db, settings, client, cipher_factory(), connection, job, checkpoint).run()
            checkpoint("finishing", 99)  # last chance to notice a disconnect/cancel before reporting success
            _finish(job, status)
            connection.status = IgConnectionStatus.connected
            connection.last_synced_at = job.finished_at
            connection.last_sync_status = status.value
            connection.last_error_code = connection.last_error_message = None
        except JobCancelled:
            db.rollback()
            if connection.status == IgConnectionStatus.disconnected:
                purge_provider_data(db, connection)  # anything written before the stop is removed again
                _finish(job, IgSyncStatus.cancelled, category="connection_disconnected", message="The account was disconnected during the sync.")
            else:
                _finish(job, IgSyncStatus.cancelled, category="cancelled", message="Cancelled by a workspace member.")
                connection.last_sync_status = IgSyncStatus.cancelled.value
        except StopSync as stop:
            db.rollback()
            _fail(job, connection, stop.category, stop.message)
        except ProviderError as exc:
            db.rollback()
            category = {"token_invalid": "token_invalid", "permission_denied": "permission_denied", "rate_limited": "rate_limited",
                        "unavailable": "provider_unavailable", "bad_response": "bad_response"}.get(exc.kind, "provider_rejected")
            if category == "rate_limited" and exc.provider_code == 4:
                pause_app(db, settings, retry_after=exc.retry_after)
            retry_in = _fail(job, connection, category, exc.safe_message, retry_after=exc.retry_after, settings=settings)
        except Exception as exc:  # noqa: BLE001 — never leave a job running; log the class only (no payloads)
            db.rollback()
            logger.error("sync job crashed %s error=%s", log, exc.__class__.__name__)
            retry_in = _fail(job, connection, "internal_error", "An internal error interrupted the sync; it will be retried.", settings=settings)
        finally:
            client.close()
        db.commit()
        logger.info("sync job finished %s status=%s category=%s records=%s", log, job.status.value, job.error_category, job.records_processed)
        if retry_in is not None and dispatcher:
            dispatcher(job.id, retry_in)
        return job.status.value


def _finish(job: InstagramSyncRun, status: IgSyncStatus, *, category: str | None = None, message: str | None = None) -> None:
    job.status, job.finished_at = status, utcnow()
    job.error_category, job.error_message = category, message
    job.lease_expires_at = None
    job.next_retry_at = None
    if status in (IgSyncStatus.succeeded, IgSyncStatus.partially_succeeded):
        job.progress, job.progress_stage = 100, "done"


def backoff_seconds(settings: Settings, attempt: int, retry_after: int | None = None, *, category: str = "") -> float:
    """Exponential backoff with ±20 % jitter, capped; rate limits wait at least the hinted time (or 5× base)."""
    delay = min(settings.instagram_job_retry_max_seconds, settings.instagram_job_retry_base_seconds * (2 ** attempt))
    delay *= random.uniform(0.8, 1.2)
    if category == "rate_limited":
        delay = max(delay, retry_after or settings.instagram_job_retry_base_seconds * 5)
    return float(min(max(delay, 1.0), max(settings.instagram_job_retry_max_seconds, retry_after or 0)))


def _fail(job: InstagramSyncRun, connection: InstagramConnection, category: str, message: str, *,
          retry_after: int | None = None, settings: Settings | None = None) -> float | None:
    """Terminal failure, or schedule a retry. Returns the retry delay (seconds) when retrying."""
    if category in RETRYABLE and settings is not None and job.retry_count < job.max_retries:
        delay = backoff_seconds(settings, job.retry_count, retry_after, category=category)
        job.status = IgSyncStatus.retrying
        job.retry_count += 1
        job.next_retry_at = utcnow() + timedelta(seconds=delay)
        job.lease_expires_at = None
        job.error_category, job.error_message = category, f"{message} Retry {job.retry_count} of {job.max_retries} is scheduled."
        connection.last_sync_status = IgSyncStatus.retrying.value
        return delay
    _finish(job, IgSyncStatus.failed, category=category, message=message)
    connection.last_sync_status = IgSyncStatus.failed.value
    if category in REAUTH:
        mark_needs_reauth(connection, category, message)
    else:
        connection.status = IgConnectionStatus.error
        connection.last_error_code, connection.last_error_message = category, message
    return None


# -------------------------------------------------------------------------- app-wide pause
def pause_app(db: Session, settings: Settings, *, retry_after: int | None) -> None:
    until = utcnow() + timedelta(seconds=retry_after or settings.instagram_job_retry_base_seconds * 5)
    db.execute(insert(WorkerHeartbeat).values(name=APP_PAUSE_KEY, last_seen_at=until, detail={"reason": "app_rate_limit"})
               .on_conflict_do_update(index_elements=["name"], set_={"last_seen_at": until}))


def app_pause_until(db: Session) -> datetime | None:
    until = db.scalar(select(WorkerHeartbeat.last_seen_at).where(WorkerHeartbeat.name == APP_PAUSE_KEY))
    return until if until is not None and until > utcnow() else None


# --------------------------------------------------------------------- recovery & dispatch
def reap_stale_jobs(db: Session) -> int:
    """Running jobs whose lease expired (worker died) → retrying now, or failed once retries are exhausted."""
    now = utcnow()
    stale = list(db.scalars(select(InstagramSyncRun).where(
        InstagramSyncRun.status == IgSyncStatus.running, InstagramSyncRun.lease_expires_at < now).with_for_update(skip_locked=True)))
    for job in stale:
        connection = db.get(InstagramConnection, job.connection_id)
        if job.retry_count < job.max_retries:
            job.status, job.retry_count, job.next_retry_at, job.lease_expires_at = IgSyncStatus.retrying, job.retry_count + 1, now, None
            job.error_category = "worker_lost"
            job.error_message = f"The worker stopped while syncing; retry {job.retry_count} of {job.max_retries} is scheduled."
        else:
            _finish(job, IgSyncStatus.failed, category="worker_lost", message="The worker stopped repeatedly while syncing.")
            if connection is not None:
                connection.last_sync_status = IgSyncStatus.failed.value
        logger.warning("recovered stale sync job job=%s retry_count=%s", job.id, job.retry_count)
    db.commit()
    return len(stale)


def dispatch_due_jobs(db: Session, dispatcher: Dispatcher, *, limit: int = 100) -> int:
    """Re-send jobs whose message may have been lost (queued, unclaimed) and retrying jobs that are due."""
    now = utcnow()
    ids = list(db.scalars(select(InstagramSyncRun.id).where(or_(
        and_(InstagramSyncRun.status == IgSyncStatus.queued, InstagramSyncRun.queued_at < now - UNDELIVERED_AFTER),
        and_(InstagramSyncRun.status == IgSyncStatus.retrying, InstagramSyncRun.next_retry_at <= now),
    )).order_by(InstagramSyncRun.queued_at).limit(limit)))
    for job_id in ids:
        dispatcher(job_id, 0.0)
    return len(ids)


# --------------------------------------------------------------------------------- schedule
def schedule_due_syncs(db: Session, settings: Settings, dispatcher: Dispatcher) -> int:
    """Create scheduled jobs for connected accounts whose interval elapsed (bounded batch, oldest first).
    A transaction-level advisory lock makes concurrent scheduler ticks (e.g. two beat processes) harmless, and
    the one-active-job index would reject duplicates anyway."""
    if not settings.sync_scheduler_enabled or not settings.instagram_enabled:
        return 0
    if not db.execute(text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": SCHEDULER_LOCK}).scalar():
        return 0
    if app_pause_until(db) is not None:
        db.commit()
        return 0
    cutoff = utcnow() - timedelta(minutes=settings.instagram_sync_interval_minutes)
    has_active = select(InstagramSyncRun.id).where(InstagramSyncRun.connection_id == InstagramConnection.id,
                                                   InstagramSyncRun.status.in_(ACTIVE_JOB_STATES)).exists()
    due = list(db.scalars(select(InstagramConnection).where(
        InstagramConnection.status.in_((IgConnectionStatus.connected, IgConnectionStatus.error)),  # skip needs_reauth & disconnected
        or_(InstagramConnection.last_sync_attempt_at.is_(None), InstagramConnection.last_sync_attempt_at < cutoff),
        ~has_active,
    ).order_by(InstagramConnection.last_sync_attempt_at.asc().nulls_first()).limit(settings.instagram_scheduler_batch_size)))
    created: list[str] = []
    for connection in due:
        result = enqueue(db, settings, connection, trigger="scheduled", member_id=None)
        if result.created:
            created.append(result.job.id)
    db.commit()
    for job_id in created:
        dispatcher(job_id, 0.0)
    return len(created)


def record_heartbeat(db: Session, name: str, detail: dict | None = None) -> None:
    now = utcnow()
    db.execute(insert(WorkerHeartbeat).values(name=name, last_seen_at=now, detail=detail or {})
               .on_conflict_do_update(index_elements=["name"], set_={"last_seen_at": now, "detail": detail or {}}))
    db.commit()


# ----------------------------------------------------------------------------------- status
def sync_status(db: Session, settings: Settings, connection: InstagramConnection) -> dict:
    active = _active_job(db, connection.id)
    last = db.scalar(select(InstagramSyncRun).where(InstagramSyncRun.connection_id == connection.id,
                                                    InstagramSyncRun.status.not_in(ACTIVE_JOB_STATES))
                     .order_by(InstagramSyncRun.finished_at.desc().nulls_last()).limit(1))
    schedulable = connection.status in (IgConnectionStatus.connected, IgConnectionStatus.error)
    next_at: datetime | None = None
    if settings.sync_scheduler_enabled and settings.redis_url and schedulable and active is None:
        base = connection.last_sync_attempt_at
        next_at = (base + timedelta(minutes=settings.instagram_sync_interval_minutes)) if base else utcnow()
    return {"active": active, "last": last, "next_at": next_at, "schedulable": schedulable}


def get_job(db: Session, job_id: str) -> InstagramSyncRun:
    job = db.get(InstagramSyncRun, job_id)  # tenant-filtered: another workspace's job does not exist here
    if job is None:
        raise NotFoundError("Sync job", job_id)
    return job
