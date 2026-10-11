"""Celery configuration and task registration (no broker needed)."""

from __future__ import annotations

import pytest

from app.worker.queue import TASK_AI_JOB, TASK_AI_SCHEDULE, TASK_MAINTENANCE, TASK_RUN_JOB, TASK_SCHEDULE, build_celery, make_dispatcher


def test_celery_is_configured_for_safe_redelivery_and_utc_scheduling():
    app = build_celery("redis://localhost:6379/0", tick_seconds=300, concurrency=2)
    conf = app.conf
    assert conf.task_acks_late and conf.task_reject_on_worker_lost and conf.worker_prefetch_multiplier == 1
    assert conf.timezone == "UTC" and conf.enable_utc
    assert conf.task_ignore_result  # job state lives in PostgreSQL
    assert conf.broker_transport_options["visibility_timeout"] > conf.task_time_limit
    schedule = {entry["task"]: entry["schedule"] for entry in conf.beat_schedule.values()}
    assert schedule == {TASK_SCHEDULE: 300.0, TASK_MAINTENANCE: 60.0, TASK_AI_SCHEDULE: 86400.0}


def test_no_dispatcher_without_a_broker():
    assert make_dispatcher(None) is None
    assert callable(make_dispatcher("redis://localhost:6379/0"))


def test_tasks_are_registered(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@127.0.0.1:1/x")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        tasks = pytest.importorskip("app.worker.tasks")
        registered = set(tasks.celery_app.tasks.keys())
        assert {TASK_RUN_JOB, TASK_SCHEDULE, TASK_MAINTENANCE, TASK_AI_JOB, TASK_AI_SCHEDULE} <= registered
    finally:
        get_settings.cache_clear()
