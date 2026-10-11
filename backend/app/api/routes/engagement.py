"""Comments, insights, reports, notifications, activity, settings and team routes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import DB, commit
from app.schemas import core as cs
from app.schemas import engagement as s
from app.schemas.base import JsonDoc
from app.schemas.inputs import TeamAccessIn, TeamInviteIn, WorkspaceSettingsIn
from app.services import engagement as svc

def IdPath():  # noqa: N802 - a fresh Path() per parameter (FastAPI binds a FieldInfo to one parameter)
    return Path(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.\-]+$")

comments = APIRouter(prefix="/comments", tags=["comments"])
insights = APIRouter(prefix="/insights", tags=["ai insights"])
reports = APIRouter(prefix="/reports", tags=["reports"])
notifications = APIRouter(prefix="/notifications", tags=["notifications"])
activity = APIRouter(prefix="/activity", tags=["activity log"])
settings = APIRouter(tags=["settings"])
team = APIRouter(prefix="/workspace/members", tags=["workspace"])


# --- comments --------------------------------------------------------------------------------
@comments.get("", response_model=s.CommentListOut, summary="Sampled comments plus the period total")
def list_comments(
    db: DB,
    status_: s.CommentStatusLiteral | None = Query(default=None, alias="status"),
    sentiment: Literal["positive", "neutral", "negative"] | None = None,
    intent: Literal["application", "eligibility", "product", "information", "feedback", "complaint", "other"] | None = None,
    content_id: str | None = Query(default=None, alias="contentId", max_length=80),
    campaign_id: str | None = Query(default=None, alias="campaignId", max_length=80),
):
    return svc.list_comments(db, status=status_, sentiment=sentiment, intent=intent, content_id=content_id, campaign_id=campaign_id)


@comments.get("/summary", response_model=s.CommentSummaryOut)
def comment_summary(db: DB):
    return svc.comment_summary(db)


@comments.get("/sentiment-trend", response_model=list[s.SentimentTrendPointOut])
def sentiment_trend(db: DB):
    return svc.sentiment_trend(db)


@comments.post("/bulk", response_model=s.UpdatedCountOut, summary="Bulk triage status (InstaBoard only; nothing is posted to Instagram)")
def bulk_status(db: DB, body: s.CommentBulkIn):
    return commit(db, svc.bulk_comment_status(db, body))


@comments.post("/{comment_id}/convert-to-lead", response_model=s.CommentConvertOut, status_code=status.HTTP_201_CREATED,
               summary="Convert a comment to a lead (idempotent: repeats return 200 with created=false; nothing is posted to Instagram)")
def convert_to_lead(db: DB, response: Response, comment_id: str = IdPath()):
    result = svc.convert_comment_to_lead(db, comment_id)
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return commit(db, result)


@comments.get("/{comment_id}", response_model=s.InstagramCommentOut)
def get_comment(db: DB, comment_id: str = IdPath()):
    return svc.get_comment(db, comment_id)


@comments.patch("/{comment_id}", response_model=s.InstagramCommentOut, summary="Triage a comment (local state only)")
def update_comment(db: DB, body: s.CommentPatchIn, comment_id: str = IdPath()):
    return commit(db, svc.update_comment(db, comment_id, body))


# --- insights (static paths first) -------------------------------------------------------------
@insights.get("/overview", response_model=JsonDoc, summary="Stored AI synthesis copy (demo output)")
def insights_overview(db: DB):
    return svc.insights_overview(db)


@insights.get("/actions", response_model=list[s.RecommendedActionOut])
def list_actions(db: DB):
    return svc.list_actions(db)


@insights.post("/actions/review-all", response_model=s.UpdatedCountOut)
def review_all(db: DB):
    return commit(db, svc.review_all_actions(db))


@insights.patch("/actions/{action_id}", response_model=s.RecommendedActionOut)
def set_action_status(db: DB, body: s.ActionStatusIn, action_id: str = IdPath()):
    return commit(db, svc.set_action_status(db, action_id, body))


@insights.post("/regenerate", status_code=status.HTTP_501_NOT_IMPLEMENTED, summary="Not available: no AI provider in this phase")
def regenerate():
    svc.regenerate_insights()


@insights.get("", response_model=list[s.InsightOut], summary="Stored insights (demonstration output; no model is called)")
def list_insights(db: DB, category: Literal["campaign", "content", "audience", "comments", "leads"] | None = None,
                  priority: Literal["high", "medium", "low"] | None = None,
                  status_: Literal["new", "reviewed", "dismissed"] | None = Query(default=None, alias="status")):
    return svc.list_insights(db, category=category, priority=priority, status=status_)


@insights.get("/{insight_id}", response_model=s.InsightOut)
def get_insight(db: DB, insight_id: str = IdPath()):
    return svc.get_insight(db, insight_id)


@insights.patch("/{insight_id}", response_model=s.InsightOut)
def set_insight_status(db: DB, body: s.InsightStatusIn, insight_id: str = IdPath()):
    return commit(db, svc.set_insight_status(db, insight_id, body))


@insights.post("/{insight_id}/steps/{step_id}/toggle", response_model=s.InsightOut)
def toggle_step(db: DB, insight_id: str = IdPath(), step_id: str = IdPath()):
    return commit(db, svc.toggle_insight_step(db, insight_id, step_id))


# --- reports ---------------------------------------------------------------------------------
ReportStatus = Literal["ready", "ready_demo", "generating", "scheduled", "failed", "archived"]


@reports.get("", response_model=list[s.ReportOut], summary="Saved report configurations (figures are computed from campaign data)")
def list_reports(db: DB, status_: ReportStatus | None = Query(default=None, alias="status"), type_: s.ReportTypeLiteral | None = Query(default=None, alias="type")):
    return svc.list_reports(db, status=status_, type_=type_)


@reports.post("", response_model=s.ReportOut, status_code=status.HTTP_201_CREATED, summary="Save a report configuration (no email is sent)")
def create_report(db: DB, body: s.ReportConfigIn):
    return commit(db, svc.create_report(db, body))


@reports.get("/reference", response_model=s.ReportReferenceOut, summary="Boost spend per campaign and CPL benchmark")
def report_reference(db: DB):
    return svc.report_reference(db)


@reports.get("/{report_id}", response_model=s.ReportOut)
def get_report(db: DB, report_id: str = IdPath()):
    return svc.get_report(db, report_id)


@reports.put("/{report_id}", response_model=s.ReportOut)
def update_report(db: DB, body: s.ReportConfigIn, report_id: str = IdPath()):
    return commit(db, svc.update_report(db, report_id, body))


@reports.patch("/{report_id}", response_model=s.ReportOut, summary="Archive / restore")
def archive_report(db: DB, body: s.ReportArchiveIn, report_id: str = IdPath()):
    return commit(db, svc.set_report_archived(db, report_id, body.archived))


@reports.post("/{report_id}/regenerate", response_model=s.ReportOut)
def regenerate_report(db: DB, report_id: str = IdPath()):
    return commit(db, svc.regenerate_report(db, report_id))


@reports.post("/{report_id}/duplicate", response_model=s.ReportOut, status_code=status.HTTP_201_CREATED)
def duplicate_report(db: DB, report_id: str = IdPath()):
    return commit(db, svc.duplicate_report(db, report_id))


# --- notifications ---------------------------------------------------------------------------
@notifications.get("", response_model=list[s.NotificationOut])
def list_notifications(db: DB, unread: bool | None = None, category: s.NotificationCategoryLiteral | None = None):
    return svc.list_notifications(db, unread=unread, category=category)


@notifications.get("/unread-count", response_model=int)
def unread_count(db: DB):
    return svc.unread_count(db)


@notifications.post("/mark-all-read", response_model=int, summary="Marks every notification read; returns the notification count")
def mark_all_read(db: DB):
    return commit(db, svc.mark_all_read(db))


@notifications.get("/preferences", response_model=JsonDoc)
def get_preferences(db: DB):
    return svc.notification_preferences(db)


@notifications.put("/preferences", response_model=JsonDoc, summary="Save preferences (no email/SMS/WhatsApp delivery exists yet)")
def save_preferences(db: DB, body: s.NotificationPreferencesIn):
    return commit(db, svc.save_notification_preferences(db, body))


@notifications.patch("/{notification_id}", response_model=s.NotificationOut)
def set_read(db: DB, body: s.NotificationReadIn, notification_id: str = IdPath()):
    return commit(db, svc.set_notification_read(db, notification_id, body.read))


@notifications.delete("/{notification_id}", response_model=dict[str, str])
def dismiss(db: DB, notification_id: str = IdPath()):
    return commit(db, svc.dismiss_notification(db, notification_id))


# --- activity --------------------------------------------------------------------------------
ActivityCategory = Literal["data_sync", "campaigns", "content", "ai", "reports", "leads", "security", "settings"]
ActivityOutcome = Literal["success", "in_progress", "warning", "failed", "resolved"]


@activity.get("", response_model=list[s.ActivityEntryOut], summary="Audit trail, newest first")
def list_activity(db: DB, category: ActivityCategory | None = None, outcome: ActivityOutcome | None = None,
                  actor_id: str | None = Query(default=None, alias="actorId", max_length=80),
                  limit: int | None = Query(default=None, ge=1, le=1000), offset: int = Query(default=0, ge=0)):
    return svc.list_activity(db, category=category, outcome=outcome, actor_id=actor_id, limit=limit, offset=offset)


@activity.get("/actors", response_model=list[s.ActivityActorOut])
def list_actors(db: DB):
    return svc.list_actors(db)


@activity.get("/summary", response_model=s.ActivitySummaryOut)
def activity_summary(db: DB):
    return svc.activity_summary(db)


# --- settings ----------------------------------------------------------------------------------
@settings.get("/settings", response_model=JsonDoc)
def get_settings(db: DB):
    return svc.get_settings_doc(db)


@settings.put("/settings", response_model=JsonDoc, summary="Save workspace settings (records an audit entry)")
def save_settings(db: DB, body: WorkspaceSettingsIn):
    return commit(db, svc.save_settings(db, body))


@settings.get("/settings/environment", response_model=JsonDoc)
def settings_environment(db: DB):
    return svc.settings_environment(db)


@settings.get("/settings/notification-triggers", response_model=list[JsonDoc])
def notification_triggers(db: DB):
    return svc.notification_trigger_meta(db)


@settings.get("/me/session", response_model=JsonDoc, summary="Demo session details (there is no real authentication yet)")
def session_info(db: DB):
    return svc.settings_session(db)


# --- team ------------------------------------------------------------------------------------
@team.post("", response_model=cs.TeamMemberOut, status_code=status.HTTP_201_CREATED, summary="Add a pending member (no email is sent)")
def invite_member(db: DB, body: TeamInviteIn):
    return commit(db, svc.invite_member(db, body))


@team.patch("/{member_id}", response_model=cs.TeamMemberOut)
def update_member(db: DB, body: TeamAccessIn, member_id: str = IdPath()):
    return commit(db, svc.update_member_access(db, member_id, body))


@team.delete("/{member_id}", response_model=dict[str, str])
def remove_member(db: DB, member_id: str = IdPath()):
    return commit(db, svc.remove_member(db, member_id))


routers = [comments, insights, reports, notifications, activity, settings, team]
