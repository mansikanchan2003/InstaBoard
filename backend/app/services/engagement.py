"""Comments, AI insights (stored output), reports, notifications, activity log, settings, team."""

from __future__ import annotations

import secrets
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import delete, distinct, func, select, update
from sqlalchemy.orm import Session

from app.core.errors import ApiError, ConflictError, NotFoundError, NotImplementedInPhaseError
from app.models import (
    ActivityActor,
    ActivityEvent,
    Campaign,
    Comment,
    CommentPeriodSummary,
    CommentSentimentDaily,
    ContentItem,
    Insight,
    InstagramAccount,
    Lead,
    Notification,
    RecommendedAction,
    Report,
    ReportCampaign,
    ReportContentItem,
    TeamMember,
    WorkspaceSettings,
)
from app.models.enums import ActivityOutcome, CommentStatus, ReportStatus
from app.schemas import engagement as s
from app.schemas.base import ev, num
from app.schemas.core import TeamMemberOut
from app.schemas.inputs import TeamAccessIn, TeamInviteIn, WorkspaceSettingsIn

from .common import IST, current_workspace, day_label, iso_ist, ist_wallclock, reference, session_member, utcnow
from .core import member_out

# ====================================================================================== comments


def comment_out(c: Comment) -> s.InstagramCommentOut:
    return s.InstagramCommentOut(
        id=c.id, ref=c.ref, author_name=c.author_name, handle=c.handle, location=c.location, verified=c.verified, text=c.text,
        highlights=c.highlights, content_id=c.content_id, campaign_id=c.campaign_id, account_id=c.account_id,
        received_at=iso_ist(c.received_at), received_label=c.received_label, surface=c.surface, language=c.language,
        sentiment=ev(c.sentiment), intent=ev(c.intent), lead_potential=ev(c.lead_potential), intent_score=c.intent_score,
        status=ev(c.status), flagged=c.flagged, lead_id=c.lead_id, suggested_reply=c.suggested_reply, ai=c.ai,
    )


def _comment_summary_row(db: Session) -> CommentPeriodSummary:
    ws = current_workspace(db)
    row = db.scalar(select(CommentPeriodSummary).where(CommentPeriodSummary.period_start == ws.reporting_start).limit(1))
    if row is None:
        raise NotFoundError("Comment summary", ws.reporting_start.isoformat())
    return row


def comment_summary(db: Session) -> s.CommentSummaryOut:
    row = _comment_summary_row(db)
    awaiting_now = db.scalar(
        select(func.count()).select_from(Comment).where(Comment.account_id == row.account_id, Comment.status == CommentStatus.needs_response)
    ) or 0
    # Period total minus sampled comments triaged since import (same rule as the demo service).
    needs_response = max(0, row.needs_response_total - (row.needs_response_sample_baseline - awaiting_now))
    return s.CommentSummaryOut(
        account_id=row.account_id, period={"start": row.period_start.isoformat(), "end": row.period_end.isoformat()},
        total_comments=row.total_comments, total_delta_pct=num(row.total_delta_pct), baseline_comments=row.baseline_comments,
        sentiment=s.SentimentTotalsOut(positive=row.sentiment_positive, neutral=row.sentiment_neutral, negative=row.sentiment_negative),
        potential_leads=row.potential_leads, potential_leads_delta_label=row.potential_leads_delta_label, needs_response=needs_response,
        responded=row.responded, resolved=row.resolved, avg_sentiment_score=num(row.avg_sentiment_score),
        avg_sentiment_delta_pts=num(row.avg_sentiment_delta_pts), classification_confidence=num(row.classification_confidence),
        intents=row.intents, response_queue=row.response_queue, strategic_intel=row.strategic_intel,
        strategic_intel_confidence=num(row.strategic_intel_confidence), peak_note=row.peak_note,
    )


