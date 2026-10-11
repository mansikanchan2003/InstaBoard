"""Response schemas for workspace, accounts, campaigns, content, leads and account analytics.

Shapes mirror frontend/src/types/domain.ts (and campaigns.ts / audience.ts) field for field.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .base import ApiModel, JsonDoc, optional

Number = int | float


# --- workspace -----------------------------------------------------------------------
class Period(ApiModel):
    start: str
    end: str
    label: str


class WorkspaceOut(ApiModel):
    id: str
    name: str
    plan: str
    timezone: str
    currency: str
    reporting_period: Period
    baseline_period: Period
    last_synced_label: str


class TeamMemberOut(ApiModel):
    __omit_if_none__ = optional("avatar_url")
    id: str
    name: str
    email: str
    role: str
    access: Literal["Owner", "Admin", "Editor", "Viewer"]
    avatar_url: str | None = None
    status: Literal["active", "invited", "suspended"]
    last_active: str


# --- accounts ------------------------------------------------------------------------
class InstagramAccountOut(ApiModel):
    __omit_if_none__ = optional("avatar_url", "next_sync_label", "status_note")
    id: str
    display_name: str
    handle: str
    initials: str
    avatar_url: str | None = None
    type: Literal["business", "creator"]
    status: Literal["connected", "action_required", "expired", "syncing"]
    is_primary: bool
    verified: bool
    external_id: str
    connected_since: str
    last_synced_at: str
    next_sync_label: str | None = None
    status_note: str | None = None
    followers: int
    following: int
    media_count: int
    data_availability: JsonDoc
    scopes: list[str]


class KpiValueOut(ApiModel):
    __omit_if_none__ = optional("delta", "baseline")
    value: Number
    delta: Number | None = None
    baseline: Number | None = None


class LeadKpiOut(KpiValueOut):
    target: Number


class AccountOverviewOut(ApiModel):
    account_id: str
    followers: int
    total_content: int
    views: KpiValueOut
    reach: KpiValueOut
    engagement_rate: KpiValueOut
    likes: KpiValueOut
    comments: KpiValueOut
    shares: KpiValueOut
    saves: KpiValueOut
    leads: LeadKpiOut
    watch_time_hours: KpiValueOut
    ai_health_score: int


class TrendPointOut(ApiModel):
    date: str
    current: Number
    previous: Number


class SyncLogOut(ApiModel):
    __omit_if_none__ = optional("comments")
    id: str
    account_id: str
    executed_at: str
    executed_label: str
    trigger: Literal["scheduled", "manual", "webhook", "token_refresh"]
    trigger_label: str
    duration_sec: Number | None
    media: int
    comments: int | None = None
    status: Literal["success", "partial", "failed"]
    status_label: str
    raw: JsonDoc


# --- campaigns -----------------------------------------------------------------------
class CampaignMetricsOut(ApiModel):
    views: int
    reach: int
    engagement_rate: Number
    likes: int
    comments: int
    shares: int
    saves: int
    leads: int
    conversion_rate: Number


class CampaignOut(ApiModel):
    __omit_if_none__ = optional(
        "creatives_note", "thumbnail_url", "thumbnail_type", "budget_inr", "lead_goal", "primary_age_group", "baseline"
    )
    id: str
    code: str
    name: str
    objective: Literal["Lead Generation", "Awareness", "Engagement"]
    focus: str
    status: Literal["active", "paused", "completed", "scheduled", "draft"]
    start_date: str | None
    end_date: str | None
    account_id: str
    creatives_count: int
    creatives_note: str | None = None
    thumbnail_url: str | None = None
    thumbnail_type: Literal["image", "video"] | None = None
    owner: str
    budget_inr: int | None = None
    lead_goal: int | None = None
    primary_age_group: str | None = None
    target_regions: list[str]
    hashtags: list[str]
    metrics: CampaignMetricsOut | None
    baseline: CampaignMetricsOut | None = None
    health: Literal["excellent", "good", "needs_attention"] | None


class CampaignDetailExtrasOut(ApiModel):
    __omit_if_none__ = optional("progression", "analysis", "comments", "quick_view_recommendation")
    campaign_id: str
    progression: JsonDoc | None = None
    analysis: list[Any] | None = None
    comments: JsonDoc | None = None
    quick_view_recommendation: str | None = None


class LeadFunnelOut(ApiModel):
    funnel: dict[str, int]
    channels: list[dict[str, Any]]


# --- content -------------------------------------------------------------------------
class ContentMetricsOut(ApiModel):
    __omit_if_none__ = optional("retention")
    views: int
    reach: int
    likes: int
    comments: int
    shares: int
    saves: int
    engagement_rate: Number
    leads: int
    retention: Number | None = None


class ContentItemOut(ApiModel):
    __omit_if_none__ = optional("duration_sec", "slides", "thumbnail_url", "is_top_performer")
    id: str
    title: str
    caption: str
    type: Literal["reel", "post", "carousel", "story"]
    campaign_id: str | None
    account_id: str
    published_at: str
    duration_sec: int | None = None
    slides: int | None = None
    thumbnail_url: str | None = None
    thumbnail_alt: str
    is_top_performer: bool | None = None
    metrics: ContentMetricsOut


# --- leads ---------------------------------------------------------------------------
LeadStatusLiteral = Literal["new", "contacted", "qualified", "converted", "lost"]
LeadSourceLiteral = Literal["comment", "dm", "bio_link", "profile_visit"]


class LeadOut(ApiModel):
    __omit_if_none__ = optional("phone_masked", "notes", "source_comment_id")
    id: str
    name: str
    handle: str
    location: str
    campaign_id: str
    content_id: str | None
    score: int
    status: LeadStatusLiteral
    source: LeadSourceLiteral
    last_contact: str
    first_message: str
    phone_masked: str | None = None
    notes: str | None = None
    source_comment_id: str | None = None


class LeadCreateResultOut(ApiModel):
    """POST /leads: ``created`` is false when a lead with the same handle already existed."""

    lead: LeadOut
    created: bool


class LeadPipelineSummaryOut(ApiModel):
    total_comment_inquiries: int
    ai_filtered_potential: int
    ai_intent_rate: Number
    qualified_leads: int
    qualified_leads_delta: Number
    converted_operators: int
    close_rate: Number


# --- audience ------------------------------------------------------------------------
class AgeShareOut(ApiModel):
    __omit_if_none__ = optional("note")
    label: str
    share: Number
    audience: int
    delta_pct: Number
    note: str | None = None


class StateShareOut(ApiModel):
    label: str
    share: Number
    reach: int
    engaged: int
    leads: int


class GenderOut(ApiModel):
    male: int
    female: int
    unknown: int


class AudienceSummaryOut(ApiModel):
    followers: int
    follower_growth_pct: Number
    net_new_followers: int
    non_follower_reach_pct: Number
    engaged_audience: int
    gender: GenderOut
    age: list[AgeShareOut]
    top_states: list[StateShareOut] = Field(alias="topStates")
