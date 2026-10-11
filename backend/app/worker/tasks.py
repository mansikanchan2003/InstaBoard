"""Celery tasks — thin wrappers around ``app.services.instagram.jobs`` (all logic is testable without Celery)."""

from __future__ import annotations

import logging
import os
import socket
from functools import lru_cache

from celery.signals import setup_logging, worker_ready

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.services.instagram import jobs
from app.services.instagram.crypto import TokenCipher
from app.services.instagram.provider import InstagramClient

from app.core.logging import configure_logging, job_id_var
from app.services import housekeeping
from app.services.intelligence import jobs as ai_jobs

from .celery_app import TASK_MAINTENANCE, TASK_RUN_JOB, TASK_SCHEDULE, celery_app
from .queue import TASK_AI_JOB, TASK_AI_SCHEDULE

logger = logging.getLogger("instaboard.worker")


@lru_cache
def _session_factory():
    return build_session_factory(build_engine(get_settings()))


def celery_dispatcher(job_id: str, countdown: float = 0.0) -> None:
    task = TASK_AI_JOB if job_id.startswith("aij_") else TASK_RUN_JOB
    celery_app.send_task(task, args=[job_id], countdown=max(0.0, countdown))


@celery_app.task(name=TASK_AI_JOB, ignore_result=True)
def run_ai_job(job_id: str) -> str:
    token = job_id_var.set(job_id)
    try:
        return ai_jobs.execute_ai_job(_session_factory(), get_settings(), dispatcher=celery_dispatcher, job_id=job_id)
    finally:
        job_id_var.reset(token)


@celery_app.task(name=TASK_AI_SCHEDULE, ignore_result=True)
def schedule_ai_insights() -> int:
    with _session_factory()() as db:
        return ai_jobs.schedule_insights(db, get_settings(), celery_dispatcher)


@celery_app.task(name=TASK_RUN_JOB, ignore_result=True)
def run_sync_job(job_id: str) -> str:
    token = job_id_var.set(job_id)
    try:
        return _run_sync_job(job_id)
    finally:
        job_id_var.reset(token)


def _run_sync_job(job_id: str) -> str:
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
        reaped = jobs.reap_stale_jobs(db) + ai_jobs.reap_stale_ai_jobs(db)
        dispatched = jobs.dispatch_due_jobs(db, celery_dispatcher) + ai_jobs.dispatch_due_ai_jobs(db, celery_dispatcher)
        cleaned = housekeeping.run(db)
        jobs.record_heartbeat(db, "worker", {"reaped": reaped, "dispatched": dispatched, "cleaned": cleaned, "host": socket.gethostname(), "pid": os.getpid()})
    return {"reaped": reaped, "dispatched": dispatched, "cleaned": cleaned}


@setup_logging.connect
def _configure_logging(**_kwargs) -> None:
    # Same structured, redacting logging as the API (Celery's own handlers are not installed).
    settings = get_settings()
    configure_logging(fmt=settings.log_format, level=settings.log_level)


@worker_ready.connect
def _on_worker_ready(**_kwargs) -> None:
    # Recover anything a previous worker left running, then record liveness.
    with _session_factory()() as db:
        jobs.reap_stale_jobs(db)
        jobs.record_heartbeat(db, "worker", {"event": "started", "host": socket.gethostname(), "pid": os.getpid()})
