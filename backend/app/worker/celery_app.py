"""Celery application for background Instagram syncs.

Run from ``backend/`` (Redis must be running and ``REDIS_URL`` set in ``backend/.env``)::

    celery -A app.worker.celery_app worker --loglevel=INFO --concurrency=2     # Linux/macOS (prefork)
    celery -A app.worker.celery_app worker --loglevel=INFO --pool=threads --concurrency=2   # Windows
    celery -A app.worker.celery_app beat --loglevel=INFO --schedule=.celerybeat/schedule   # run exactly ONE beat

Design: PostgreSQL job rows are the source of truth; Redis messages only say "job X is ready". Tasks are
acknowledged late and re-queued if a worker dies (``acks_late`` + ``reject_on_worker_lost``); a second delivery
is harmless because a job must be claimed atomically in the database before any work starts.
"""

from __future__ import annotations

from app.core.config import get_settings

from .queue import TASK_MAINTENANCE, TASK_RUN_JOB, TASK_SCHEDULE, build_celery  # noqa: F401 (re-exported)

_settings = get_settings()
celery_app = build_celery(_settings.redis_url, tick_seconds=_settings.instagram_scheduler_tick_seconds,
                          concurrency=_settings.instagram_worker_concurrency)
