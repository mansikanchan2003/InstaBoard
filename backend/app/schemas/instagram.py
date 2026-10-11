"""Instagram integration API shapes. No schema here has a token, secret or ciphertext field."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from .base import ApiModel


class IntegrationStatusOut(ApiModel):
    provider: str = "instagram_login"
    enabled: bool
    # Names of missing server settings (never values) — lets admins see why the integration is off.
    missing_config: list[str]
    api_version: str | None
    requested_scopes: list[str]
    can_manage: bool
    connected_accounts: int


class ConnectOut(ApiModel):
    authorization_url: str
    expires_in_seconds: int


class InstagramConnectionOut(ApiModel):
    id: str
    source: str
    ig_user_id: str
    username: str
    name: str | None
    account_type: str | None
    profile_picture_url: str | None
    followers_count: int | None
    follows_count: int | None
    media_count: int | None
    status: str
    granted_scopes: list[str]
    connected_at: datetime
    token_expires_at: datetime | None
    last_synced_at: datetime | None
    last_sync_attempt_at: datetime | None
    last_sync_status: str | None
    last_error_code: str | None
    last_error_message: str | None
    insights_available: bool
    comments_available: bool


class MetricValueOut(ApiModel):
    metric: str
    value: int | None  # null = unavailable (never a fabricated zero)
    status: str
    period: str
    captured_at: datetime


class InstagramMediaOut(ApiModel):
    id: str
    ig_media_id: str
    media_type: str | None
    media_product_type: str | None
    caption: str | None
    permalink: str | None
    thumbnail_url: str | None
    media_url: str | None
    posted_at: datetime | None
    like_count: int | None
    comments_count: int | None
    removed: bool
    insights: list[MetricValueOut]
    insights_captured_at: datetime | None


class AccountMetricOut(ApiModel):
    metric: str
    value: int | None
    status: str
    range_start: datetime
    range_end: datetime
    captured_at: datetime


class SeriesPointOut(ApiModel):
    date: datetime
    value: int | None


class AccountInsightsOut(ApiModel):
    source: str = "instagram_api"
    totals: list[AccountMetricOut]
    reach_daily: list[SeriesPointOut]
    unavailable_metrics: list[str]
    note: str


class InstagramCommentOut(ApiModel):
    id: str
    ig_comment_id: str
    media_id: str
    parent_ig_comment_id: str | None
    text: str | None
    username: str | None
    like_count: int | None
    hidden: bool | None
    commented_at: datetime | None


class SyncWarningOut(ApiModel):
    code: str
    message: str


class SyncJobOut(ApiModel):
    """Durable background sync job (no tokens, no provider payloads)."""

    id: str
    account_id: str
    trigger: str  # connect | manual | scheduled
    status: str  # queued | running | succeeded | partially_succeeded | retrying | failed | cancelled
    terminal: bool
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    progress: int
    progress_stage: str | None
    records_processed: int
    media_fetched: int
    media_insights_fetched: int
    account_insights_fetched: int
    comments_fetched: int
    retry_count: int
    max_retries: int
    next_retry_at: datetime | None
    cancel_requested: bool
    warnings: list[SyncWarningOut] = Field(default_factory=list)
    error_category: str | None
    error_message: str | None
    api_version: str


class EnqueuedJobOut(ApiModel):
    job: SyncJobOut
    # True when an identical job was already queued/running — no new job was created.
    deduplicated: bool


class SyncStatusOut(ApiModel):
    account_id: str
    connection_status: str
    last_success_at: datetime | None
    last_sync_status: str | None
    current_job: SyncJobOut | None
    last_job: SyncJobOut | None
    next_scheduled_at: datetime | None
    scheduling_enabled: bool
    interval_minutes: int
    background_available: bool


class HistoryPointOut(ApiModel):
    date: datetime
    value: int | None  # null = no observation that day (an honest gap, never interpolated)


class HistorySeriesOut(ApiModel):
    metric: str
    kind: str  # daily_snapshot | daily | rolling_28d
    unit: str
    points: list[HistoryPointOut]
    observed_days: int


class AccountHistoryOut(ApiModel):
    source: str = "instagram_api"
    days: int
    first_observation_at: datetime | None
    series: list[HistorySeriesOut]
    note: str


class MediaHistoryPointOut(ApiModel):
    observed_at: datetime
    value: int | None


class MediaHistorySeriesOut(ApiModel):
    metric: str
    unit: str
    points: list[MediaHistoryPointOut]


class MediaHistoryOut(ApiModel):
    media_id: str
    ig_media_id: str
    unsupported_metrics: list[str]
    series: list[MediaHistorySeriesOut]


class DataDeletionOut(ApiModel):
    url: str
    confirmation_code: str
