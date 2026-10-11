"""Read models for the Instagram integration (workspace-scoped through the tenant filter)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramMedia, InstagramMediaInsight, InstagramSyncRun
from app.models.enums import TERMINAL_JOB_STATES, IgConnectionStatus
from app.schemas import instagram as s
from app.services.auth import AuthContext
from app.services.common import utcnow

from .connections import get_connection
from .sync import ACCOUNT_TOTAL_METRICS, COMMENTS_SCOPE, INSIGHTS_SCOPE


def status(db: Session, settings: Settings, ctx: AuthContext) -> s.IntegrationStatusOut:
    count = db.scalar(select(func.count()).select_from(InstagramConnection).where(InstagramConnection.status != IgConnectionStatus.disconnected))
    return s.IntegrationStatusOut(
        enabled=settings.instagram_enabled, missing_config=settings.instagram_missing_config,
        api_version=settings.instagram_graph_api_version, requested_scopes=settings.instagram_oauth_scopes,
        can_manage=ctx.can("accounts:manage"), connected_accounts=count or 0,
    )


def connection_out(c: InstagramConnection) -> s.InstagramConnectionOut:
    scopes = list(c.granted_scopes or [])
    return s.InstagramConnectionOut(
        id=c.id, source=c.source, ig_user_id=c.ig_user_id, username=c.username, name=c.name, account_type=c.account_type,
        profile_picture_url=c.profile_picture_url, followers_count=c.followers_count, follows_count=c.follows_count,
        media_count=c.media_count, status=c.status.value, granted_scopes=scopes, connected_at=c.connected_at,
        token_expires_at=c.token_expires_at, last_synced_at=c.last_synced_at, last_sync_attempt_at=c.last_sync_attempt_at,
        last_sync_status=c.last_sync_status, last_error_code=c.last_error_code, last_error_message=c.last_error_message,
        insights_available=INSIGHTS_SCOPE in scopes, comments_available=COMMENTS_SCOPE in scopes,
    )


def list_connections(db: Session) -> list[s.InstagramConnectionOut]:
    rows = db.scalars(select(InstagramConnection).where(InstagramConnection.status != IgConnectionStatus.disconnected)
                      .order_by(InstagramConnection.connected_at))
    return [connection_out(c) for c in rows]


def connection_detail(db: Session, connection_id: str) -> s.InstagramConnectionOut:
    return connection_out(get_connection(db, connection_id))


def media(db: Session, connection_id: str, *, limit: int, offset: int) -> list[s.InstagramMediaOut]:
    connection = get_connection(db, connection_id)
    items = list(db.scalars(select(InstagramMedia).where(InstagramMedia.connection_id == connection.id)
                            .order_by(InstagramMedia.posted_at.desc().nulls_last(), InstagramMedia.id).limit(limit).offset(offset)))
    latest: dict[str, list[InstagramMediaInsight]] = {}
    if items:
        # Latest snapshot per media (one query): rows whose captured_at equals that media's max captured_at.
        newest = (select(InstagramMediaInsight.media_id, func.max(InstagramMediaInsight.captured_at).label("at"))
                  .where(InstagramMediaInsight.media_id.in_([m.id for m in items])).group_by(InstagramMediaInsight.media_id).subquery())
        for row in db.scalars(select(InstagramMediaInsight).join(newest, (InstagramMediaInsight.media_id == newest.c.media_id)
                                                                 & (InstagramMediaInsight.captured_at == newest.c.at))
                              .order_by(InstagramMediaInsight.metric)):
            latest.setdefault(row.media_id, []).append(row)
    out = []
    for m in items:
        snaps = latest.get(m.id, [])
        out.append(s.InstagramMediaOut(
            id=m.id, ig_media_id=m.ig_media_id, media_type=m.media_type, media_product_type=m.media_product_type, caption=m.caption,
            permalink=m.permalink, thumbnail_url=m.thumbnail_url, media_url=m.media_url, posted_at=m.posted_at,
            like_count=m.like_count, comments_count=m.comments_count, removed=m.removed_at is not None,
            insights=[s.MetricValueOut(metric=r.metric, value=r.value, status=r.status, period=r.period, captured_at=r.captured_at) for r in snaps],
            insights_captured_at=snaps[0].captured_at if snaps else None,
        ))
    return out


def account_insights(db: Session, connection_id: str) -> s.AccountInsightsOut:
    connection = get_connection(db, connection_id)
    newest_total = db.scalar(select(func.max(InstagramAccountInsight.range_end)).where(
        InstagramAccountInsight.connection_id == connection.id, InstagramAccountInsight.metric_type == "total_value"))
    totals: list[InstagramAccountInsight] = []
    if newest_total is not None:
        totals = list(db.scalars(select(InstagramAccountInsight).where(
            InstagramAccountInsight.connection_id == connection.id, InstagramAccountInsight.metric_type == "total_value",
            InstagramAccountInsight.range_end == newest_total).order_by(InstagramAccountInsight.metric)))
    series = list(db.scalars(select(InstagramAccountInsight).where(
        InstagramAccountInsight.connection_id == connection.id, InstagramAccountInsight.metric_type == "time_series",
        InstagramAccountInsight.metric == "reach").order_by(InstagramAccountInsight.range_end.desc()).limit(28)))
    returned = {t.metric for t in totals if t.status == "ok"}
    return s.AccountInsightsOut(
        totals=[s.AccountMetricOut(metric=t.metric, value=t.value, status=t.status, range_start=t.range_start, range_end=t.range_end,
                                   captured_at=t.captured_at) for t in totals],
        reach_daily=[s.SeriesPointOut(date=p.range_end, value=p.value) for p in reversed(series)],
        unavailable_metrics=[m for m in ACCOUNT_TOTAL_METRICS if m not in returned] if totals else [],
        note="Live Instagram data for the last 28 days as returned by the Instagram API. Meta may delay data by up to 48 hours; "
             "unavailable metrics are shown as unavailable, not zero.",
    )


def comments(db: Session, connection_id: str, *, limit: int, offset: int) -> list[s.InstagramCommentOut]:
    connection = get_connection(db, connection_id)
    rows = db.scalars(select(InstagramComment).where(InstagramComment.connection_id == connection.id)
                      .order_by(InstagramComment.commented_at.desc().nulls_last(), InstagramComment.id).limit(limit).offset(offset))
    return [s.InstagramCommentOut.model_validate(r) for r in rows]


def job_out(r: InstagramSyncRun) -> s.SyncJobOut:
    return s.SyncJobOut(
        id=r.id, account_id=r.connection_id, trigger=r.trigger, status=r.status.value, terminal=r.status.value in TERMINAL_JOB_STATES,
        queued_at=r.queued_at, started_at=r.started_at, finished_at=r.finished_at, progress=r.progress, progress_stage=r.progress_stage,
        records_processed=r.records_processed, media_fetched=r.media_fetched, media_insights_fetched=r.media_insights_fetched,
        account_insights_fetched=r.account_insights_fetched, comments_fetched=r.comments_fetched, retry_count=r.retry_count,
        max_retries=r.max_retries, next_retry_at=r.next_retry_at, cancel_requested=r.cancel_requested,
        warnings=[s.SyncWarningOut(code=w.get("code", ""), message=w.get("message", "")) for w in (r.warnings or [])],
        error_category=r.error_category, error_message=r.error_message, api_version=r.api_version,
    )


def sync_history(db: Session, connection_id: str, *, limit: int = 20) -> list[s.SyncJobOut]:
    connection = get_connection(db, connection_id)
    rows = db.scalars(select(InstagramSyncRun).where(InstagramSyncRun.connection_id == connection.id)
                      .order_by(InstagramSyncRun.queued_at.desc()).limit(limit))
    return [job_out(r) for r in rows]


def sync_status_out(db: Session, settings: Settings, connection_id: str) -> s.SyncStatusOut:
    from .jobs import sync_status

    connection = get_connection(db, connection_id)
    st = sync_status(db, settings, connection)
    return s.SyncStatusOut(
        account_id=connection.id, connection_status=connection.status.value, last_success_at=connection.last_synced_at,
        last_sync_status=connection.last_sync_status, current_job=job_out(st["active"]) if st["active"] else None,
        last_job=job_out(st["last"]) if st["last"] else None, next_scheduled_at=st["next_at"],
        scheduling_enabled=settings.sync_scheduler_enabled and bool(settings.redis_url) and st["schedulable"],
        interval_minutes=settings.instagram_sync_interval_minutes, background_available=bool(settings.redis_url),
    )


# ------------------------------------------------------------------------------- history
SNAPSHOT_METRICS = ("followers_count", "follows_count", "media_count")
ROLLING_METRICS = ("reach", "views", "total_interactions", "accounts_engaged")


def account_history(db: Session, connection_id: str, *, days: int) -> s.AccountHistoryOut:
    """Daily series built only from stored observations. Days without an observation are null (a gap),
    never filled with today's value or an interpolation."""
    connection = get_connection(db, connection_id)
    today = utcnow().date()
    first_day = today - timedelta(days=days - 1)
    window_start = datetime.combine(first_day, time.min, tzinfo=timezone.utc) - timedelta(days=1)
    rows = list(db.scalars(select(InstagramAccountInsight).where(
        InstagramAccountInsight.connection_id == connection.id, InstagramAccountInsight.range_end >= window_start,
    ).order_by(InstagramAccountInsight.range_end, InstagramAccountInsight.captured_at)))

    buckets: dict[tuple[str, str], dict[date, int | None]] = {}
    for r in rows:
        if r.metric_type == "snapshot" and r.metric in SNAPSHOT_METRICS:
            key, day = (r.metric, "daily_snapshot"), r.range_end.astimezone(timezone.utc).date()
        elif r.metric_type == "time_series" and r.metric == "reach":
            key, day = ("reach", "daily"), r.range_start.astimezone(timezone.utc).date()
        elif r.metric_type == "total_value" and r.metric in ROLLING_METRICS:
            key, day = (r.metric, "rolling_28d"), r.range_end.astimezone(timezone.utc).date()
        else:
            continue
        if first_day <= day <= today:
            bucket = buckets.setdefault(key, {})
            if r.value is not None or day not in bucket:  # latest real value of the day wins
                bucket[day] = r.value
    order = [(m, "daily_snapshot") for m in SNAPSHOT_METRICS] + [("reach", "daily")] + [(m, "rolling_28d") for m in ROLLING_METRICS]
    series = []
    for key in order:
        if key not in buckets:
            continue
        values = buckets[key]
        points = [s.HistoryPointOut(date=datetime.combine(first_day + timedelta(days=i), time.min, tzinfo=timezone.utc),
                                    value=values.get(first_day + timedelta(days=i))) for i in range(days)]
        series.append(s.HistorySeriesOut(metric=key[0], kind=key[1], unit="count", points=points,
                                         observed_days=sum(1 for v in values.values() if v is not None)))
    first = db.scalar(select(func.min(InstagramAccountInsight.captured_at)).where(InstagramAccountInsight.connection_id == connection.id))
    return s.AccountHistoryOut(
        days=days, first_observation_at=first, series=series,
        note="Built only from observations InstaBoard stored during syncs. Follower counts start on the first sync (Instagram "
             "does not provide past follower counts through this API); daily reach covers what the API returned. Empty days are gaps, not zeros.",
    )


def media_history(db: Session, connection_id: str, media_id: str) -> s.MediaHistoryOut:
    connection = get_connection(db, connection_id)
    media = db.scalar(select(InstagramMedia).where(InstagramMedia.id == media_id, InstagramMedia.connection_id == connection.id))
    if media is None:
        from app.core.errors import NotFoundError

        raise NotFoundError("Instagram media", media_id)
    rows = db.scalars(select(InstagramMediaInsight).where(InstagramMediaInsight.media_id == media.id)
                      .order_by(InstagramMediaInsight.metric, InstagramMediaInsight.captured_at))
    series: dict[str, s.MediaHistorySeriesOut] = {}
    for r in rows:
        entry = series.setdefault(r.metric, s.MediaHistorySeriesOut(metric=r.metric, unit=r.unit, points=[]))
        entry.points.append(s.MediaHistoryPointOut(observed_at=r.captured_at, value=r.value))
    return s.MediaHistoryOut(media_id=media.id, ig_media_id=media.ig_media_id, unsupported_metrics=list(media.unsupported_metrics or []),
                             series=list(series.values()))