def sentiment_trend(db: Session) -> list[s.SentimentTrendPointOut]:
    ws = current_workspace(db)
    rows = db.scalars(select(CommentSentimentDaily).where(CommentSentimentDaily.day.between(ws.reporting_start, ws.reporting_end)).order_by(CommentSentimentDaily.day))
    return [s.SentimentTrendPointOut(date=day_label(r.day), positive=r.positive, neutral=r.neutral, negative=r.negative, score=num(r.score)) for r in rows]


def list_comments(db: Session, *, status: str | None = None, sentiment: str | None = None, intent: str | None = None,
                  content_id: str | None = None, campaign_id: str | None = None) -> s.CommentListOut:
    query = select(Comment).order_by(Comment.position, Comment.received_at.desc())
    for column, value in ((Comment.status, status), (Comment.sentiment, sentiment), (Comment.intent, intent),
                          (Comment.content_id, content_id), (Comment.campaign_id, campaign_id)):
        if value:
            query = query.where(column == value)
    items = [comment_out(c) for c in db.scalars(query)]
    sample_size = db.scalar(select(func.count()).select_from(Comment)) or 0
    try:
        total = _comment_summary_row(db).total_comments
    except NotFoundError:
        total = sample_size
    return s.CommentListOut(items=items, sample_size=sample_size, total_comments=total)


def _get_comment(db: Session, comment_id: str) -> Comment:
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise NotFoundError("Comment", comment_id)
    return comment


def get_comment(db: Session, comment_id: str) -> s.InstagramCommentOut:
    return comment_out(_get_comment(db, comment_id))


def update_comment(db: Session, comment_id: str, body: s.CommentPatchIn) -> s.InstagramCommentOut:
    comment = _get_comment(db, comment_id)
    patch = body.model_dump(exclude_unset=True)
    if patch.get("lead_id") and db.get(Lead, patch["lead_id"]) is None:
        raise NotFoundError("Lead", patch["lead_id"])
    if "status" in patch and patch["status"] is None or "flagged" in patch and patch["flagged"] is None:
        raise ApiError("status / flagged cannot be null")
    for key, value in patch.items():
        setattr(comment, key, value)
    db.flush()
    return comment_out(comment)


def bulk_comment_status(db: Session, body: s.CommentBulkIn) -> s.UpdatedCountOut:
    result = db.execute(update(Comment).where(Comment.id.in_(body.ids)).values(status=body.status))
    return s.UpdatedCountOut(updated=result.rowcount or 0)


# ====================================================================================== insights


def insight_out(i: Insight) -> s.InsightOut:
    return s.InsightOut(
        id=i.id, category=ev(i.category), priority=ev(i.priority), confidence=i.confidence, title=i.title, observed=i.observed,
        interpretation=i.interpretation, impact=i.impact, primary_link=i.primary_link, generated_at=i.generated_label,
        status=ev(i.status), completed_step_ids=i.completed_step_ids, detail=i.detail,
    )


def action_out(a: RecommendedAction) -> s.RecommendedActionOut:
    return s.RecommendedActionOut(
        id=a.id, priority=ev(a.priority), title=a.title, rationale=a.rationale, metric=a.metric, metric_note=a.metric_note,
        metric_note_tone=a.metric_note_tone, impact=a.impact, target=a.target, insight_id=a.insight_id, status=ev(a.status), feedback=a.feedback,
    )


def list_insights(db: Session, *, category: str | None = None, priority: str | None = None, status: str | None = None) -> list[s.InsightOut]:
    query = select(Insight).order_by(Insight.position, Insight.id)
    for column, value in ((Insight.category, category), (Insight.priority, priority), (Insight.status, status)):
        if value:
            query = query.where(column == value)
    return [insight_out(i) for i in db.scalars(query)]


def _get_insight(db: Session, insight_id: str) -> Insight:
    insight = db.get(Insight, insight_id)
    if insight is None:
        raise NotFoundError("Insight", insight_id)
    return insight


