"""AI intelligence and deterministic analytics routes (all workspace-scoped, behind ``require_auth``).

    GET  /analytics/campaigns?start&end            deterministic metrics, comparisons, definitions (works with AI off)
    GET  /ai/status                                enabled/provider/model, usage this period, limits (no secrets)
    GET  /ai/jobs · GET /ai/jobs/{id} · POST /ai/jobs/{id}/cancel
    POST /ai/comments/classify                     write · 202 queued job (idempotent)
    GET  /ai/comments/classifications              latest classification per comment
    PATCH /ai/comments/classifications/{id}        write · human review (confirm / correct)
    GET  /ai/leads/priorities                      deterministic follow-up priorities
    POST /ai/leads/{lead_id}/summary               write · 202 queued job · GET returns the latest summary
Insight generation reuses ``POST /insights/regenerate`` (see engagement routes).
"""

from __future__ import annotations

import hashlib
from datetime import date

from fastapi import APIRouter, Path, Query, Request
from sqlalchemy import select

from app.ai.service import usage_this_period
from app.api.deps import DB, Ctx, commit, require
from app.models import AIJob
from app.models.enums import AIJobKind
from app.schemas import ai as s
from app.services.intelligence import analytics, comments as comment_ai, jobs as ai_jobs, leads as lead_ai

ai = APIRouter(prefix="/ai", tags=["ai intelligence"])
analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])

JobId = lambda: Path(min_length=4, max_length=64, pattern=r"^aij_[a-f0-9]+$")  # noqa: E731
LeadId = lambda: Path(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.\-]+$")  # noqa: E731


def job_out(j: AIJob) -> s.AIJobOut:
    return s.AIJobOut(id=j.id, kind=j.kind.value, status=j.status.value, terminal=j.status.value in ai_jobs.TERMINAL, trigger=j.trigger, params=j.params,
                      queued_at=j.queued_at, started_at=j.started_at, finished_at=j.finished_at, progress=j.progress, progress_stage=j.progress_stage,
                      result=j.result or {}, retry_count=j.retry_count, max_retries=j.max_retries, next_retry_at=j.next_retry_at,
                      error_category=j.error_category, error_message=j.error_message)


def require_dispatcher(request: Request):
    """AI jobs run on the background worker; without a broker nothing would ever execute them."""
    dispatcher = getattr(request.app.state, "job_dispatcher", None)
    if dispatcher is None:
        from app.services.instagram.jobs import SyncUnavailableError

        raise SyncUnavailableError()
    return dispatcher


def queue(request: Request, db, *, ctx, kind: AIJobKind, params: dict, key: str) -> s.EnqueuedAIJobOut:
    if not request.app.state.settings.ai_enabled:  # most informative error first
        raise ai_jobs.AIUnavailableApiError(ai_jobs.AIDisabledError.message)
    dispatcher = require_dispatcher(request)
    job, created = ai_jobs.enqueue(db, request.app.state.settings, workspace_id=ctx.workspace_id, kind=kind, params=params,
                                   idempotency_key=key, member_id=ctx.member_id)
    db.commit()
    if created:
        dispatcher(job.id, 0.0)
    return s.EnqueuedAIJobOut(job=job_out(job), deduplicated=not created)


def enqueue_insights(request: Request, db, ctx, start: date | None, end: date | None) -> s.EnqueuedAIJobOut:
    start, end = analytics.resolve_period(db, start, end, max_days=request.app.state.settings.ai_analysis_max_days)
    return queue(request, db, ctx=ctx, kind=AIJobKind.insights, params={"start": str(start), "end": str(end)}, key=f"insights:{start}:{end}")


# ---------------------------------------------------------------------------- analytics
@analytics_router.get("/campaigns", summary="Deterministic campaign analytics for a period (no AI involved)")
def campaign_analytics(request: Request, db: DB, start: date | None = None, end: date | None = None):
    start, end = analytics.resolve_period(db, start, end, max_days=request.app.state.settings.ai_analysis_max_days)
    return analytics.campaign_report(db, start, end).as_dict()


# ------------------------------------------------------------------------------- status
@ai.get("/status", response_model=s.AIStatusOut)
def ai_status(request: Request, db: DB, ctx: Ctx):
    st = request.app.state.settings
    return s.AIStatusOut(
        enabled=st.ai_enabled, provider=st.ai_provider, model=st.ai_model if st.ai_enabled else None,
        capabilities=["insights", "comment_classification", "lead_summary"] if st.ai_enabled else [],
        usage={"".join(w if i == 0 else w.title() for i, w in enumerate(k.split("_"))): v for k, v in usage_this_period(db, ctx.workspace_id).items()},
        limits={"monthlyTokens": st.ai_monthly_token_limit or None, "dailyRequests": st.ai_daily_request_limit or None,
                "commentBatchSize": st.ai_comment_batch_size, "commentsPerJob": st.ai_comment_job_limit, "maxPeriodDays": st.ai_analysis_max_days},
        limits_note="Limits are enforced by InstaBoard on provider-reported token usage before each request; they are not a provider-side spending cap.",
        scheduled_insights=st.ai_enabled and st.ai_scheduled_insights_enabled,
    )


