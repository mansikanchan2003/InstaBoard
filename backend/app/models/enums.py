"""Enum values mirror the TypeScript string unions in frontend/src/types exactly."""

from __future__ import annotations

from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


# --- workspace -----------------------------------------------------------------
class MemberAccess(StrEnum):
    owner = "Owner"
    admin = "Admin"
    editor = "Editor"
    viewer = "Viewer"


class MemberStatus(StrEnum):
    active = "active"
    invited = "invited"
    suspended = "suspended"


# --- accounts ------------------------------------------------------------------
class AccountType(StrEnum):
    business = "business"
    creator = "creator"


class AccountStatus(StrEnum):
    connected = "connected"
    action_required = "action_required"
    expired = "expired"
    syncing = "syncing"


class SyncTrigger(StrEnum):
    scheduled = "scheduled"
    manual = "manual"
    webhook = "webhook"
    token_refresh = "token_refresh"


class SyncRunStatus(StrEnum):
    success = "success"
    partial = "partial"
    failed = "failed"


# --- campaigns -----------------------------------------------------------------
class CampaignStatus(StrEnum):
    active = "active"
    paused = "paused"
    completed = "completed"
    scheduled = "scheduled"
    draft = "draft"


class CampaignObjective(StrEnum):
    lead_generation = "Lead Generation"
    awareness = "Awareness"
    engagement = "Engagement"


class CampaignHealth(StrEnum):
    excellent = "excellent"
    good = "good"
    needs_attention = "needs_attention"


class ThumbnailType(StrEnum):
    image = "image"
    video = "video"


class MetricPeriod(StrEnum):
    current = "current"
    baseline = "baseline"


# --- content / leads -----------------------------------------------------------
class ContentType(StrEnum):
    reel = "reel"
    post = "post"
    carousel = "carousel"
    story = "story"


class LeadStatus(StrEnum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    converted = "converted"
    lost = "lost"


class LeadSource(StrEnum):
    comment = "comment"
    dm = "dm"
    bio_link = "bio_link"
    profile_visit = "profile_visit"


class FunnelStage(StrEnum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    converted = "converted"


# --- account analytics ---------------------------------------------------------
class KpiMetric(StrEnum):
    views = "views"
    reach = "reach"
    engagement_rate = "engagementRate"
    likes = "likes"
    comments = "comments"
    shares = "shares"
    saves = "saves"
    leads = "leads"
    watch_time_hours = "watchTimeHours"


class TrendMetric(StrEnum):
    views = "views"
    reach = "reach"
    engagement = "engagement"
    leads = "leads"
    shares = "shares"
    watch_time = "watchTime"


class AudienceDimension(StrEnum):
    age = "age"
    state = "state"


# --- comments ------------------------------------------------------------------
class CommentSentiment(StrEnum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class CommentIntent(StrEnum):
    application = "application"
    eligibility = "eligibility"
    product = "product"
    information = "information"
    feedback = "feedback"
    complaint = "complaint"
    other = "other"


class LeadPotential(StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class CommentStatus(StrEnum):
    needs_response = "needs_response"
    reviewed = "reviewed"
    responded = "responded"
    resolved = "resolved"
    lead_created = "lead_created"
    archived = "archived"


# --- insights ------------------------------------------------------------------
class InsightCategory(StrEnum):
    campaign = "campaign"
    content = "content"
    audience = "audience"
    comments = "comments"
    leads = "leads"


class InsightPriority(StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class InsightStatus(StrEnum):
    new = "new"
    reviewed = "reviewed"
    dismissed = "dismissed"


class ActionStatus(StrEnum):
    pending_review = "pending_review"
    reviewed = "reviewed"
    done = "done"
    dismissed = "dismissed"


# --- reports -------------------------------------------------------------------
class ReportType(StrEnum):
    campaign_performance = "campaign_performance"
    content_reel = "content_reel"
    audience = "audience"
    comments_sentiment = "comments_sentiment"
    lead_generation = "lead_generation"
    executive_summary = "executive_summary"


class ReportStatus(StrEnum):
    ready = "ready"
    ready_demo = "ready_demo"
    generating = "generating"
    scheduled = "scheduled"
    failed = "failed"
    archived = "archived"


class ReportScope(StrEnum):
    campaigns = "campaigns"
    account = "account"


class ReportSchedule(StrEnum):
    none = "none"
    weekly = "weekly"
    monthly = "monthly"


# --- notifications -------------------------------------------------------------
class NotificationCategory(StrEnum):
    campaigns = "campaigns"
    leads = "leads"
    content = "content"
    account = "account"
    ai = "ai"
    reports = "reports"


class NotificationPriority(StrEnum):
    urgent = "urgent"
    high = "high"
    standard = "standard"


class NotificationGroup(StrEnum):
    today = "today"
    earlier = "earlier"
    yesterday = "yesterday"
    week = "week"


class NotificationTone(StrEnum):
    amber = "amber"
    emerald = "emerald"
    ai = "ai"
    sky = "sky"
    slate = "slate"


# --- activity ------------------------------------------------------------------
class ActivityCategory(StrEnum):
    data_sync = "data_sync"
    campaigns = "campaigns"
    content = "content"
    ai = "ai"
    reports = "reports"
    leads = "leads"
    security = "security"
    settings = "settings"


class ActivityOutcome(StrEnum):
    success = "success"
    in_progress = "in_progress"
    warning = "warning"
    failed = "failed"
    resolved = "resolved"


class ActorKind(StrEnum):
    member = "member"
    system = "system"
    ai = "ai"


# --- Instagram API (Phase 5) --------------------------------------------------------------
class IgConnectionStatus(StrEnum):
    connected = "connected"
    needs_reauth = "needs_reauth"  # token expired / revoked / permission removed — user must reconnect
    error = "error"  # last sync failed for a non-token reason
    disconnected = "disconnected"  # disconnected in InstaBoard; token deleted


class IgSyncStatus(StrEnum):
    running = "running"
    success = "success"
    partial = "partial"
    failed = "failed"
