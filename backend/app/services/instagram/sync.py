"""Incremental Instagram sync engine — one execution of one durable job (see ``jobs.py`` for the lifecycle).

Stages (progress %): token 5 → profile 15 → media 40 → media insights 70 → account insights 85 → comments 95.

* **Profile**: supported /me fields are updated and followers/follows/media counts are recorded as hourly
  ``snapshot`` observations, so follower history accumulates instead of being overwritten.
* **Media**: the newest ``INSTAGRAM_SYNC_MAX_MEDIA`` items are refreshed every run (mutable counts), and a
  rolling backfill continues from a saved Meta paging cursor by ``INSTAGRAM_BACKFILL_BATCH_SIZE`` older items per
  run. Only a pass that reaches the end of the list marks media missing from it as removed.
* **Media insights**: never-checked media first, then recent media (``INSTAGRAM_RECENT_MEDIA_DAYS``) every
  ``INSTAGRAM_RECENT_INSIGHTS_REFRESH_HOURS``, then older media every ``INSTAGRAM_OLDER_INSIGHTS_REFRESH_DAYS``,
  skipping media older than Meta's 2-year insight retention. Metrics Instagram rejects for a media object (#100)
  are remembered and not requested again; metrics merely not returned are stored as ``unavailable``.
* **Account insights**: 28-day ``total_value`` totals and daily ``reach`` (``time_series``).
* **Comments**: only with ``instagram_business_manage_comments``; up to ``INSTAGRAM_COMMENT_PAGES_PER_MEDIA``
  pages for the newest commented media.

Every observation carries the job's fixed ``observation_at``, so a retried or redelivered job writes the same
keys again (no-ops) — retries cannot duplicate media, comments or historical observations.
"""

from __future__ import annotations

import secrets
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import InstagramAccountInsight, InstagramComment, InstagramConnection, InstagramMedia, InstagramMediaInsight, InstagramSyncRun, InstagramToken
from app.models.enums import IgSyncStatus
from app.services.common import utcnow

from .connections import PROFILE_FIELDS, apply_profile, store_token
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
PROFILE_SNAPSHOT_METRICS = ["followers_count", "follows_count", "media_count"]
ACCOUNT_RANGE_DAYS = 28
COMMENT_FIELDS = "id,text,timestamp,username,like_count,hidden,parent_id,replies{id,text,timestamp,username,like_count,hidden,parent_id}"
INSIGHTS_SCOPE = "instagram_business_manage_insights"
COMMENTS_SCOPE = "instagram_business_manage_comments"
REFRESH_WINDOW = timedelta(days=15)
FATAL_KINDS = ("token_invalid", "rate_limited", "unavailable", "bad_response")


class StopSync(Exception):
    """Terminal, non-provider stop (token missing/expired/unreadable): the job fails and needs reauthorization."""

    def __init__(self, category: str, message: str) -> None:
        super().__init__(message)
        self.category, self.message = category, message


class JobCancelled(Exception):
    pass


