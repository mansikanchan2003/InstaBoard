"""Server-managed OAuth (Business Login for Instagram), connection lifecycle and Meta callbacks.

Flow:

1. ``begin_connect`` (authenticated, ``accounts:manage``, CSRF-protected POST) creates a random single-use
   ``state`` — only its SHA-256 digest is stored, bound to the user, session and workspace, valid for
   ``INSTAGRAM_OAUTH_STATE_TTL_SECONDS`` — and returns the official authorization URL.
2. ``complete_callback`` (GET from Instagram's redirect) atomically consumes the state, requires the *same*
   signed-in session that started the flow, handles cancellation/errors, exchanges the code server-side,
   upgrades to a long-lived token, reads ``/me`` to identify the professional account and stores the
   connection in the state's workspace (never a workspace taken from the callback URL).

Meta's documentation for this flow defines ``state`` but no PKCE parameters, so PKCE is not used.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, ConflictError, NotFoundError
from app.core.tenancy import bind_workspace
from app.models import (
    InstagramAccountInsight, InstagramConnection, InstagramDataDeletionRequest, InstagramMedia, InstagramOAuthState,
    InstagramToken, TeamMember,
)
from app.models.enums import IgConnectionStatus
from app.services.audit import record_activity
from app.services.auth import AuthContext, AuthError, authenticate
from app.services.common import utcnow
from app.services.permissions import has_permission

from .crypto import TokenCipher
from .provider import InstagramClient, ProviderError

PROFILE_FIELDS = ["id", "user_id", "username", "name", "account_type", "profile_picture_url", "followers_count", "follows_count", "media_count"]
PROFESSIONAL_TYPES = {"BUSINESS", "MEDIA_CREATOR", "CREATOR"}


class IntegrationDisabledError(ApiError):
    status_code = 503
    code = "integration_disabled"

    def __init__(self, missing: list[str]) -> None:
        super().__init__("The Instagram integration is not configured on this server.", details={"missing": missing})


def ensure_enabled(settings: Settings) -> None:
    if not settings.instagram_enabled:
        raise IntegrationDisabledError(settings.instagram_missing_config)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ------------------------------------------------------------------------------------ connect
def begin_connect(db: Session, settings: Settings, client: InstagramClient, ctx: AuthContext) -> str:
    ensure_enabled(settings)
    now = utcnow()
    # Housekeeping: expired or used states of this workspace are no longer needed.
    db.execute(delete(InstagramOAuthState).where(
        (InstagramOAuthState.expires_at < now) | (InstagramOAuthState.consumed_at.is_not(None))))
    state = secrets.token_urlsafe(32)
    db.add(InstagramOAuthState(
        id=f"igs_{secrets.token_hex(8)}", state_hash=_digest(state), workspace_id=ctx.workspace_id, user_id=ctx.user_id,
        member_id=ctx.member_id, session_id=ctx.session_id, created_at=now,
        expires_at=now + timedelta(seconds=settings.instagram_oauth_state_ttl_seconds),
    ))
    return client.authorize_url(state)


@dataclass
class CallbackResult:
    outcome: str  # "connected" or an error reason code (see CALLBACK_REASONS)
    connection_id: str | None = None


# Reason codes the frontend knows how to explain. Nothing else is ever placed in the redirect URL.
CALLBACK_REASONS = {
    "connected", "access_denied", "authorization_failed", "invalid_state", "state_expired", "state_used",
    "session_mismatch", "forbidden", "invalid_callback", "exchange_failed", "permission_missing",
    "not_professional", "account_mismatch", "rate_limited", "provider_unavailable", "integration_disabled",
}


def complete_callback(db: Session, settings: Settings, client_factory, cipher_factory, *, state: str | None, code: str | None,
                      error: str | None, session_token: str | None) -> CallbackResult:
    if not settings.instagram_enabled:
        return CallbackResult("integration_disabled")
    if not state or len(state) > 200:
        return CallbackResult("invalid_state")

    # 1. Consume the state atomically — a replayed or concurrent duplicate callback finds nothing to consume.
    now = utcnow()
    row = db.execute(
        update(InstagramOAuthState)
        .where(InstagramOAuthState.state_hash == _digest(state), InstagramOAuthState.consumed_at.is_(None))
        .values(consumed_at=now)
        .returning(InstagramOAuthState.workspace_id, InstagramOAuthState.user_id, InstagramOAuthState.member_id,
                   InstagramOAuthState.session_id, InstagramOAuthState.expires_at)
        .execution_options(synchronize_session=False)
    ).first()
    db.commit()
    if row is None:
        used = db.scalar(select(InstagramOAuthState.id).where(InstagramOAuthState.state_hash == _digest(state)))
        return CallbackResult("state_used" if used else "invalid_state")
    workspace_id, user_id, member_id, session_id, expires_at = row
    if expires_at <= now:
        return CallbackResult("state_expired")

    # 2. The callback must arrive in the same signed-in session that started the flow (GET: no CSRF header;
    #    the single-use state is the CSRF protection, the session check defeats login/session swapping).
    try:
        ctx = authenticate(db, settings, token=session_token, method="GET", origin=None, csrf_header=None)
    except AuthError:
        return CallbackResult("session_mismatch")
    if ctx.session_id != session_id or ctx.user_id != user_id or ctx.workspace_id != workspace_id or ctx.member_id != member_id:
        return CallbackResult("session_mismatch")
    if not has_permission(ctx.role, "accounts:manage"):  # role may have changed since the flow started
        return CallbackResult("forbidden")

    # 3. Cancellation / provider-side errors.
    if error:
        return CallbackResult("access_denied" if error == "access_denied" else "authorization_failed")
    code = (code or "").removesuffix("#_").strip()
    if not code or len(code) > 2048:
        return CallbackResult("invalid_callback")

    # 4. Server-side exchange: code → short-lived → long-lived; identify the professional account.
    client: InstagramClient = client_factory()
    try:
        short = client.exchange_code(code)
        if "instagram_business_basic" not in short.permissions:
            return CallbackResult("permission_missing")
        long = client.exchange_long_lived(short.access_token)
        profile = client.me(long.access_token, PROFILE_FIELDS)
    except ProviderError as exc:
        return CallbackResult({"rate_limited": "rate_limited", "unavailable": "provider_unavailable"}.get(exc.kind, "exchange_failed"))
    finally:
        client.close()

    ig_user_id = str(profile.get("user_id") or "")
    scoped_id = str(profile.get("id") or "") or short.user_id
    if not ig_user_id or not profile.get("username"):
        return CallbackResult("exchange_failed")
    if short.user_id and scoped_id and short.user_id != scoped_id and short.user_id != ig_user_id:
        return CallbackResult("account_mismatch")  # token and profile disagree about who authorized
    account_type = str(profile.get("account_type") or "").upper() or None
    if account_type and account_type not in PROFESSIONAL_TYPES:
        return CallbackResult("not_professional")

    # 5. Store in the state's workspace.
    bind_workspace(db, workspace_id)
    connection = db.scalar(select(InstagramConnection).where(InstagramConnection.ig_user_id == ig_user_id))
    reconnect = connection is not None
    if connection is None:
        connection = InstagramConnection(id=f"igc_{secrets.token_hex(8)}", workspace_id=workspace_id, ig_user_id=ig_user_id,
                                         connected_at=now, granted_scopes=[], status=IgConnectionStatus.connected, username="")
        db.add(connection)
    apply_profile(connection, profile, now)
    connection.app_scoped_user_id = scoped_id or None
    connection.granted_scopes = sorted(set(short.permissions))
    connection.status = IgConnectionStatus.connected
    connection.connected_by_member_id = member_id
    connection.connected_at = now
    connection.disconnected_at = None
    connection.last_error_code = connection.last_error_message = None
    expires = now + timedelta(seconds=long.expires_in) if long.expires_in else None
    connection.token_expires_at = expires
    store_token(db, cipher_factory(), connection, long.access_token, issued_at=now, expires_at=expires)
    db.flush()
    record_activity(
        db, workspace_id=workspace_id, category="data_sync", kind="Integration", kind_icon="link", kind_tone="neutral",
        kind_icon_class="text-text-secondary", title="Instagram Account Reconnected" if reconnect else "Instagram Account Connected",
        summary=f"@{connection.username} was connected through Instagram Login.",
        narrative=f"@{connection.username} authorized InstaBoard with: {', '.join(connection.granted_scopes)}. The access token is stored encrypted.",
        target={"label": f"@{connection.username}", "to": "/accounts", "module": "Accounts"}, actor_id=member_id,
        payload={"type": "INSTAGRAM_CONNECTED", "connection_id": connection.id, "scopes": connection.granted_scopes},
    )
    db.commit()
    return CallbackResult("connected", connection.id)


def apply_profile(connection: InstagramConnection, profile: dict, now: datetime) -> None:
    """Copy supported /me fields; absent fields become NULL (never 0)."""
    def as_int(key: str) -> int | None:
        value = profile.get(key)
        return int(value) if isinstance(value, int | float) and value >= 0 else None

    connection.username = str(profile.get("username") or connection.username)[:64]
    connection.name = (str(profile["name"])[:200] if profile.get("name") else None)
    connection.account_type = (str(profile["account_type"]).upper()[:32] if profile.get("account_type") else None)
    connection.profile_picture_url = profile.get("profile_picture_url") or None
    connection.followers_count = as_int("followers_count")
    connection.follows_count = as_int("follows_count")
    connection.media_count = as_int("media_count")
    connection.profile_fetched_at = now


def store_token(db: Session, cipher: TokenCipher, connection: InstagramConnection, token: str, *, issued_at: datetime,
                expires_at: datetime | None, refreshed: bool = False) -> None:
    ciphertext, version = cipher.encrypt(token)
    row = db.get(InstagramToken, connection.id)
    if row is None:
        row = InstagramToken(connection_id=connection.id, workspace_id=connection.workspace_id, issued_at=issued_at)
        db.add(row)
    row.ciphertext, row.key_version = ciphertext, version
    row.expires_at = expires_at
    if refreshed:
        row.refreshed_at = issued_at
    else:
        row.issued_at, row.refreshed_at = issued_at, None


# ------------------------------------------------------------------------------ disconnect
def get_connection(db: Session, connection_id: str, *, include_disconnected: bool = False) -> InstagramConnection:
    connection = db.get(InstagramConnection, connection_id)
    if connection is None or (connection.status == IgConnectionStatus.disconnected and not include_disconnected):
        raise NotFoundError("Instagram account", connection_id)
    return connection


def purge_provider_data(db: Session, connection: InstagramConnection) -> None:
    """Delete the token and every record ingested for this connection (media cascades to insights and comments).
    The connection row stays as a tombstone (username + timestamps) and sync audits remain."""
    db.execute(delete(InstagramToken).where(InstagramToken.connection_id == connection.id))
    db.execute(delete(InstagramAccountInsight).where(InstagramAccountInsight.connection_id == connection.id))
    db.execute(delete(InstagramMedia).where(InstagramMedia.connection_id == connection.id))
    connection.token_expires_at = None
    connection.profile_picture_url = None
    connection.followers_count = connection.follows_count = connection.media_count = None


def disconnect(db: Session, ctx: AuthContext, connection_id: str) -> InstagramConnection:
    connection = get_connection(db, connection_id)
    cancel_active_jobs(db, connection)
    purge_provider_data(db, connection)
    connection.status = IgConnectionStatus.disconnected
    connection.disconnected_at = utcnow()
    connection.last_error_code = connection.last_error_message = None
    member = db.get(TeamMember, ctx.member_id)
    record_activity(
        db, workspace_id=ctx.workspace_id, category="data_sync", kind="Integration", kind_icon="link_off", kind_tone="neutral",
        kind_icon_class="text-text-secondary", title="Instagram Account Disconnected",
        summary=f"@{connection.username} was disconnected{f' by {member.name}' if member else ''}.",
        narrative="The encrypted access token and all media, insights and comments fetched for this account were deleted. "
                  "InstaBoard can no longer call Instagram for it. Revoke the app in Instagram settings to remove Meta's grant too.",
        target={"label": f"@{connection.username}", "to": "/accounts", "module": "Accounts"}, actor_id=ctx.member_id,
        payload={"type": "INSTAGRAM_DISCONNECTED", "connection_id": connection.id},
    )
    return connection


def cancel_active_jobs(db: Session, connection: InstagramConnection) -> None:
    """Queued/retrying jobs are cancelled now; a running job stops at its next checkpoint (it re-checks the
    connection and finds it disconnected) and never writes data after the purge."""
    from app.models import InstagramSyncRun

    now = utcnow()
    db.execute(update(InstagramSyncRun).where(InstagramSyncRun.connection_id == connection.id,
                                              InstagramSyncRun.status.in_(("queued", "retrying")))
               .values(status="cancelled", finished_at=now, error_category="connection_disconnected",
                       error_message="The account was disconnected.", next_retry_at=None)
               .execution_options(synchronize_session=False))
    db.execute(update(InstagramSyncRun).where(InstagramSyncRun.connection_id == connection.id, InstagramSyncRun.status == "running")
               .values(cancel_requested=True).execution_options(synchronize_session=False))


def mark_needs_reauth(connection: InstagramConnection, code: str, message: str) -> None:
    connection.status = IgConnectionStatus.needs_reauth
    connection.last_error_code, connection.last_error_message = code, message


# --------------------------------------------------------------------- Meta signed callbacks
class SignedRequestError(ApiError):
    status_code = 400
    code = "invalid_signed_request"

    def __init__(self) -> None:
        super().__init__("The signed_request could not be verified.")


def parse_signed_request(signed_request: str | None, app_secret: str) -> dict:
    """Verify Meta's ``signed_request`` (``<b64url HMAC-SHA256 sig>.<b64url JSON payload>``)."""
    if not signed_request or "." not in signed_request or len(signed_request) > 8192:
        raise SignedRequestError()
    encoded_sig, payload = signed_request.split(".", 1)

    def b64(data: str) -> bytes:
        return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))

    try:
        signature, data = b64(encoded_sig), json.loads(b64(payload))
    except (ValueError, json.JSONDecodeError):
        raise SignedRequestError() from None
    expected = hmac.new(app_secret.encode(), payload.encode(), hashlib.sha256).digest()
    if not isinstance(data, dict) or str(data.get("algorithm", "")).upper() != "HMAC-SHA256" or not hmac.compare_digest(signature, expected):
        raise SignedRequestError()
    if not data.get("user_id"):
        raise SignedRequestError()
    return data


