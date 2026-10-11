"""Read models for the Instagram integration (workspace-scoped through the tenant filter)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramMedia, InstagramMediaInsight, InstagramSyncRun
from app.models.enums import IgConnectionStatus
from app.schemas import instagram as s
from app.services.auth import AuthContext

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


def sync_runs(db: Session, connection_id: str, *, limit: int = 20) -> list[s.SyncRunOut]:
    connection = get_connection(db, connection_id)
    rows = db.scalars(select(InstagramSyncRun).where(InstagramSyncRun.connection_id == connection.id)
                      .order_by(InstagramSyncRun.started_at.desc()).limit(limit))
    return [sync_run_out(r) for r in rows]


def sync_run_out(r: InstagramSyncRun) -> s.SyncRunOut:
    return s.SyncRunOut(
        id=r.id, trigger=r.trigger, status=r.status.value, started_at=r.started_at, finished_at=r.finished_at,
        media_fetched=r.media_fetched, media_insights_fetched=r.media_insights_fetched,
        account_insights_fetched=r.account_insights_fetched, comments_fetched=r.comments_fetched,
        warnings=[s.SyncWarningOut(code=w.get("code", ""), message=w.get("message", "")) for w in (r.warnings or [])],
        error_code=r.error_code, error_message=r.error_message, api_version=r.api_version,
    )