class SyncEngine:
    def __init__(self, db: Session, settings: Settings, client: InstagramClient, cipher: TokenCipher,
                 connection: InstagramConnection, job: InstagramSyncRun, checkpoint: Callable[[str, int], None]) -> None:
        self.db, self.settings, self.client, self.cipher = db, settings, client, cipher
        self.connection, self.job = connection, job
        self.observed = job.observation_at
        self.checkpoint = checkpoint  # commits progress, renews the lease, raises JobCancelled if requested
        self.warnings: list[dict] = []
        self.token = ""

    # ---------------------------------------------------------------- orchestration
    def run(self) -> IgSyncStatus:
        self.checkpoint("token", 5)
        self.token = self._usable_token()
        self._sync_profile()
        self.checkpoint("media", 15)
        self._sync_media()
        scopes = set(self.connection.granted_scopes or [])
        self.checkpoint("media_insights", 40)
        if INSIGHTS_SCOPE in scopes:
            self._sync_media_insights()
            self.checkpoint("account_insights", 70)
            self._sync_account_insights()
        else:
            self._warn("insights_not_granted", "Insights were not fetched: the instagram_business_manage_insights permission was not granted.")
        self.checkpoint("comments", 85)
        if COMMENTS_SCOPE in scopes:
            self._sync_comments()
        self.checkpoint("finishing", 95)
        self.job.warnings = self.warnings
        return IgSyncStatus.partially_succeeded if any(w.get("degraded") for w in self.warnings) else IgSyncStatus.succeeded

    def _warn(self, code: str, message: str, *, degraded: bool = False) -> None:
        if not any(w["code"] == code for w in self.warnings):
            self.warnings.append({"code": code, "message": message, "degraded": degraded})

    def _count(self, field: str, n: int) -> None:
        setattr(self.job, field, getattr(self.job, field) + n)
        self.job.records_processed += n

    # ---------------------------------------------------------------- token lifecycle
    def _usable_token(self) -> str:
        row = self.db.get(InstagramToken, self.connection.id)
        now = utcnow()
        if row is None:
            raise StopSync("token_missing", "No access token is stored for this account. Reconnect it.")
        if row.expires_at and row.expires_at <= now:
            raise StopSync("token_expired", "The Instagram access token expired (long-lived tokens last 60 days unless refreshed). Reconnect the account.")
        try:
            token = self.cipher.decrypt(row.ciphertext, row.key_version)
        except TokenDecryptError:
            raise StopSync("token_unreadable", "The stored token cannot be decrypted with the configured key. Reconnect the account.") from None
        # Refresh rules (Meta): token must be ≥24 h old and unexpired; refresh when within the window.
        last_issue = row.refreshed_at or row.issued_at
        if row.expires_at and row.expires_at - now < REFRESH_WINDOW and now - last_issue >= timedelta(hours=24):
            try:
                fresh = self.client.refresh(token)
            except ProviderError as exc:
                if exc.kind in ("token_invalid", "rate_limited"):
                    raise
                self._warn("token_refresh_failed", "Token refresh failed; the current token is still used until it expires.")
            else:
                expires = now + timedelta(seconds=fresh.expires_in) if fresh.expires_in else None
                store_token(self.db, self.cipher, self.connection, fresh.access_token, issued_at=now, expires_at=expires, refreshed=True)
                self.connection.token_expires_at = expires
                token = fresh.access_token
                self.db.commit()
        elif row.key_version != self.cipher.current_version:  # opportunistic re-encryption after key rotation
            store_token(self.db, self.cipher, self.connection, token, issued_at=row.issued_at, expires_at=row.expires_at)
            self.db.commit()
        return token

    # ---------------------------------------------------------------- profile
    def _sync_profile(self) -> None:
        profile = self.client.me(self.token, PROFILE_FIELDS)
        apply_profile(self.connection, profile, self.observed)
        hour = self.observed.replace(minute=0, second=0, microsecond=0)
        for metric in PROFILE_SNAPSHOT_METRICS:
            value = getattr(self.connection, metric)
            self._upsert_account(metric, "snapshot", "lifetime", hour, hour, value)
        self.db.commit()

    # ---------------------------------------------------------------- media
    def _fetch_media(self, *, max_items: int, after: str | None) -> tuple[list[dict], str | None]:
        fields = MEDIA_CORE_FIELDS + MEDIA_OPTIONAL_FIELDS
        if any(w["code"] == "media_fields_unavailable" for w in self.warnings):
            fields = MEDIA_CORE_FIELDS
        try:
            return self.client.list_media(self.token, self.connection.ig_user_id, fields, max_items=max_items, after=after)
        except ProviderError as exc:
            if exc.kind != "invalid_request" or fields == MEDIA_CORE_FIELDS:
                raise
            self._warn("media_fields_unavailable", "Caption and surface type are not available for this account through Instagram Login.")
            return self.client.list_media(self.token, self.connection.ig_user_id, MEDIA_CORE_FIELDS, max_items=max_items, after=after)

    def _sync_media(self) -> None:
        c = self.connection
        head, head_next = self._fetch_media(max_items=self.settings.instagram_sync_max_media, after=None)
        self._upsert_media(head)
        if c.media_backfill_cursor is None or c.media_full_pass_started_at is None:
            # Start a new full pass: everything seen from here until the end of the list counts as "still exists".
            c.media_full_pass_started_at = self.observed
            c.media_backfill_cursor = head_next
            reached_end = head_next is None
        else:
            reached_end = False
        if not reached_end and self.settings.instagram_backfill_batch_size and c.media_backfill_cursor:
            try:
                older, nxt = self._fetch_media(max_items=self.settings.instagram_backfill_batch_size, after=c.media_backfill_cursor)
            except ProviderError as exc:
                if exc.kind != "invalid_request":
                    raise
                # Paging cursors can expire; restart the pass next time instead of failing the job.
                self._warn("backfill_restarted", "The saved media paging position expired; the backfill restarts on the next sync.")
                c.media_backfill_cursor = c.media_full_pass_started_at = None
                older, nxt = [], "restart"
            self._upsert_media(older)
            if nxt != "restart":
                c.media_backfill_cursor = nxt
                reached_end = nxt is None
        if reached_end and c.media_full_pass_started_at is not None:
            # The whole list was read since the pass started: media not seen during it were deleted on Instagram.
            self.db.execute(update(InstagramMedia).where(
                InstagramMedia.connection_id == c.id, InstagramMedia.removed_at.is_(None),
                InstagramMedia.last_seen_at < c.media_full_pass_started_at,
            ).values(removed_at=self.observed).execution_options(synchronize_session=False))
            c.media_backfill_completed_at = self.observed
            c.media_backfill_cursor = c.media_full_pass_started_at = None
        elif c.media_backfill_cursor:
            self._warn("media_backfill_in_progress", "Older media are still being backfilled in batches; history fills in over the next syncs.")
        self.db.commit()

    def _upsert_media(self, items: list[dict]) -> None:
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
                "last_seen_at": self.observed,
                "removed_at": None,
            }
            self.db.execute(insert(InstagramMedia).values(
                id=f"igm_{secrets.token_hex(8)}", workspace_id=self.connection.workspace_id, connection_id=self.connection.id,
                ig_media_id=ig_media_id, first_seen_at=self.observed, **values,
            ).on_conflict_do_update(index_elements=["connection_id", "ig_media_id"], set_=values))
        self._count("media_fetched", len(seen))

    # ---------------------------------------------------------------- media insights
    def _insight_candidates(self) -> list[InstagramMedia]:
        now = utcnow()
        s = self.settings
        recent_cutoff = now - timedelta(days=s.instagram_recent_media_days)
        due = or_(
            InstagramMedia.insights_checked_at.is_(None),
            (InstagramMedia.posted_at >= recent_cutoff) & (InstagramMedia.insights_checked_at < now - timedelta(hours=s.instagram_recent_insights_refresh_hours)),
            InstagramMedia.insights_checked_at < now - timedelta(days=s.instagram_older_insights_refresh_days),
        )
        return list(self.db.scalars(
            select(InstagramMedia).where(
                InstagramMedia.connection_id == self.connection.id, InstagramMedia.removed_at.is_(None),
                or_(InstagramMedia.posted_at.is_(None), InstagramMedia.posted_at >= now - timedelta(days=s.instagram_insights_max_age_days)),
                due,
            ).order_by(InstagramMedia.insights_checked_at.asc().nulls_first(), InstagramMedia.posted_at.desc().nulls_last())
            .limit(s.instagram_sync_max_media_insights)
        ))

    def _sync_media_insights(self) -> None:
        candidates = self._insight_candidates()
        for index, item in enumerate(candidates, 1):
            metrics = [m for m in MEDIA_METRICS if m not in (item.unsupported_metrics or [])]
            values, gone = self._media_metric_values(item, metrics)
            item.insights_checked_at = self.observed
            if gone:
                item.removed_at = self.observed
                continue
            stored = 0
            for metric in metrics:
                value = values.get(metric)
                result = self.db.execute(insert(InstagramMediaInsight).values(
                    workspace_id=self.connection.workspace_id, media_id=item.id, metric=metric, period="lifetime", value=value,
                    status="ok" if value is not None else "unavailable", captured_at=self.observed, api_version=self.client.api_version,
                    unit="count", source="instagram_api",
                ).on_conflict_do_nothing(index_elements=["media_id", "metric", "captured_at"]))
                stored += int(value is not None and result.rowcount > 0)
            self._count("media_insights_fetched", stored)
            if index % 5 == 0:
                self.checkpoint("media_insights", 40 + int(30 * index / len(candidates)))
        if len(candidates) == self.settings.instagram_sync_max_media_insights:
            self._warn("media_insights_queued", "More media are due for an insights refresh; they are handled by the next syncs.")
        self.db.commit()

    def _media_metric_values(self, item: InstagramMedia, metrics: list[str]) -> tuple[dict[str, int], bool]:
        """All metrics in one call; if Instagram rejects the set, one call per metric so the supported ones are
        still collected and permanently unsupported ones (#100 for that single metric) are remembered."""
        if not metrics:
            return {}, False
        try:
            return _metric_values(self.client.media_insights(self.token, item.ig_media_id, metrics)), False
        except ProviderError as exc:
            if exc.kind == "not_found":
                return {}, True
            if exc.kind not in ("invalid_request", "permission_denied"):
                raise
        values: dict[str, int] = {}
        unsupported = list(item.unsupported_metrics or [])
        for metric in metrics:
            try:
                values.update(_metric_values(self.client.media_insights(self.token, item.ig_media_id, [metric])))
            except ProviderError as exc:
                if exc.kind in FATAL_KINDS:
                    raise
                if exc.kind == "invalid_request" and exc.provider_code == 100:
                    unsupported.append(metric)
        if unsupported != list(item.unsupported_metrics or []):
            item.unsupported_metrics = sorted(set(unsupported))
        if len(values) < len(metrics):
            self._warn("media_metrics_partial", "Some media metrics are not available for every media type; they are shown as unavailable.")
        return values, False

    # ---------------------------------------------------------------- account insights
    def _sync_account_insights(self) -> None:
        until = self.observed.replace(minute=0, second=0, microsecond=0)
        since = until - timedelta(days=ACCOUNT_RANGE_DAYS)
        skip = set(self.connection.unsupported_account_metrics or [])
        metrics = [m for m in ACCOUNT_TOTAL_METRICS if m not in skip]
        totals = self._account_totals(metrics, since, until)
        stored = sum(self._upsert_account(m, "total_value", "day", since, until, totals.get(m)) for m in metrics)
        try:
            series = self.client.account_insights(self.token, self.connection.ig_user_id, ACCOUNT_SERIES_METRICS, metric_type="time_series",
                                                  period="day", since=int(since.timestamp()), until=int(until.timestamp()))
        except ProviderError as exc:
            if exc.kind in FATAL_KINDS:
                raise
            self._warn("account_series_unavailable", "Daily reach is not available for this account.", degraded=True)
            series = []
        for entry in series:
            metric = entry.get("name")
            if metric not in ACCOUNT_SERIES_METRICS:
                continue
            for point in entry.get("values") or []:
                end = _ts(point.get("end_time"))
                if end is not None:
                    stored += self._upsert_account(metric, "time_series", "day", end - timedelta(days=1), end, _count(point.get("value")))
        self._count("account_insights_fetched", stored)
        self.db.commit()

    def _account_totals(self, metrics: list[str], since: datetime, until: datetime) -> dict[str, int]:
        def fetch(names: list[str]) -> dict[str, int]:
            data = self.client.account_insights(self.token, self.connection.ig_user_id, names, metric_type="total_value", period="day",
                                                since=int(since.timestamp()), until=int(until.timestamp()))
            return _metric_values(data)

        if not metrics:
            return {}
        try:
            return fetch(metrics)
        except ProviderError as exc:
            if exc.kind in FATAL_KINDS:
                raise
        values: dict[str, int] = {}
        unsupported = list(self.connection.unsupported_account_metrics or [])
        for metric in metrics:
            try:
                values.update(fetch([metric]))
            except ProviderError as exc:
                if exc.kind in FATAL_KINDS:
                    raise
                if exc.kind == "invalid_request" and exc.provider_code == 100:
                    unsupported.append(metric)
        self.connection.unsupported_account_metrics = sorted(set(unsupported))
        self._warn("account_metrics_partial", "Some account metrics are not available (e.g. too few followers or permission); they are shown as unavailable.",
                   degraded=not values)
        return values

    def _upsert_account(self, metric: str, metric_type: str, period: str, start: datetime, end: datetime, value: int | None) -> int:
        status = "ok" if value is not None else "unavailable"
        self.db.execute(insert(InstagramAccountInsight).values(
            workspace_id=self.connection.workspace_id, connection_id=self.connection.id, metric=metric, metric_type=metric_type,
            period=period, range_start=start, range_end=end, value=value, status=status, captured_at=self.observed,
            api_version=self.client.api_version, unit="count", source="instagram_api",
        ).on_conflict_do_update(
            constraint="uq_instagram_account_insights_range",
            set_={"value": value, "status": status, "captured_at": self.observed, "api_version": self.client.api_version},
        ))
        return int(value is not None)

    # ---------------------------------------------------------------- comments
    def _sync_comments(self) -> None:
        media = list(self.db.scalars(select(InstagramMedia).where(
            InstagramMedia.connection_id == self.connection.id, InstagramMedia.removed_at.is_(None),
            or_(InstagramMedia.comments_count.is_(None), InstagramMedia.comments_count > 0),
        ).order_by(InstagramMedia.posted_at.desc().nulls_last()).limit(self.settings.instagram_sync_max_comment_media)))
        for item in media:
            after: str | None = None
            for _page in range(self.settings.instagram_comment_pages_per_media):
                try:
                    rows, after = self.client.comments_page(self.token, item.ig_media_id, COMMENT_FIELDS, limit=50, after=after)
                except ProviderError as exc:
                    if exc.kind in FATAL_KINDS:
                        raise
                    self._warn("comments_unavailable", "Comments could not be read for some media.", degraded=True)
                    break
                for row in rows:
                    self._upsert_comment(item, row, None)
                    for reply in ((row.get("replies") or {}).get("data") or []):
                        if isinstance(reply, dict):
                            self._upsert_comment(item, reply, str(row.get("id")))
                if after is None:
                    break
        self.db.commit()

    def _upsert_comment(self, media: InstagramMedia, row: dict, parent_id: str | None) -> None:
        if not row.get("id"):
            return
        values = {
            "media_id": media.id,
            "parent_ig_comment_id": _str(row.get("parent_id"), 64) or parent_id,
            "text": row.get("text") if isinstance(row.get("text"), str) else None,
            "username": _str(row.get("username"), 64),
            "like_count": _count(row.get("like_count")),
            "hidden": row.get("hidden") if isinstance(row.get("hidden"), bool) else None,
            "commented_at": _ts(row.get("timestamp")),
            "last_seen_at": self.observed,
        }
        self.db.execute(insert(InstagramComment).values(
            id=f"igcm_{secrets.token_hex(8)}", workspace_id=self.connection.workspace_id, connection_id=self.connection.id,
            ig_comment_id=str(row["id"]), first_seen_at=self.observed, **values,
        ).on_conflict_do_update(index_elements=["connection_id", "ig_comment_id"], set_=values))
        self._count("comments_fetched", 1)


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