def get_insight(db: Session, insight_id: str) -> s.InsightOut:
    return insight_out(_get_insight(db, insight_id))


def set_insight_status(db: Session, insight_id: str, body: s.InsightStatusIn) -> s.InsightOut:
    insight = _get_insight(db, insight_id)
    insight.status = body.status
    db.flush()
    return insight_out(insight)


def toggle_insight_step(db: Session, insight_id: str, step_id: str) -> s.InsightOut:
    insight = _get_insight(db, insight_id)
    steps = {step.get("id") for step in (insight.detail or {}).get("steps", [])}
    if step_id not in steps:
        raise NotFoundError("Action step", step_id)
    done = list(insight.completed_step_ids)
    insight.completed_step_ids = [x for x in done if x != step_id] if step_id in done else [*done, step_id]
    db.flush()
    return insight_out(insight)


def list_actions(db: Session) -> list[s.RecommendedActionOut]:
    return [action_out(a) for a in db.scalars(select(RecommendedAction).order_by(RecommendedAction.position, RecommendedAction.id))]


def set_action_status(db: Session, action_id: str, body: s.ActionStatusIn) -> s.RecommendedActionOut:
    action = db.get(RecommendedAction, action_id)
    if action is None:
        raise NotFoundError("Recommended action", action_id)
    action.status = body.status
    action.feedback = body.feedback
    db.flush()
    return action_out(action)


def review_all_actions(db: Session) -> s.UpdatedCountOut:
    result = db.execute(update(RecommendedAction).where(RecommendedAction.status == "pending_review").values(status="reviewed"))
    return s.UpdatedCountOut(updated=result.rowcount or 0)


def regenerate_insights() -> None:
    raise NotImplementedInPhaseError("Insight regeneration needs an AI provider, which is not configured in this phase. Stored insights are demonstration output.")


def insights_overview(db: Session) -> dict:
    return reference(db, "insights_overview")


def executive_brief(db: Session) -> dict:
    return reference(db, "executive_brief")


# ======================================================================================= reports

# Report numbers continue the seeded series (#REP-2024-884 …) so codes stay unique and sortable.
REPORT_SERIES = "2024"

REPORT_ICONS = {
    "campaign_performance": "description", "content_reel": "movie", "audience": "pie_chart", "comments_sentiment": "forum",
    "lead_generation": "contact_page", "executive_summary": "summarize",
}


def report_out(r: Report) -> s.ReportOut:
    return s.ReportOut(
        id=r.id, code=r.code, title=r.title, type=ev(r.type), scope=ev(r.scope), account_id=r.account_id,
        campaign_ids=[link.campaign_id for link in r.campaign_links],
        content_ids=[link.content_id for link in r.content_links] if r.has_content_focus else None,
        period={"start": r.period_start.isoformat(), "end": r.period_end.isoformat()}, metrics=r.metrics, sections=r.sections,
        compare_baseline=r.compare_baseline, formats=r.formats, schedule=ev(r.schedule), recipients=r.recipients, status=ev(r.status),
        icon=r.icon, generated_at=ist_wallclock(r.generated_at), generated_label=r.generated_label, created_by=r.created_by,
        next_run_label=r.next_run_label, failure_reason=r.failure_reason, narrative=r.narrative,
    )


def list_reports(db: Session, *, status: str | None = None, type_: str | None = None) -> list[s.ReportOut]:
    query = select(Report).order_by(Report.generated_at.desc(), Report.id)
    if status:
        query = query.where(Report.status == status)
    if type_:
        query = query.where(Report.type == type_)
    return [report_out(r) for r in db.scalars(query)]


def _get_report(db: Session, report_id: str) -> Report:
    report = db.get(Report, report_id)
    if report is None:
        raise NotFoundError("Report", report_id)
    return report


def get_report(db: Session, report_id: str) -> s.ReportOut:
    return report_out(_get_report(db, report_id))


