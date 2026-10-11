"""SQLAlchemy models. Importing this package registers every table on ``Base.metadata``."""

from .ai import AIAnalysisCache, AIJob, AIUsageRecord, CommentClassification, LeadAISummary
from .auth import AuthSession, Invitation, User
from .account import AccountDailyMetric, AccountKpi, AccountReportingPeriod, AccountTelemetry, AudienceBreakdown, AudienceSnapshot, InstagramAccount, SyncLog
from .base import Base
from .campaign import Campaign, CampaignDetailExtras, CampaignLeadChannel, CampaignLeadFunnelStage, CampaignMetrics
from .content import ContentAnalytics, ContentItem
from .engagement import Comment, CommentPeriodSummary, CommentSentimentDaily, Lead
from .instagram import (
    InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramDataDeletionRequest, InstagramMedia,
    InstagramMediaInsight, InstagramOAuthState, InstagramSyncRun, InstagramToken, WorkerHeartbeat,
)
from .intelligence import ActivityActor, ActivityEvent, Insight, Notification, RecommendedAction, Report, ReportCampaign, ReportContentItem
from .workspace import ReferenceDocument, TeamMember, Workspace, WorkspaceDocument, WorkspaceSettings

__all__ = [
    "AuthSession", "Invitation", "User", "WorkspaceDocument",
    "AIAnalysisCache", "AIJob", "AIUsageRecord", "CommentClassification", "LeadAISummary",
    "InstagramAccountInsight", "InstagramComment", "InstagramConnection", "InstagramDataDeletionRequest", "InstagramMedia",
    "InstagramMediaInsight", "InstagramOAuthState", "InstagramSyncRun", "InstagramToken", "WorkerHeartbeat",
    "AccountDailyMetric", "AccountKpi", "AccountReportingPeriod", "AccountTelemetry", "ActivityActor", "ActivityEvent",
    "AudienceBreakdown", "AudienceSnapshot", "Base", "Campaign", "CampaignDetailExtras", "CampaignLeadChannel",
    "CampaignLeadFunnelStage", "CampaignMetrics", "Comment", "CommentPeriodSummary", "CommentSentimentDaily",
    "ContentAnalytics", "ContentItem", "Insight", "InstagramAccount", "Lead", "Notification", "RecommendedAction",
    "ReferenceDocument", "Report", "ReportCampaign", "ReportContentItem", "SyncLog", "TeamMember", "Workspace",
    "WorkspaceSettings",
]
