"""Instagram integration routes (Instagram API with Instagram Login).

Authenticated (mounted with ``require_auth``; tenant-scoped):
    GET  /integrations/instagram/status
    POST /integrations/instagram/connect                         accounts:manage, CSRF
    GET  /integrations/instagram/accounts
    GET  /integrations/instagram/accounts/{id}
    GET  /integrations/instagram/accounts/{id}/media
    GET  /integrations/instagram/accounts/{id}/insights
    GET  /integrations/instagram/accounts/{id}/comments
    GET  /integrations/instagram/accounts/{id}/sync-runs
    POST /integrations/instagram/accounts/{id}/sync              accounts:manage, CSRF, bounded
    POST /integrations/instagram/accounts/{id}/disconnect        accounts:manage, CSRF

Public (called by Instagram / Meta, not by the web app):
    GET  /integrations/instagram/callback        OAuth redirect; needs the initiating session cookie + single-use state
    POST /integrations/instagram/deauthorize     Meta deauthorize callback (signed_request)
    POST /integrations/instagram/data-deletion   Meta data-deletion callback (signed_request)
    GET  /integrations/instagram/data-deletion/{code}  deletion status page for the user
"""

from __future__ import annotations

from urllib.parse import parse_qs, urlencode

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.api.deps import DB, Ctx, commit, require
from app.core.errors import NotFoundError
from app.models import InstagramDataDeletionRequest
from app.schemas import instagram as s
from app.services.auth import ensure_rate_limit_ok
from app.services.instagram import connections as conn
from app.services.instagram import queries as q
from app.services.instagram.crypto import TokenCipher
from app.services.instagram.provider import InstagramClient
from app.services.instagram.sync import run_sync

router = APIRouter(prefix="/integrations/instagram", tags=["instagram integration"])
public = APIRouter(prefix="/integrations/instagram", tags=["instagram integration"])


def AccountId():  # noqa: N802
    return Path(min_length=4, max_length=64, pattern=r"^igc_[a-f0-9]+$")


def make_client(request: Request) -> InstagramClient:
    """Provider client; tests inject an ``httpx.MockTransport`` via ``app.state.instagram_transport``."""
    settings = request.app.state.settings
    conn.ensure_enabled(settings)
    return InstagramClient(settings, transport=getattr(request.app.state, "instagram_transport", None),
                           sleep=getattr(request.app.state, "instagram_sleep", None) or __import__("time").sleep)


async def signed_request_field(request: Request) -> str | None:
    """``signed_request`` from Meta's application/x-www-form-urlencoded POST (bounded size)."""
    body = await request.body()
    if len(body) > 16_384:
        return None
    values = parse_qs(body.decode("utf-8", "replace")).get("signed_request")
    return values[0] if values else None


SignedRequest = Depends(signed_request_field)


def make_cipher(request: Request) -> TokenCipher:
    return TokenCipher.from_settings(request.app.state.settings)


# ---------------------------------------------------------------------------- authenticated
@router.get("/status", response_model=s.IntegrationStatusOut, summary="Is the integration configured, and can I manage it?")
def integration_status(request: Request, db: DB, ctx: Ctx):
    return q.status(db, request.app.state.settings, ctx)


@router.post("/connect", response_model=s.ConnectOut, summary="Start Instagram Login: returns the official authorization URL")
def connect(request: Request, db: DB, ctx: Ctx, _perm=require("accounts:manage")):
    settings = request.app.state.settings
    conn.ensure_enabled(settings)
    ensure_rate_limit_ok(request.app.state.rate_limiter, settings, request.client.host if request.client else None)
    client = make_client(request)
    try:
        url = conn.begin_connect(db, settings, client, ctx)
    finally:
        client.close()
    return commit(db, s.ConnectOut(authorization_url=url, expires_in_seconds=settings.instagram_oauth_state_ttl_seconds))


@router.get("/accounts", response_model=list[s.InstagramConnectionOut], summary="Connected Instagram accounts of this workspace")
def list_accounts(db: DB):
    return q.list_connections(db)


@router.get("/accounts/{account_id}", response_model=s.InstagramConnectionOut)
def get_account(db: DB, account_id: str = AccountId()):
    return q.connection_detail(db, account_id)