def report_reference(db: Session) -> s.ReportReferenceOut:
    spend = {cid: amount for cid, amount in db.execute(select(Campaign.id, Campaign.boost_spend_inr).where(Campaign.boost_spend_inr.is_not(None)))}
    return s.ReportReferenceOut(boost_spend_inr=spend, cpl_benchmark_inr=reference(db, "report_reference")["cplBenchmarkInr"])


def _apply_report_config(db: Session, report: Report, body: s.ReportConfigIn) -> None:
    if db.get(InstagramAccount, body.account_id) is None:
        raise NotFoundError("Instagram account", body.account_id)
    known = set(db.scalars(select(Campaign.id).where(Campaign.id.in_(body.campaign_ids))))
    if missing := [cid for cid in body.campaign_ids if cid not in known]:
        raise NotFoundError("Campaign", missing[0])
    if body.content_ids:
        known_content = set(db.scalars(select(ContentItem.id).where(ContentItem.id.in_(body.content_ids))))
        if missing := [cid for cid in body.content_ids if cid not in known_content]:
            raise NotFoundError("Content", missing[0])
    report.title, report.type, report.scope, report.account_id = body.title.strip(), body.type, body.scope, body.account_id
    report.period_start, report.period_end = date.fromisoformat(body.period.start), date.fromisoformat(body.period.end)
    report.metrics, report.sections, report.formats = list(body.metrics), list(body.sections), list(body.formats)
    report.compare_baseline, report.schedule, report.recipients = body.compare_baseline, body.schedule, list(body.recipients)
    report.has_content_focus = body.content_ids is not None
    report.campaign_links = [ReportCampaign(campaign_id=cid, position=i) for i, cid in enumerate(dict.fromkeys(body.campaign_ids))]
    report.content_links = [ReportContentItem(content_id=cid, position=i) for i, cid in enumerate(dict.fromkeys(body.content_ids or []))]
    report.next_run_label = "Saved schedule — delivery requires a scheduler (not configured)" if body.schedule != "none" else None


def _next_report_number(db: Session) -> int:
    codes = db.scalars(select(Report.code)).all()
    return max((int("".join(ch for ch in code if ch.isdigit())[-3:]) for code in codes), default=0) + 1


def create_report(db: Session, body: s.ReportConfigIn) -> s.ReportOut:
    n = _next_report_number(db)
    report = Report(
        id=f"rep-{REPORT_SERIES}-{n}", code=f"#REP-{REPORT_SERIES}-{n}", status=ReportStatus.ready_demo, icon=REPORT_ICONS[body.type],
        generated_at=utcnow(), generated_label="Just now", created_by=session_member(db).name,
    )
    _apply_report_config(db, report, body)
    db.add(report)
    db.flush()
    return report_out(report)


def update_report(db: Session, report_id: str, body: s.ReportConfigIn) -> s.ReportOut:
    report = _get_report(db, report_id)
    keep_scheduled = report.status == ReportStatus.scheduled and body.schedule != "none"
    archived = report.status == ReportStatus.archived
    _apply_report_config(db, report, body)
    if not archived:
        report.icon = REPORT_ICONS[body.type]
    if not (keep_scheduled or archived):
        report.status = ReportStatus.ready_demo
    if not keep_scheduled:
        report.generated_at = utcnow()
        report.generated_label = "Updated just now"
    report.failure_reason = None
    db.flush()
    return report_out(report)


def regenerate_report(db: Session, report_id: str) -> s.ReportOut:
    """Recomputes from stored data only (figures are derived on read) — no external call is made."""
    report = _get_report(db, report_id)
    report.status, report.failure_reason, report.icon = ReportStatus.ready_demo, None, REPORT_ICONS[ev(report.type)]
    report.generated_at, report.generated_label = utcnow(), "Regenerated just now"
    db.flush()
    return report_out(report)


