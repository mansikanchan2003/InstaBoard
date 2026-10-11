"""Bounded manual sync: profile, recent media, insights and (if permitted) comments for one connection.

* Bounded: at most ``INSTAGRAM_SYNC_MAX_MEDIA`` media, insights for the newest
  ``INSTAGRAM_SYNC_MAX_MEDIA_INSIGHTS`` of them and comments (one page of up to 50) for the newest
  ``INSTAGRAM_SYNC_MAX_COMMENT_MEDIA``. No background scheduler exists in this phase.
* Idempotent: media/comments are upserted on their provider IDs; insight snapshots are keyed by capture time
  (media) or by range (account), so repeating a sync never duplicates records.
* Honest: metrics that were requested but not returned are stored as ``unavailable`` with a NULL value.
* Safe: a disconnected or expired connection is never called; token errors flip the connection to
  ``needs_reauth`` and stop the run.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ConflictError
from app.models import (
    InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramMedia, InstagramMediaInsight, InstagramSyncRun,
    InstagramToken,
)
from app.models.enums import IgConnectionStatus, IgSyncStatus
from app.services.auth import AuthContext, RateLimitedError
from app.services.common import utcnow

from .connections import PROFILE_FIELDS, apply_profile, mark_needs_reauth, require_open_connection, store_token
from .crypto import TokenCipher, TokenDecryptError
from .provider import InstagramClient, ProviderError

# Verified for Instagram API with Instagram Login (graph.instagram.com). caption / media_product_type are documented
# as Facebook-Login-only, so they are requested optimistically and dropped if the API rejects them.
MEDIA_CORE_FIELDS = ["id", "media_type", "permalink", "shortcode", "timestamp", "media_url", "thumbnail_url", "like_count", "comments_count"]
MEDIA_OPTIONAL_FIELDS = ["caption", "media_product_type"]
# Media insights for FEED / REELS (impressions and plays are deprecated and deliberately not requested).
MEDIA_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"]
# Account insights, metric_type=total_value, period=day over the last 28 days.
ACCOUNT_TOTAL_METRICS = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves"]
ACCOUNT_SERIES_METRICS = ["reach"]  # metric_type=time_series, one value per day
ACCOUNT_RANGE_DAYS = 28
COMMENT_FIELDS = "id,text,timestamp,username,like_count,hidden,parent_id,replies{id,text,timestamp,username,like_count,hidden,parent_id}"
INSIGHTS_SCOPE = "instagram_business_manage_insights"
COMMENTS_SCOPE = "instagram_business_manage_comments"
REFRESH_WINDOW = timedelta(days=15)
STALE_RUN = timedelta(minutes=10)


def run_sync(db: Session, settings: Settings, client: InstagramClient, cipher: TokenCipher, ctx: AuthContext,
             connection_id: str, *, trigger: str = "manual") -> InstagramSyncRun:
    now = utcnow()
    connection = db.scalar(select(InstagramConnection).where(InstagramConnection.id == connection_id).with_for_update())
    if connection is None:
        from app.core.errors import NotFoundError

        raise NotFoundError("Instagram account", connection_id)
    require_open_connection(connection)
    running = db.scalar(select(InstagramSyncRun).where(
        InstagramSyncRun.connection_id == connection.id, InstagramSyncRun.status == IgSyncStatus.running,
        InstagramSyncRun.started_at > now - STALE_RUN))
    if running is not None:
        raise ConflictError("A sync for this account is already running.")
    if connection.last_sync_attempt_at and settings.instagram_sync_cooldown_seconds:
        wait = connection.last_sync_attempt_at + timedelta(seconds=settings.instagram_sync_cooldown_seconds) - now
        if wait.total_seconds() > 0:
            raise RateLimitedError(int(wait.total_seconds()) + 1)

    run = InstagramSyncRun(id=f"igr_{secrets.token_hex(8)}", workspace_id=connection.workspace_id, connection_id=connection.id,
                           trigger=trigger, triggered_by_member_id=ctx.member_id, started_at=now, status=IgSyncStatus.running,
                           warnings=[], api_version=client.api_version)
    db.add(run)
    connection.last_sync_attempt_at = now
    connection.last_sync_status = IgSyncStatus.running.value
    db.commit()  # visible "running" state + releases the row lock

    job = _SyncJob(db, settings, client, cipher, connection, run)
    try:
        job.execute()
    except ProviderError as exc:
        job.fail(exc)
    except _StopSync:
        pass
    db.commit()
    return run


class _StopSync(Exception):
    pass


class _SyncJob:
    def __init__(self, db: Session, settings: Settings, client: InstagramClient, cipher: TokenCipher,
                 connection: InstagramConnection, run: InstagramSyncRun) -> None:
        self.db, self.settings, self.client, self.cipher = db, settings, client, cipher
        self.connection, self.run = connection, run
        self.captured_at = run.started_at
        self.warnings: list[dict] = []
        self.token = ""

    # ---------------------------------------------------------------- orchestration
    def execute(self) -> None:
        self.token = self._usable_token()
        profile = self.client.me(self.token, PROFILE_FIELDS)
        apply_profile(self.connection, profile, self.captured_at)
        self.db.commit()

        media = self._sync_media()
        scopes = set(self.connection.granted_scopes or [])
        if INSIGHTS_SCOPE in scopes:
            self._sync_media_insights(media[: self.settings.instagram_sync_max_media_insights])
            self._sync_account_insights()
        else:
            self._warn("insights_not_granted", "Insights were not fetched: the instagram_business_manage_insights permission was not granted.")
        if COMMENTS_SCOPE in scopes:
            self._sync_comments(media[: self.settings.instagram_sync_max_comment_media])
        self._finish(IgSyncStatus.partial if any(w.get("degraded") for w in self.warnings) else IgSyncStatus.success)

    def fail(self, exc: ProviderError) -> None:
        self.db.rollback()
        self.db.add_all([self.connection, self.run])
        code = {"token_invalid": "token_invalid", "permission_denied": "permission_denied", "rate_limited": "rate_limited"}.get(exc.kind, "provider_error")
        if exc.kind == "token_invalid":
            mark_needs_reauth(self.connection, "token_invalid", exc.safe_message)
        elif exc.kind == "permission_denied":
            mark_needs_reauth(self.connection, "permission_denied", exc.safe_message)
        else:
            self.connection.status = IgConnectionStatus.error
            self.connection.last_error_code, self.connection.last_error_message = code, exc.safe_message
        self.run.error_code, self.run.error_message = code, exc.safe_message
        self._finish(IgSyncStatus.failed, success=False)

    def _finish(self, status: IgSyncStatus, *, success: bool = True) -> None:
        now = utcnow()
        self.run.status, self.run.finished_at, self.run.warnings = status, now, self.warnings
        self.connection.last_sync_status = status.value
        if success:
            self.connection.last_synced_at = now
            self.connection.status = IgConnectionStatus.connected
            self.connection.last_error_code = self.connection.last_error_message = None

    def _warn(self, code: str, message: str, *, degraded: bool = False) -> None:
        self.warnings.append({"code": code, "message": message, "degraded": degraded})

    # ---------------------------------------------------------------- token lifecycle
    def _usable_token(self) -> str:
        row = self.db.get(InstagramToken, self.connection.id)
        now = utcnow()
        if row is None:
            self._stop_reauth("token_missing", "No access token is stored for this account. Reconnect it.")
        assert row is not None
        if row.expires_at and row.expires_at <= now:
            self._stop_reauth("token_expired", "The Instagram access token expired (long-lived tokens last 60 days unless refreshed). Reconnect the account.")
        try:
            token = self.cipher.decrypt(row.ciphertext, row.key_version)
        except TokenDecryptError:
            self._stop_reauth("token_unreadable", "The stored token cannot be decrypted with the configured key. Reconnect the account.")
        # Refresh rules (Meta): token must be ≥24 h old and unexpired; refresh when within the window.
        last_issue = row.refreshed_at or row.issued_at
        if row.expires_at and row.expires_at - now < REFRESH_WINDOW and now - last_issue >= timedelta(hours=24):
            try:
                fresh = self.client.refresh(token)
            except ProviderError as exc:
                if exc.kind == "token_invalid":
                    raise
                self._warn("token_refresh_failed", "Token refresh failed; the current token is still used until it expires.")
            else:
                expires = now + timedelta(seconds=fresh.expires_in) if fresh.expires_in else None
                store_token(self.db, self.cipher, self.connection, fresh.access_token, issued_at=now, expires_at=expires, refreshed=True)
                self.connection.token_expires_at = expires
                token = fresh.access_token
        elif row.key_version != self.cipher.current_version:  # opportunistic re-encryption after key rotation
            store_token(self.db, self.cipher, self.connection, token, issued_at=row.issued_at, expires_at=row.expires_at)
        return token

    def _stop_reauth(self, code: str, message: str) -> None:
        mark_needs_reauth(self.connection, code, message)
        self.run.error_code, self.run.error_message = code, message
        self._finish(IgSyncStatus.failed, success=False)
        raise _StopSync()

    # ---------------------------------------------------------------- media
    def _sync_media(self) -> list[InstagramMedia]:
        limit = self.settings.instagram_sync_max_media
        try:
            items, reached_end = self.client.list_media(self.token, self.connection.ig_user_id, MEDIA_CORE_FIELDS + MEDIA_OPTIONAL_FIELDS, max_items=limit)
        except ProviderError as exc:
            if exc.kind != "invalid_request":
                raise
            self._warn("media_fields_unavailable", "Caption and surface type are not available for this account through Instagram Login.")
            items, reached_end = self.client.list_media(self.token, self.connection.ig_user_id, MEDIA_CORE_FIELDS, max_items=limit)

        rows: list[InstagramMedia] = []
        seen: set[str] = set()
        for item in items:
            ig_media_id = str(item["id"])
            if ig_media_id in seen:
                continue
            seen.add(ig_media_id)
            values = {
                "media_type": _str(item.get("media_type"), 32),
                "media_product_type": _str(item.get("media_product_type"), 32),
                "caption": item.get("caption") if isinstance(item.get("caption"), str) else None,
                "permalink": _str(item.get("permalink"), 2000),
                "shortcode": _str(item.get("shortcode"), 64),
                "media_url": _str(item.get("media_url"), 4000),
                "thumbnail_url": _str(item.get("thumbnail_url"), 4000),
                "posted_at": _ts(item.get("timestamp")),
                "like_count": _count(item.get("like_count")),
                "comments_count": _count(item.get("comments_count")),
                "last_seen_at": self.captured_at,
                "removed_at": None,
            }
            stmt = insert(InstagramMedia).values(
                id=f"igm_{secrets.token_hex(8)}", workspace_id=self.connection.workspace_id, connection_id=self.connection.id,
                ig_media_id=ig_media_id, first_seen_at=self.captured_at, **values,
            ).on_conflict_do_update(index_elements=["connection_id", "ig_media_id"], set_=values)
            self.db.execute(stmt)
        self.db.flush()
        if seen:
            rows = list(self.db.scalars(select(InstagramMedia).where(
                InstagramMedia.connection_id == self.connection.id, InstagramMedia.ig_media_id.in_(seen))
                .order_by(InstagramMedia.posted_at.desc().nulls_last())))
        if reached_end:
            # The full media list was read: anything we stored but Instagram no longer returns was deleted there.
            self.db.execute(update(InstagramMedia).where(
                InstagramMedia.connection_id == self.connection.id, InstagramMedia.ig_media_id.not_in(seen or {""}),
                InstagramMedia.removed_at.is_(None)).values(removed_at=self.captured_at).execution_options(synchronize_session=False))
        else:
            self._warn("media_truncated", f"Only the {limit} most recent media were synced (bounded manual sync).")
        self.run.media_fetched = len(rows)
        self.db.commit()
        return rows

    def _sync_media_insights(self, media: list[InstagramMedia]) -> None:
        stored = 0
        for item in media:  # /media returns top-level objects only (album children have no insights)
            values, error = self._media_metric_values(item)
            if error == "not_found":
                item.removed_at = self.captured_at
                continue
            for metric in MEDIA_METRICS:
                value = values.get(metric)
                self.db.execute(insert(InstagramMediaInsight).values(
                    workspace_id=self.connection.workspace_id, media_id=item.id, metric=metric, period="lifetime",
                    value=value, status="ok" if value is not None else "unavailable", captured_at=self.captured_at,
                    api_version=self.client.api_version,
                ).on_conflict_do_nothing(index_elements=["media_id", "metric", "captured_at"]))
                stored += value is not None
        self.run.media_insights_fetched = stored
        self.db.commit()

    def _media_metric_values(self, item: InstagramMedia) -> tuple[dict[str, int], str | None]:
        """All metrics in one call; if Instagram rejects the set (unsupported metric for this media type),
        fall back to one call per metric so the supported ones are still collected."""
        try:
            return _metric_values(self.client.media_insights(self.token, item.ig_media_id, MEDIA_METRICS)), None
        except ProviderError as exc:
            if exc.kind == "not_found":
                return {}, "not_found"
            if exc.kind not in ("invalid_request", "permission_denied"):
                raise
        values: dict[str, int] = {}
        for metric in MEDIA_METRICS:
            try:
                values.update(_metric_values(self.client.media_insights(self.token, item.ig_media_id, [metric])))
            except ProviderError as exc:
                if exc.kind in ("token_invalid", "rate_limited", "unavailable"):
                    raise
        if len(values) < len(MEDIA_METRICS):
            self._warn("media_metrics_partial", "Some media metrics are not available for every media type; they are shown as unavailable.")
        return values, None

    def _sync_account_insights(self) -> None:
        until = self.captured_at.replace(minute=0, second=0, microsecond=0)
        since = until - timedelta(days=ACCOUNT_RANGE_DAYS)
        stored = 0
        totals = self._account_totals(since, until)
        for metric in ACCOUNT_TOTAL_METRICS:
            stored += self._upsert_account(metric, "total_value", since, until, totals.get(metric))
        try:
            series = self.client.account_insights(self.token, self.connection.ig_user_id, ACCOUNT_SERIES_METRICS, metric_type="time_series",
                                                  period="day", since=int(since.timestamp()), until=int(until.timestamp()))
        except ProviderError as exc:
            if exc.kind in ("token_invalid", "rate_limited", "unavailable"):
                raise
            self._warn("account_series_unavailable", "Daily reach is not available for this account.", degraded=True)
            series = []
        for entry in series:
            metric = entry.get("name")
            if metric not in ACCOUNT_SERIES_METRICS:
                continue
            for point in entry.get("values") or []:
                end = _ts(point.get("end_time"))
                value = _count(point.get("value"))
                if end is not None:
                    stored += self._upsert_account(metric, "time_series", end - timedelta(days=1), end, value)
        self.run.account_insights_fetched = stored
        self.db.commit()

    def _account_totals(self, since: datetime, until: datetime) -> dict[str, int]:
        def fetch(metrics: list[str]) -> dict[str, int]:
            data = self.client.account_insights(self.token, self.connection.ig_user_id, metrics, metric_type="total_value", period="day",
                                                since=int(since.timestamp()), until=int(until.timestamp()))
            return _metric_values(data)

        try:
            return fetch(ACCOUNT_TOTAL_METRICS)
        except ProviderError as exc:
            if exc.kind in ("token_invalid", "rate_limited", "unavailable"):
                raise
        values: dict[str, int] = {}
        for metric in ACCOUNT_TOTAL_METRICS:
            try:
                values.update(fetch([metric]))
            except ProviderError as exc:
                if exc.kind in ("token_invalid", "rate_limited", "unavailable"):
                    raise
        self._warn("account_metrics_partial", "Some account metrics are not available (e.g. too few followers or permission); they are shown as unavailable.",
                   degraded=not values)
        return values

    def _upsert_account(self, metric: str, metric_type: str, start: datetime, end: datetime, value: int | None) -> int:
        status = "ok" if value is not None else "unavailable"
        self.db.execute(insert(InstagramAccountInsight).values(
            workspace_id=self.connection.workspace_id, connection_id=self.connection.id, metric=metric, metric_type=metric_type,
            period="day", range_start=start, range_end=end, value=value, status=status, captured_at=self.captured_at,
            api_version=self.client.api_version,
        ).on_conflict_do_update(
            index_elements=["connection_id", "metric", "metric_type", "period", "range_start", "range_end"],
            set_={"value": value, "status": status, "captured_at": self.captured_at, "api_version": self.client.api_version},
        ))
        return int(value is not None)

    # ---------------------------------------------------------------- comments
    def _sync_comments(self, media: list[InstagramMedia]) -> None:
        fetched = 0
        for item in media:
            if item.removed_at is not None or item.comments_count == 0:
                continue
            try:
                rows = self.client.comments(self.token, item.ig_media_id, COMMENT_FIELDS, limit=50)
            except ProviderError as exc:
                if exc.kind in ("token_invalid", "rate_limited", "unavailable"):
                    raise
                self._warn("comments_unavailable", "Comments could not be read for some media.", degraded=True)
                continue
            for row in rows:
                fetched += self._upsert_comment(item, row, None)
                for reply in ((row.get("replies") or {}).get("data") or []):
                    if isinstance(reply, dict):
                        fetched += self._upsert_comment(item, reply, str(row.get("id")))
        self.run.comments_fetched = fetched
        self.db.commit()

    def _upsert_comment(self, media: InstagramMedia, row: dict, parent_id: str | None) -> int:
        if not row.get("id"):
            return 0
        values = {
            "media_id": media.id,
            "parent_ig_comment_id": _str(row.get("parent_id"), 64) or parent_id,
            "text": row.get("text") if isinstance(row.get("text"), str) else None,
            "username": _str(row.get("username"), 64),
            "like_count": _count(row.get("like_count")),
            "hidden": row.get("hidden") if isinstance(row.get("hidden"), bool) else None,
            "commented_at": _ts(row.get("timestamp")),
            "last_seen_at": self.captured_at,
        }
        self.db.execute(insert(InstagramComment).values(
            id=f"igcm_{secrets.token_hex(8)}", workspace_id=self.connection.workspace_id, connection_id=self.connection.id,
            ig_comment_id=str(row["id"]), first_seen_at=self.captured_at, **values,
        ).on_conflict_do_update(index_elements=["connection_id", "ig_comment_id"], set_=values))
        return 1


# -------------------------------------------------------------------------------- parsing
def _metric_values(data: list[dict]) -> dict[str, int]:
    """{metric: value} for metrics that actually returned a value (``values[0].value`` or ``total_value.value``)."""
    out: dict[str, int] = {}
    for entry in data:
        name = entry.get("name")
        if not isinstance(name, str):
            continue
        value = (entry.get("total_value") or {}).get("value")
        if value is None and entry.get("values"):
            value = (entry["values"][0] or {}).get("value")
        if (count := _count(value)) is not None:
            out[name] = count
    return out


def _count(value: object) -> int | None:
    return int(value) if isinstance(value, int | float) and not isinstance(value, bool) and value >= 0 else None


def _str(value: object, limit: int) -> str | None:
    return value[:limit] if isinstance(value, str) and value else None


def _ts(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.utcoffset() is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        try:  # Graph format "2024-01-01T00:00:00+0000"
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
        except ValueError:
            return None
