"""Celery factory, task names and the dispatcher used by the API (no settings are read at import time)."""

from __future__ import annotations

import logging

from celery import Celery

logger = logging.getLogger("instaboard.queue")


TASK_RUN_JOB = "instaboard.instagram.run_sync_job"
TASK_SCHEDULE = "instaboard.instagram.schedule_syncs"
TASK_MAINTENANCE = "instaboard.instagram.maintenance"
TASK_AI_JOB = "instaboard.ai.run_job"
TASK_AI_SCHEDULE = "instaboard.ai.schedule_insights"


def build_celery(redis_url: str | None, *, tick_seconds: int = 300, concurrency: int = 2) -> Celery:
    app = Celery("instaboard", broker=redis_url or "memory://", include=["app.worker.tasks"])
    app.conf.update(
        task_ignore_result=True,          # results live in PostgreSQL job rows
        task_acks_late=True,              # ack after the task finished …
        task_reject_on_worker_lost=True,  # … and re-queue if the worker process died mid-task
        worker_prefetch_multiplier=1,     # don't hoard jobs on one worker
        worker_concurrency=concurrency,
        task_default_queue="instaboard",
        task_time_limit=30 * 60,
        task_soft_time_limit=25 * 60,
        broker_connection_retry_on_startup=True,
        # Publishing must not block an API request for long when Redis is down (the job row is already durable).
        task_publish_retry_policy={"max_retries": 2, "interval_start": 0, "interval_step": 0.5, "interval_max": 1},
        broker_transport_options={"visibility_timeout": 60 * 60},  # > task_time_limit
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            "instagram-schedule-syncs": {"task": TASK_SCHEDULE, "schedule": float(tick_seconds)},
            "instagram-maintenance": {"task": TASK_MAINTENANCE, "schedule": 60.0},
            "ai-schedule-insights": {"task": TASK_AI_SCHEDULE, "schedule": 24 * 3600.0},
        },
    )
    return app



def make_dispatcher(redis_url: str | None):
    """API-side dispatcher: publishes "job X is ready" to Redis. None when no broker is configured."""
    if not redis_url:
        return None
    producer = build_celery(redis_url)

    def dispatch(job_id: str, countdown: float = 0.0) -> None:
        task = TASK_AI_JOB if job_id.startswith("aij_") else TASK_RUN_JOB  # AI jobs and sync jobs share the worker
        try:
            producer.send_task(task, args=[job_id], countdown=max(0.0, countdown))
        except Exception as exc:  # noqa: BLE001 — broker down: the queued job is re-sent by the maintenance task
            logger.warning("Could not publish sync job %s (%s); it stays queued and will be re-dispatched.", job_id, exc.__class__.__name__)

    return dispatch