def duplicate_report(db: Session, report_id: str) -> s.ReportOut:
    source = _get_report(db, report_id)
    n = _next_report_number(db)
    copy = Report(
        id=f"rep-{REPORT_SERIES}-{n}", code=f"#REP-{REPORT_SERIES}-{n}", title=f"{source.title} (Copy)", type=source.type, scope=source.scope,
        account_id=source.account_id, period_start=source.period_start, period_end=source.period_end, metrics=list(source.metrics),
        sections=list(source.sections), compare_baseline=source.compare_baseline, formats=list(source.formats), schedule=source.schedule,
        recipients=list(source.recipients), has_content_focus=source.has_content_focus, status=ReportStatus.ready_demo,
        icon=REPORT_ICONS[ev(source.type)], generated_at=utcnow(), generated_label="Just now", created_by=session_member(db).name,
        next_run_label=source.next_run_label, narrative=source.narrative,
        campaign_links=[ReportCampaign(campaign_id=l.campaign_id, position=l.position) for l in source.campaign_links],
        content_links=[ReportContentItem(content_id=l.content_id, position=l.position) for l in source.content_links],
    )
    db.add(copy)
    db.flush()
    return report_out(copy)


def set_report_archived(db: Session, report_id: str, archived: bool) -> s.ReportOut:
    report = _get_report(db, report_id)
    report.status = ReportStatus.archived if archived else ReportStatus.ready
    report.icon = "archive" if archived else REPORT_ICONS[ev(report.type)]
    db.flush()
    return report_out(report)


# ================================================================================= notifications


def notification_out(n: Notification) -> s.NotificationOut:
    return s.NotificationOut(
        id=n.id, category=ev(n.category), priority=ev(n.priority), title=n.title, body=n.body, emphasis=n.emphasis, quote=n.quote,
        time_label=n.time_label, timestamp_label=n.timestamp_label, group=ev(n.group), read=n.read, href=n.href, icon=n.icon,
        tone=ev(n.tone), badge=n.badge, tags=n.tags, primary_action=n.primary_action, secondary_action=n.secondary_action,
        meta=n.meta, report_id=n.report_id,
    )


def list_notifications(db: Session, *, unread: bool | None = None, category: str | None = None) -> list[s.NotificationOut]:
    query = select(Notification).order_by(Notification.position, Notification.id)
    if unread is not None:
        query = query.where(Notification.read.is_(not unread))
    if category:
        query = query.where(Notification.category == category)
    return [notification_out(n) for n in db.scalars(query)]


def unread_count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Notification).where(Notification.read.is_(False))) or 0


def set_notification_read(db: Session, notification_id: str, read: bool) -> s.NotificationOut:
    n = db.get(Notification, notification_id)
    if n is None:
        raise NotFoundError("Notification", notification_id)
    n.read = read
    db.flush()
    return notification_out(n)


def mark_all_read(db: Session) -> int:
    db.execute(update(Notification).values(read=True))
    return db.scalar(select(func.count()).select_from(Notification)) or 0


def dismiss_notification(db: Session, notification_id: str) -> dict[str, str]:
    result = db.execute(delete(Notification).where(Notification.id == notification_id))
    if not result.rowcount:
        raise NotFoundError("Notification", notification_id)
    return {"id": notification_id}


def _settings_row(db: Session) -> WorkspaceSettings:
    row = db.get(WorkspaceSettings, current_workspace(db).id)
    if row is None:
        raise NotFoundError("Workspace settings", "current")
    return row


def notification_preferences(db: Session) -> dict:
    return _settings_row(db).notification_preferences


def save_notification_preferences(db: Session, body: s.NotificationPreferencesIn) -> dict:
    row = _settings_row(db)
    row.notification_preferences = body.model_dump(by_alias=True)
    db.flush()
    return row.notification_preferences


# ====================================================================================== activity


def _short_name(name: str) -> str:
    first, _, last = name.partition(" ")
    return f"{first} {last[0]}." if last else first


