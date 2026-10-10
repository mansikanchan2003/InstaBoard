"""Request bodies for write endpoints (mirror the frontend service payloads).

Writes only change InstaBoard's own database. Nothing is published to Instagram, no message or
email is sent, and no Meta / AI provider is contacted.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from .base import ApiModel
from .core import LeadSourceLiteral, LeadStatusLiteral
from .engagement import Email

ObjectiveLiteral = Literal["Lead Generation", "Awareness", "Engagement"]
CampaignStatusLiteral = Literal["active", "paused", "completed", "scheduled", "draft"]
DateStr = str
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class CampaignCreateIn(ApiModel):
    """POST /campaigns (frontend ``NewCampaignInput``). Saved as a draft / schedule in InstaBoard only."""

    name: str = Field(min_length=3, max_length=200)
    objective: ObjectiveLiteral
    start_date: DateStr = Field(default="", pattern=r"^(\d{4}-\d{2}-\d{2})?$")
    end_date: DateStr = Field(default="", pattern=r"^(\d{4}-\d{2}-\d{2})?$")
    account_id: str
    target_regions: list[str] = Field(default_factory=list, max_length=40)
    hashtags: list[str] = Field(default_factory=list, max_length=40)
    budget_inr: int | None = Field(default=None, ge=0)
    lead_goal: int | None = Field(default=None, ge=0)
    primary_age_group: str | None = Field(default=None, max_length=20)
    status: Literal["draft", "scheduled"]

    @model_validator(mode="after")
    def _dates(self) -> CampaignCreateIn:
        if self.status == "scheduled" and not (self.start_date and self.end_date):
            raise ValueError("A scheduled campaign needs startDate and endDate")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("endDate must be on or after startDate")
        return self


class CampaignPatchIn(ApiModel):
    """PATCH /campaigns/{id}: editable fields and/or ``status`` (frontend ``update`` + ``setStatus``)."""

    name: str | None = Field(default=None, min_length=3, max_length=200)
    objective: ObjectiveLiteral | None = None
    start_date: DateStr | None = Field(default=None, pattern=DATE_PATTERN)
    end_date: DateStr | None = Field(default=None, pattern=DATE_PATTERN)
    account_id: str | None = None
    target_regions: list[str] | None = Field(default=None, max_length=40)
    hashtags: list[str] | None = Field(default=None, max_length=40)
    budget_inr: int | None = Field(default=None, ge=0)
    lead_goal: int | None = Field(default=None, ge=0)
    primary_age_group: str | None = Field(default=None, max_length=20)
    status: CampaignStatusLiteral | None = None

    @model_validator(mode="after")
    def _not_empty(self) -> CampaignPatchIn:
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        return self


class LeadPatchIn(ApiModel):
    status: LeadStatusLiteral


class LeadCreateIn(ApiModel):
    """POST /leads (Comments Intelligence → "Convert to lead"). De-duplicated by handle."""

    name: str = Field(min_length=1, max_length=160)
    handle: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._]+$")
    location: str = Field(max_length=120)
    campaign_id: str
    content_id: str | None
    score: int = Field(ge=0, le=100)
    source: LeadSourceLiteral
    first_message: str = Field(max_length=5000)
    phone_masked: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=5000)


InviteAccess = Literal["Admin", "Editor", "Viewer"]


class TeamInviteIn(ApiModel):
    """POST /workspace/members. Adds a pending member; no invitation email is sent in this phase."""

    email: Email
    access: InviteAccess
    role: str | None = Field(default=None, max_length=120)


class TeamAccessIn(ApiModel):
    access: InviteAccess


# --- settings (frontend/src/types/settings.ts) -----------------------------------------
class GeneralSettingsIn(ApiModel):
    display_name: str = Field(min_length=3, max_length=120)
    workspace_code: str
    logo_url: str
    logo_file_name: str
    timezone: Literal["Asia/Kolkata", "UTC", "Asia/Kathmandu"]
    date_format: Literal["MMM DD, YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]
    currency: Literal["INR"]
    number_format: Literal["en-IN", "en-US"]
    default_account_id: str
    dense_grid: bool
    delta_badges: bool


class SyncStreamsIn(ApiModel):
    media: bool
    audience: bool
    comments: bool
    stories: bool


class SyncSettingsIn(ApiModel):
    enabled: bool
    interval_hours: Literal[6, 12, 24]
    offset_minute: int = Field(ge=0, le=59)
    streams: SyncStreamsIn
    retention_days: Literal[180, 365, 730]
    auto_retry: bool

    @model_validator(mode="after")
    def _one_stream(self) -> SyncSettingsIn:
        if self.enabled and not any(self.streams.model_dump().values()):
            raise ValueError("Enable at least one sync stream while automated ingestion is on")
        return self


class AiCategoriesIn(ApiModel):
    campaign_diagnostics: bool
    fatigue_alerts: bool
    sentiment: bool
    lead_attribution: bool


class AiSettingsIn(ApiModel):
    enabled: bool
    categories: AiCategoriesIn
    confidence_threshold: Literal[70, 80, 90]
    min_sample_size: Literal[250, 500, 1000]

    @model_validator(mode="after")
    def _one_category(self) -> AiSettingsIn:
        if self.enabled and not any(self.categories.model_dump().values()):
            raise ValueError("Enable at least one AI category while the synthesis engine is on")
        return self


class TriggerIn(ApiModel):
    enabled: bool
    channels: list[Literal["email", "app", "slack"]] = Field(max_length=3)
    threshold: int | float = Field(ge=0)

    @model_validator(mode="after")
    def _channel(self) -> TriggerIn:
        if self.enabled and not self.channels:
            raise ValueError("An enabled trigger needs at least one channel")
        return self


class TriggersIn(ApiModel):
    token_expiry: TriggerIn
    high_intent_lead: TriggerIn
    sentiment_anomaly: TriggerIn


class NotificationSettingsIn(ApiModel):
    triggers: TriggersIn
    digest_enabled: bool
    digest_time: Literal["08:00", "09:00", "10:00"]


class WorkspaceSettingsIn(ApiModel):
    """PUT /settings. ``updatedAt`` / ``updatedBy`` from the client are ignored (set by the server)."""

    general: GeneralSettingsIn
    sync: SyncSettingsIn
    ai: AiSettingsIn
    notifications: NotificationSettingsIn