@router.get("/accounts/{account_id}/media", response_model=list[s.InstagramMediaOut], summary="Synced media with the latest insight snapshot")
def get_media(db: DB, account_id: str = AccountId(), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return q.media(db, account_id, limit=limit, offset=offset)


@router.get("/accounts/{account_id}/insights", response_model=s.AccountInsightsOut, summary="Latest account insights (28 days)")
def get_insights(db: DB, account_id: str = AccountId()):
    return q.account_insights(db, account_id)


@router.get("/accounts/{account_id}/comments", response_model=list[s.InstagramCommentOut])
def get_comments(db: DB, account_id: str = AccountId(), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return q.comments(db, account_id, limit=limit, offset=offset)


@router.get("/accounts/{account_id}/sync-runs", response_model=list[s.SyncRunOut])
def get_sync_runs(db: DB, account_id: str = AccountId()):
    return q.sync_runs(db, account_id)


@router.post("/accounts/{account_id}/sync", response_model=s.SyncRunOut, summary="Run a bounded manual sync now")
def sync_now(request: Request, db: DB, ctx: Ctx, account_id: str = AccountId(), _perm=require("accounts:manage")):
    settings = request.app.state.settings
    client = make_client(request)
    try:
        run = run_sync(db, settings, client, make_cipher(request), ctx, account_id)
    finally:
        client.close()
    return q.sync_run_out(run)


@router.post("/accounts/{account_id}/disconnect", response_model=s.InstagramConnectionOut,
             summary="Disconnect: deletes the token and the data fetched for this account")
def disconnect(db: DB, ctx: Ctx, account_id: str = AccountId(), _perm=require("accounts:manage")):
    connection = conn.disconnect(db, ctx, account_id)
    return commit(db, q.connection_out(connection))


# ----------------------------------------------------------------------------------- public
@public.get("/callback", include_in_schema=True, summary="OAuth redirect target registered in the Meta App Dashboard")
def oauth_callback(request: Request, db: DB, state: str | None = Query(None, max_length=200), code: str | None = Query(None, max_length=2048),
                   error: str | None = Query(None, max_length=100)):
    settings = request.app.state.settings
    result = conn.complete_callback(
        db, settings, lambda: make_client(request), lambda: make_cipher(request),
        state=state, code=code, error=error, session_token=request.cookies.get(settings.session_cookie_name),
    )
    params = {"instagram": "connected" if result.outcome == "connected" else "error"}
    if result.outcome != "connected":
        params["reason"] = result.outcome if result.outcome in conn.CALLBACK_REASONS else "authorization_failed"
    if result.connection_id:
        params["account"] = result.connection_id
    # Always the configured frontend — never a URL supplied in the request.
    response = RedirectResponse(f"{settings.frontend_url.rstrip('/')}/accounts?{urlencode(params)}", status_code=303)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@public.post("/deauthorize", summary="Meta deauthorize callback (user removed the app in Instagram)")
def deauthorize(request: Request, db: DB, signed_request: str | None = SignedRequest):
    conn.ensure_enabled(request.app.state.settings)
    affected = conn.handle_deauthorize(db, request.app.state.settings, signed_request)
    return commit(db, {"ok": True, "connections": affected})


@public.post("/data-deletion", response_model=s.DataDeletionOut, summary="Meta data-deletion callback")
def data_deletion(request: Request, db: DB, signed_request: str | None = SignedRequest):
    settings = request.app.state.settings
    conn.ensure_enabled(settings)
    receipt = conn.handle_data_deletion(db, settings, signed_request)
    base = str(settings.instagram_redirect_uri).rsplit("/callback", 1)[0]
    return commit(db, s.DataDeletionOut(url=f"{base}/data-deletion/{receipt.confirmation_code}", confirmation_code=receipt.confirmation_code))


@public.get("/data-deletion/{code}", summary="Status of a data-deletion request")
def data_deletion_status(db: DB, code: str = Path(min_length=8, max_length=64, pattern=r"^[a-f0-9]+$")):
    receipt = db.scalar(select(InstagramDataDeletionRequest).where(InstagramDataDeletionRequest.confirmation_code == code))
    if receipt is None:
        raise NotFoundError("Data deletion request", code)
    return {"confirmationCode": receipt.confirmation_code, "status": "completed" if receipt.completed_at else "pending",
            "completedAt": receipt.completed_at.isoformat() if receipt.completed_at else None,
            "detail": "All Instagram data InstaBoard stored for this account (tokens, media, insights, comments) was deleted."}