def list_actors(db: Session) -> list[s.ActivityActorOut]:
    members = db.scalars(select(TeamMember).order_by(TeamMember.position, TeamMember.created_at))
    systems = db.scalars(select(ActivityActor).order_by(ActivityActor.position))
    return [
        *(s.ActivityActorOut(id=m.id, kind="member", name=m.name, short_label=f"Operator: {_short_name(m.name)}", email=m.email,
                             role=f"{m.role} · {ev(m.access)}") for m in members),
        *(s.ActivityActorOut(id=a.id, kind=ev(a.kind), name=a.name, short_label=a.short_label, icon=a.icon) for a in systems),
    ]


def activity_out(e: ActivityEvent) -> s.ActivityEntryOut:
    return s.ActivityEntryOut(
        id=e.id, timestamp=ist_wallclock(e.occurred_at), category=ev(e.category), kind=e.kind, kind_icon=e.kind_icon, kind_tone=e.kind_tone,
        kind_icon_class=e.kind_icon_class, title=e.title, title_tag=e.title_tag, summary=e.summary, narrative=e.narrative, target=e.target,
        actor_id=e.actor_id, account_id=e.account_id, outcome=ev(e.outcome), outcome_label=e.outcome_label,
        response_status=e.response_status, origin=e.origin, payload=e.payload, diff=e.diff,
    )


