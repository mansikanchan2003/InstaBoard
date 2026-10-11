"""Operational status for workspace owners/admins (``settings:manage``), scoped to the caller's workspace.

    GET /ops/status   job counts by status (24 h), average job duration, last sync success/failure per account,
                      AI usage/failures/latency this month, worker/scheduler heartbeats, app-wide rate-limit pause.

No secrets, prompts or payloads — counts, timestamps and categories only.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Request
from sqlalchemy import func, select

from app.ai.service import usage_this_period
from app.api.deps import DB, Ctx, require
from app.models import AIJob, InstagramConnection, InstagramSyncRun, WorkerHeartbeat
from app.models.enums import IgConnectionStatus
from app.services.common import utcnow
from app.services.instagram.jobs import APP_PAUSE_KEY

ops = APIRouter(prefix="/ops", tags=["operations"])


def _job_stats(db, model, started_col, finished_col, since) -> dict:
    by_status = dict(db.execute(select(model.status, func.count()).where(model.queued_at >= since).group_by(model.status)).all())
    avg = db.scalar(select(func.avg(func.extract("epoch", finished_col - started_col))).where(
        model.queued_at >= since, finished_col.is_not(None), started_col.is_not(None)))
    return {"byStatus": {getattr(k, "value", k): v for k, v in by_status.items()}, "avgDurationSeconds": round(float(avg), 2) if avg else None}


@ops.get("/status", summary="Operational status of background work for this workspace")
def ops_status(request: Request, db: DB, ctx: Ctx, _perm=require("settings:manage")):
    now = utcnow()
    since = now - timedelta(hours=24)
    heartbeats = {h.name: h.last_seen_at.isoformat() for h in db.scalars(select(WorkerHeartbeat))}
    accounts = [{
        "id": c.id, "username": c.username, "status": c.status.value, "lastSyncedAt": c.last_synced_at.isoformat() if c.last_synced_at else None,
        "lastSyncAttemptAt": c.last_sync_attempt_at.isoformat() if c.last_sync_attempt_at else None, "lastSyncStatus": c.last_sync_status,
        "lastErrorCode": c.last_error_code,
    } for c in db.scalars(select(InstagramConnection).where(InstagramConnection.status != IgConnectionStatus.disconnected))]
    usage = usage_this_period(db, ctx.workspace_id)
    return {
        "generatedAt": now.isoformat(),
        "syncJobs24h": _job_stats(db, InstagramSyncRun, InstagramSyncRun.started_at, InstagramSyncRun.finished_at, since),
        "aiJobs24h": _job_stats(db, AIJob, AIJob.started_at, AIJob.finished_at, since),
        "accounts": accounts,
        "ai": {"enabled": request.app.state.settings.ai_enabled, "tokensMonth": usage["tokens_month"], "requestsMonth": usage["requests_month"],
               "failuresMonth": usage["failures_month"], "avgLatencyMs": usage["avg_latency_ms"]},
        "background": {"configured": bool(request.app.state.settings.redis_url), "workerLastSeen": heartbeats.get("worker"),
                       "schedulerLastSeen": heartbeats.get("scheduler"), "appRateLimitPausedUntil": heartbeats.get(APP_PAUSE_KEY)},
    }
