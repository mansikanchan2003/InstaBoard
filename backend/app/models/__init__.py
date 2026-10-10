"""SQLAlchemy models. Importing this package registers every table on ``Base.metadata``."""

from .account import AccountDailyMetric, AccountKpi, AccountReportingPeriod, AccountTelemetry, AudienceBreakdown, AudienceSnapshot, InstagramAccount, SyncLog
from .base import Base
from .campaign import Campaign, CampaignDetailExtras, CampaignLeadChannel, CampaignLeadFunnelStage, CampaignMetrics
from .content import ContentAnalytics, ContentItem
from .engagement import Comment, CommentPeriodSummary, CommentSentimentDaily, Lead
from .intelligence import ActivityActor, ActivityEvent, Insight, Notification, RecommendedAction, Report, ReportCampaign, ReportContentItem
from .workspace import ReferenceDocument, TeamMember, Workspace, WorkspaceSettings

__all__ = [
    "AccountDailyMetric", "AccountKpi", "AccountReportingPeriod", "AccountTelemetry", "ActivityActor", "ActivityEvent",
    "AudienceBreakdown", "AudienceSnapshot", "Base", "Campaign", "CampaignDetailExtras", "CampaignLeadChannel",
    "CampaignLeadFunnelStage", "CampaignMetrics", "Comment", "CommentPeriodSummary", "CommentSentimentDaily",
    "ContentAnalytics", "ContentItem", "Insight", "InstagramAccount", "Lead", "Notification", "RecommendedAction",
    "ReferenceDocument", "Report", "ReportCampaign", "ReportContentItem", "SyncLog", "TeamMember", "Workspace",
    "WorkspaceSettings",
]