def list_activity(db: Session, *, category: str | None = None, outcome: str | None = None, actor_id: str | None = None,
                  limit: int | None = None, offset: int = 0) -> list[s.ActivityEntryOut]:
    query = select(ActivityEvent).order_by(ActivityEvent.occurred_at.desc(), ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
    for column, value in ((ActivityEvent.category, category), (ActivityEvent.outcome, outcome), (ActivityEvent.actor_id, actor_id)):
        if value:
            query = query.where(column == value)
    query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return [activity_out(e) for e in db.scalars(query)]


def activity_summary(db: Session) -> s.ActivitySummaryOut:
    ws = current_workspace(db)
    start = datetime.combine(ws.reporting_start, time.min, IST)
    end = datetime.combine(ws.reporting_end + timedelta(days=1), time.min, IST)
    member_ids = select(TeamMember.id)
    in_period = (ActivityEvent.occurred_at >= start) & (ActivityEvent.occurred_at < end)
    is_operator = ActivityEvent.actor_id.in_(member_ids)
    issue = ActivityEvent.outcome.in_([ActivityOutcome.warning, ActivityOutcome.failed, ActivityOutcome.resolved])
    row = db.execute(
        select(
            func.count(),
            func.count().filter(~is_operator),
            func.count().filter(~is_operator & (ActivityEvent.outcome != ActivityOutcome.failed)),
            func.count().filter(issue),
            func.count().filter(ActivityEvent.outcome == ActivityOutcome.resolved),
            func.count(distinct(ActivityEvent.actor_id)).filter(is_operator),
        ).where(in_period)
    ).one()
    total, automated, automated_ok, issues, addressed, active_ops = (int(x or 0) for x in row)
    return s.ActivitySummaryOut(
        total=total, previous_period_total=reference(db, "activity_meta")["previousPeriodEventTotal"], automated=automated,
        operator=total - automated, issues=issues, issues_addressed=addressed, active_operators=active_ops,
        pipeline_health=num(automated_ok / automated * 100) if automated else 100,
    )


def record_activity(db: Session, **fields: Any) -> ActivityEvent:
    """Server-side audit entry for a change made through the API."""
    event = ActivityEvent(
        id=f"EVT_API_{secrets.token_hex(5).upper()}", occurred_at=utcnow(), response_status="200 OK",
        origin="InstaBoard API (local development)", outcome="success", **fields,
    )
    db.add(event)
    return event


# ====================================================================================== settings

SETTING_LABELS = {
    "general.displayName": "Workspace display name", "general.timezone": "Time zone", "general.dateFormat": "Date format",
    "general.numberFormat": "Number format", "general.defaultAccountId": "Default Instagram account",
    "general.denseGrid": "Dense enterprise data grid", "general.deltaBadges": "Period-over-period delta badges",
    "sync.enabled": "Automated ingestion", "sync.intervalHours": "Sync interval (hours)", "sync.streams.media": "Stream: Media telemetry",
    "sync.streams.audience": "Stream: Audience demographics", "sync.streams.comments": "Stream: Comments & NLP",
    "sync.streams.stories": "Stream: 24h Story telemetry", "sync.retentionDays": "Telemetry retention (days)",
    "sync.autoRetry": "Automatic retry on 429", "ai.enabled": "AI synthesis engine", "ai.categories.campaignDiagnostics": "AI: Campaign diagnostics",
    "ai.categories.fatigueAlerts": "AI: Reel fatigue alerts", "ai.categories.sentiment": "AI: Sentiment & intent",
    "ai.categories.leadAttribution": "AI: Lead attribution", "ai.confidenceThreshold": "Minimum confidence (%)",
    "ai.minSampleSize": "Minimum sample size", "notifications.digestEnabled": "Morning digest", "notifications.digestTime": "Morning digest time",
}
SECTION_TAB = {"general": "general", "sync": "data-sync", "ai": "ai", "notifications": "notifications"}


def _flatten(obj: Any, prefix: str = "", out: dict[str, str] | None = None) -> dict[str, str]:
    out = {} if out is None else out
    if isinstance(obj, dict):
        for key, value in obj.items():
            _flatten(value, f"{prefix}.{key}" if prefix else key, out)
    else:
        if isinstance(obj, list):
            text = " + ".join(map(str, obj)) or "None"
        elif isinstance(obj, bool):
            text = "On" if obj else "Off"
        else:
            text = str(num(obj) if isinstance(obj, float) else obj)
        out[prefix] = text
    return out


def settings_out(row: WorkspaceSettings) -> dict[str, Any]:
    return {"general": row.general, "sync": row.sync, "ai": row.ai, "notifications": row.notifications,
            "updatedAt": row.updated_at_label, "updatedBy": row.updated_by}


def get_settings_doc(db: Session) -> dict[str, Any]:
    return settings_out(_settings_row(db))


def save_settings(db: Session, body: WorkspaceSettingsIn) -> dict[str, Any]:
    row = _settings_row(db)
    if db.get(InstagramAccount, body.general.default_account_id) is None:
        raise NotFoundError("Instagram account", body.general.default_account_id)
    after = body.model_dump(by_alias=True)
    before = {"general": row.general, "sync": row.sync, "ai": row.ai, "notifications": row.notifications}
    a, b = _flatten(before), _flatten(after)
    triggers = {t["id"]: t["label"] for t in reference(db, "notification_trigger_meta")}
    labels = {**SETTING_LABELS}
    for tid, label in triggers.items():
        labels |= {f"notifications.triggers.{tid}.enabled": label, f"notifications.triggers.{tid}.channels": f"{label} channels",
                   f"notifications.triggers.{tid}.threshold": f"{label} threshold"}
    diff = [{"key": k, "field": labels.get(k, k), "before": a.get(k, "—"), "after": b[k]} for k in b if a.get(k) != b[k]]

    member = session_member(db)
    row.general, row.sync, row.ai, row.notifications = after["general"], after["sync"], after["ai"], after["notifications"]
    row.updated_at_label = "Just now"
    row.updated_by = member.name
    if diff:
        fields = ", ".join(d["field"] for d in diff[:3]) + ("…" if len(diff) > 3 else "")
        record_activity(
            db, category="settings", kind="Config Change", kind_icon="settings", kind_tone="neutral", kind_icon_class="text-text-secondary",
            title="Workspace Settings Updated", summary=f"Updated {len(diff)} setting{'' if len(diff) == 1 else 's'}: {fields}.",
            narrative=f"{member.name} saved workspace configuration changes through the InstaBoard API. Stored in the InstaBoard database only — no scheduler, AI engine or notification provider is connected in this phase.",
            target={"label": "Sys/Settings", "to": f"/settings?tab={SECTION_TAB.get(diff[0]['key'].split('.')[0], 'general')}", "module": "Settings"},
            actor_id=member.id, payload={"type": "SETTINGS_UPDATED", "changed_fields": [d["key"] for d in diff]},
            diff=[{"field": d["field"], "before": d["before"], "after": d["after"]} for d in diff],
        )
    db.flush()
    return settings_out(row)


def settings_environment(db: Session) -> dict:
    return reference(db, "settings_environment")


def settings_session(db: Session) -> dict:
    return reference(db, "settings_session")


def notification_trigger_meta(db: Session) -> list:
    return reference(db, "notification_trigger_meta")


# ========================================================================================== team


def _team_event(db: Session, title: str, summary: str, member: TeamMember, diff: list[dict[str, str]] | None = None) -> None:
    actor = session_member(db)
    record_activity(
        db, category="security", kind="Team Change", kind_icon="group", kind_tone="neutral", kind_icon_class="text-tertiary", title=title,
        summary=summary, narrative=f"{summary} Recorded by the InstaBoard API. No invitation email is sent and no identity provider is connected in this phase.",
        target={"label": member.name, "to": "/settings?tab=workspace", "module": "Workspace & Team"}, actor_id=actor.id,
        payload={"type": "TEAM_MEMBER_CHANGED", "member_id": member.id, "email": member.email, "access": ev(member.access)}, diff=diff,
    )


def _name_from_email(email: str) -> str:
    parts = [p for p in email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").split() if p]
    return " ".join(p[0].upper() + p[1:] for p in parts) or email


def invite_member(db: Session, body: TeamInviteIn) -> TeamMemberOut:
    ws = current_workspace(db)
    if db.scalar(select(TeamMember).where(TeamMember.workspace_id == ws.id, TeamMember.email == body.email)):
        raise ConflictError(f"{body.email} is already a member of this workspace.")
    position = (db.scalar(select(func.max(TeamMember.position)).where(TeamMember.workspace_id == ws.id)) or 0) + 1
    member = TeamMember(
        id=f"usr-{secrets.token_hex(4)}", workspace_id=ws.id, name=_name_from_email(body.email), email=body.email,
        role=(body.role or "").strip() or "Invited collaborator", access=body.access, status="invited", last_active_label="Invite pending",
        position=position,
    )
    db.add(member)
    db.flush()
    _team_event(db, "Workspace Invitation Created", f"Invited {member.email} with {ev(member.access)} access.", member)
    return member_out(member)


def _get_member(db: Session, member_id: str) -> TeamMember:
    member = db.get(TeamMember, member_id)
    if member is None:
        raise NotFoundError("Team member", member_id)
    return member


def update_member_access(db: Session, member_id: str, body: TeamAccessIn) -> TeamMemberOut:
    member = _get_member(db, member_id)
    if ev(member.access) == "Owner":
        raise ConflictError("The workspace owner role cannot be changed.")
    before = ev(member.access)
    member.access = body.access
    db.flush()
    _team_event(db, "Member Access Changed", f"Changed {member.name}'s access from {before} to {body.access}.", member,
                diff=[{"field": "Workspace access", "before": before, "after": body.access}])
    return member_out(member)


def remove_member(db: Session, member_id: str) -> dict[str, str]:
    member = _get_member(db, member_id)
    if ev(member.access) == "Owner":
        raise ConflictError("The workspace owner cannot be removed.")
    invited = ev(member.status) == "invited"
    _team_event(db, "Invitation Revoked" if invited else "Member Removed",
                f"Revoked the pending invitation for {member.email}." if invited else f"Removed {member.name} from the workspace.", member)
    db.delete(member)
    db.flush()
    return {"id": member_id}