# --------------------------------------------------------------------------------- jobs
@ai.get("/jobs", response_model=list[s.AIJobOut])
def list_jobs(db: DB, kind: AIJobKind | None = None, limit: int = Query(20, ge=1, le=100)):
    query = select(AIJob).order_by(AIJob.queued_at.desc()).limit(limit)
    if kind:
        query = query.where(AIJob.kind == kind)
    return [job_out(j) for j in db.scalars(query)]


@ai.get("/jobs/{job_id}", response_model=s.AIJobOut)
def get_job(db: DB, job_id: str = JobId()):
    return job_out(ai_jobs.get_job(db, job_id))


@ai.post("/jobs/{job_id}/cancel", response_model=s.AIJobOut)
def cancel_job(db: DB, job_id: str = JobId(), _perm=require("write")):
    return commit(db, job_out(ai_jobs.cancel(db, ai_jobs.get_job(db, job_id))))


# ----------------------------------------------------------------------------- comments
@ai.post("/comments/classify", response_model=s.EnqueuedAIJobOut, status_code=202)
def classify_comments(request: Request, db: DB, ctx: Ctx, body: s.ClassifyRequestIn, _perm=require("write")):
    ids = sorted(set(body.comment_ids or []))
    key = f"comments:{body.source}:" + (hashlib.sha256(",".join(ids).encode()).hexdigest()[:24] if ids else "pending")
    return queue(request, db, ctx=ctx, kind=AIJobKind.comment_classification, params={"source": body.source, "commentIds": ids or None}, key=key)


def classification_out(c) -> s.ClassificationOut:
    prediction = {"sentiment": c.sentiment, "intent": c.intent, "leadSignal": c.lead_signal, "priority": c.priority,
                  "uncertainty": c.uncertainty, "explanation": c.explanation}
    reviewed = None
    if c.review_status == "corrected":
        reviewed = {"sentiment": c.reviewed_sentiment, "intent": c.reviewed_intent, "leadSignal": c.reviewed_lead_signal}
    effective = dict(prediction)
    if reviewed:
        effective.update({k: v for k, v in reviewed.items() if v is not None})
    return s.ClassificationOut(id=c.id, source=c.source, comment_id=c.comment_id, classifier_version=c.classifier_version, prediction=prediction,
                               injection_suspected=c.injection_suspected, review_status=c.review_status, reviewed=reviewed, reviewed_at=c.reviewed_at,
                               effective=effective, created_at=c.created_at)


@ai.get("/comments/classifications", response_model=list[s.ClassificationOut])
def list_classifications(db: DB, source: str = Query("workspace", pattern="^(workspace|instagram)$"),
                         comment_ids: str | None = Query(None, alias="commentIds", max_length=4000),
                         review_status: str | None = Query(None, alias="reviewStatus", pattern="^(unreviewed|confirmed|corrected)$"),
                         limit: int = Query(200, ge=1, le=500)):
    ids = [i for i in (comment_ids or "").split(",") if i][:200] or None
    return [classification_out(c) for c in comment_ai.latest_for(db, source, ids, review_status, limit)]


@ai.patch("/comments/classifications/{classification_id}", response_model=s.ClassificationOut)
def review_classification(db: DB, ctx: Ctx, body: s.ClassificationReviewIn,
                          classification_id: str = Path(min_length=4, max_length=64, pattern=r"^cls_[a-f0-9]+$"), _perm=require("write")):
    row = comment_ai.review(db, classification_id, member_id=ctx.member_id, status=body.review_status, sentiment=body.sentiment,
                            intent=body.intent, lead_signal=body.lead_signal)
    return commit(db, classification_out(row))


# -------------------------------------------------------------------------------- leads
@ai.get("/leads/priorities", summary="Deterministic follow-up priorities (no AI)")
def lead_priorities(db: DB):
    return lead_ai.priorities(db)


@ai.post("/leads/{lead_id}/summary", response_model=s.EnqueuedAIJobOut, status_code=202)
def request_lead_summary(request: Request, db: DB, ctx: Ctx, lead_id: str = LeadId(), _perm=require("write")):
    lead_ai.latest_summary(db, lead_id)  # 404 for unknown / other-workspace leads
    return queue(request, db, ctx=ctx, kind=AIJobKind.lead_summary, params={"leadId": lead_id}, key=f"lead:{lead_id}")


@ai.get("/leads/{lead_id}/summary", response_model=s.LeadSummaryOut | None)
def get_lead_summary(db: DB, lead_id: str = LeadId()):
    row = lead_ai.latest_summary(db, lead_id)
    if row is None:
        return None
    return s.LeadSummaryOut(id=row.id, lead_id=row.lead_id, summary=row.summary, follow_up_reason=row.follow_up_reason,
                            suggested_next_action=row.suggested_next_action, uncertainty=row.uncertainty,
                            injection_suspected=row.injection_suspected, version=row.version, created_at=row.created_at)