def _connections_for_provider_user(db: Session, provider_user_id: str) -> list[InstagramConnection]:
    # Called without a bound workspace (Meta's request names no workspace): every matching connection.
    return list(db.scalars(select(InstagramConnection).where(
        (InstagramConnection.app_scoped_user_id == provider_user_id) | (InstagramConnection.ig_user_id == provider_user_id))))


def handle_deauthorize(db: Session, settings: Settings, signed_request: str | None) -> int:
    """The user removed the app in Instagram: delete tokens; data is kept until they reconnect or disconnect."""
    data = parse_signed_request(signed_request, settings.instagram_app_secret.get_secret_value())  # type: ignore[union-attr]
    affected = 0
    for connection in _connections_for_provider_user(db, str(data["user_id"])):
        cancel_active_jobs(db, connection)
        db.execute(delete(InstagramToken).where(InstagramToken.connection_id == connection.id))
        if connection.status != IgConnectionStatus.disconnected:
            mark_needs_reauth(connection, "app_removed", "InstaBoard was removed from this Instagram account's apps. Reconnect to resume.")
            connection.token_expires_at = None
        affected += 1
    return affected


def handle_data_deletion(db: Session, settings: Settings, signed_request: str | None) -> InstagramDataDeletionRequest:
    """Meta data-deletion callback: purge everything stored for the Instagram user and return a receipt."""
    data = parse_signed_request(signed_request, settings.instagram_app_secret.get_secret_value())  # type: ignore[union-attr]
    provider_user_id = str(data["user_id"])
    connections = _connections_for_provider_user(db, provider_user_id)
    for connection in connections:
        cancel_active_jobs(db, connection)
        purge_provider_data(db, connection)
        connection.status = IgConnectionStatus.disconnected
        connection.disconnected_at = utcnow()
        connection.username = "deleted"
        connection.name = connection.account_type = None
        connection.app_scoped_user_id = None
        connection.ig_user_id = f"deleted-{connection.id}"  # drop the provider identifier, keep uniqueness
    receipt = InstagramDataDeletionRequest(confirmation_code=secrets.token_hex(12), provider_user_hash=_digest(provider_user_id),
                                           requested_at=utcnow(), completed_at=utcnow(), connections_affected=len(connections))
    db.add(receipt)
    return receipt
