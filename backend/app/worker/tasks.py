"""Celery tasks — thin wrappers around ``app.services.instagram.jobs`` (all logic is testable without Celery)."""

from __future__ import annotations

import logging
import os
import socket
from functools import lru_cache

from celery.signals import worker_ready

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.services.instagram import jobs
from app.services.instagram.crypto import TokenCipher
from app.services.instagram.provider import InstagramClient

from .celery_app import TASK_MAINTENANCE, TASK_RUN_JOB, TASK_SCHEDULE, celery_app

logger = logging.getLogger("instaboard.worker")


@lru_cache
def _session_factory():
    return build_session_factory(build_engine(get_settings()))


def celery_dispatcher(job_id: str, countdown: float = 0.0) -> None:
    celery_app.send_task(TASK_RUN_JOB, args=[job_id], countdown=max(0.0, countdown))


@celery_app.task(name=TASK_RUN_JOB, ignore_result=True)
def run_sync_job(job_id: str) -> str:
    settings = get_settings()
    if not settings.instagram_enabled:
        logger.warning("Instagram integration disabled; job %s left queued", job_id)
        return "disabled"
    return jobs.execute_job(
        _session_factory(), settings,
        client_factory=lambda: InstagramClient(settings), cipher_factory=lambda: TokenCipher.from_settings(settings),
        dispatcher=celery_dispatcher, job_id=job_id,
    )


@celery_app.task(name=TASK_SCHEDULE, ignore_result=True)
def schedule_syncs() -> int:
    settings = get_settings()
    with _session_factory()() as db:
        created = jobs.schedule_due_syncs(db, settings, celery_dispatcher)
        jobs.record_heartbeat(db, "scheduler", {"created": created, "host": socket.gethostname()})
    return created


@celery_app.task(name=TASK_MAINTENANCE, ignore_result=True)
def maintenance() -> dict:
    with _session_factory()() as db:
        reaped = jobs.reap_stale_jobs(db)
        dispatched = jobs.dispatch_due_jobs(db, celery_dispatcher)
        jobs.record_heartbeat(db, "worker", {"reaped": reaped, "dispatched": dispatched, "host": socket.gethostname(), "pid": os.getpid()})
    return {"reaped": reaped, "dispatched": dispatched}


@worker_ready.connect
def _on_worker_ready(**_kwargs) -> None:
    # Recover anything a previous worker left running, then record liveness.
    with _session_factory()() as db:
        jobs.reap_stale_jobs(db)
        jobs.record_heartbeat(db, "worker", {"event": "started", "host": socket.gethostname(), "pid": os.getpid()})
