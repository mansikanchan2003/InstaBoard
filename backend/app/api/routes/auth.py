"""Authentication routes.

Public (no session): POST /auth/login, POST /auth/invitations/preview, POST /auth/invitations/accept.
Invitation tokens travel only in request bodies (never in URLs), so they do not end up in access logs.
Everything else requires a valid session; state-changing calls also require the CSRF header.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Request, Response, status
from sqlalchemy import text

from app.api.deps import DB, Ctx, commit, require_auth
from app.models import AuthSession, TeamMember, User
from app.schemas import auth as s
from app.services import auth as svc
from app.services.audit import record_activity
from app.services.common import AUTH_KEY
from app.services.core import member_out, workspace_out
from app.services.permissions import permissions_for

router = APIRouter(prefix="/auth", tags=["auth"])
platform = APIRouter(prefix="/platform", tags=["platform administration"])


def _client_ip(request: Request) -> str | None:
    # Behind a trusted reverse proxy configure uvicorn --proxy-headers so this is the real client IP.
    return request.client.host if request.client else None


def _set_session_cookie(request: Request, response: Response, token: str) -> None:
    settings = request.app.state.settings
    response.set_cookie(
        key=settings.session_cookie_name, value=token, max_age=settings.session_max_age_hours * 3600, path="/",
        domain=settings.cookie_domain, secure=settings.cookie_secure, httponly=True, samesite=settings.cookie_samesite,
    )


def _clear_session_cookie(request: Request, response: Response) -> None:
    settings = request.app.state.settings
    response.delete_cookie(settings.session_cookie_name, path="/", domain=settings.cookie_domain,
                           secure=settings.cookie_secure, httponly=True, samesite=settings.cookie_samesite)


def _security_event(db, *, workspace_id: str, actor_id: str, title: str, summary: str, payload: dict) -> None:
    """Audit entry for authentication events (never includes passwords or tokens)."""
    record_activity(
        db, workspace_id=workspace_id, category="security", kind="Authentication", kind_icon="lock", kind_tone="neutral",
        kind_icon_class="text-text-secondary", title=title, summary=summary, narrative=summary,
        target={"label": "Sys/Auth", "to": "/settings?tab=security", "module": "Security"}, actor_id=actor_id, payload=payload,
    )


def _me(db, request: Request, ctx: svc.AuthContext) -> s.AuthMeOut:
    db.info[AUTH_KEY] = ctx
    user = db.get(User, ctx.user_id)
    session = db.get(AuthSession, ctx.session_id)
    return s.AuthMeOut(
        user=s.UserOut(id=user.id, name=user.name, email=user.email, is_platform_admin=user.is_platform_admin),
        member=member_out(db.get(TeamMember, ctx.member_id)), workspace=workspace_out(db), role=ctx.role,
        permissions=permissions_for(ctx.role), csrf_token=svc.csrf_for(request.app.state.settings, ctx),
        session=s.SessionInfoOut(current=True, **{k: v for k, v in _summary(session).items()}),
    )


def _summary(session: AuthSession) -> dict:
    data = svc.session_summary(session)
    return {"id": data["id"], "created_at": data["createdAt"], "last_seen_at": data["lastSeenAt"], "idle_expires_at": data["idleExpiresAt"],
            "absolute_expires_at": data["absoluteExpiresAt"], "user_agent": data["userAgent"], "ip_address": data["ipAddress"]}


def _ctx_for(session: AuthSession, member: TeamMember) -> svc.AuthContext:
    return svc.AuthContext(user_id=session.user_id, member_id=member.id, workspace_id=session.workspace_id, role=member.access.value,
                           session_id=session.id, session_token_digest=session.token_hash)


# ------------------------------------------------------------------------------------- public
@router.post("/login", response_model=s.AuthMeOut, summary="Sign in with email + password (sets an HttpOnly session cookie)",
             responses={401: {"description": "Invalid credentials"}, 429: {"description": "Rate limited"}})
def login(body: s.LoginIn, request: Request, response: Response, db: DB):
    settings = request.app.state.settings
    svc.check_origin(settings, "POST", request.headers.get("origin"))
    token, session, user, member = svc.login(
        db, settings, request.app.state.rate_limiter, email=body.email, password=body.password.get_secret_value(),
        ip=_client_ip(request), user_agent=request.headers.get("user-agent"),
    )
    ctx = _ctx_for(session, member)
    _security_event(db, workspace_id=member.workspace_id, actor_id=member.id, title="Signed In",
                    summary=f"{user.name} signed in.", payload={"type": "AUTH_LOGIN", "session_id": session.id})
    result = _me(db, request, ctx)
    commit(db, None)
    _set_session_cookie(request, response, token)
    return result


@router.post("/invitations/preview", response_model=s.InvitationPreviewOut, summary="Preview an invitation (public; 404 if invalid/expired)")
def preview_invitation(body: s.InvitationTokenIn, request: Request, db: DB):
    svc.ensure_rate_limit_ok(request.app.state.rate_limiter, request.app.state.settings, _client_ip(request))
    return svc.preview_invitation(db, body.token)


@router.post("/invitations/accept", response_model=s.AuthMeOut, summary="Accept an invitation: set a password (or confirm it) and sign in")
def accept_invitation(body: s.AcceptInvitationIn, request: Request, response: Response, db: DB):
    settings = request.app.state.settings
    svc.check_origin(settings, "POST", request.headers.get("origin"))
    token, session, user, member = svc.accept_invitation(
        db, settings, request.app.state.rate_limiter, token=body.token, name=body.name, password=body.password.get_secret_value(),
        ip=_client_ip(request), user_agent=request.headers.get("user-agent"),
    )
    _security_event(db, workspace_id=member.workspace_id, actor_id=member.id, title="Invitation Accepted",
                    summary=f"{user.name} accepted their invitation and joined as {member.access.value}.",
                    payload={"type": "AUTH_INVITATION_ACCEPTED", "member_id": member.id})
    result = _me(db, request, _ctx_for(session, member))
    commit(db, None)
    _set_session_cookie(request, response, token)
    return result


# ---------------------------------------------------------------------------------- signed in
@router.get("/me", response_model=s.AuthMeOut, summary="Current user, workspace, role, permissions and CSRF token")
def me(request: Request, db: DB, ctx: Ctx):
    return _me(db, request, ctx)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out (revokes this session)")
def logout(request: Request, db: DB, ctx: Ctx):
    svc.logout(db, ctx)
    user = db.get(User, ctx.user_id)
    _security_event(db, workspace_id=ctx.workspace_id, actor_id=ctx.member_id, title="Signed Out", summary=f"{user.name} signed out.",
                    payload={"type": "AUTH_LOGOUT", "session_id": ctx.session_id})
    commit(db, None)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_session_cookie(request, response)
    return response


@router.post("/password", response_model=s.PasswordChangedOut, summary="Change password (signs out your other sessions)")
def change_password(body: s.PasswordChangeIn, request: Request, db: DB, ctx: Ctx):
    revoked = svc.change_password(db, request.app.state.settings, ctx, current_password=body.current_password.get_secret_value(),
                                  new_password=body.new_password.get_secret_value())
    _security_event(db, workspace_id=ctx.workspace_id, actor_id=ctx.member_id, title="Password Changed",
                    summary=f"Password changed; {revoked} other session{'' if revoked == 1 else 's'} signed out.",
                    payload={"type": "AUTH_PASSWORD_CHANGED", "revoked_sessions": revoked})
    return commit(db, s.PasswordChangedOut(revoked_sessions=revoked))


@router.get("/sessions", response_model=list[s.SessionInfoOut], summary="Your active sessions")
def list_sessions(db: DB, ctx: Ctx):
    return [s.SessionInfoOut(current=x.id == ctx.session_id, **_summary(x)) for x in svc.list_sessions(db, ctx)]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke one of your sessions")
def revoke_session(db: DB, ctx: Ctx, session_id: str = Path(min_length=4, max_length=40)):
    svc.revoke_session(db, ctx, session_id)
    _security_event(db, workspace_id=ctx.workspace_id, actor_id=ctx.member_id, title="Session Revoked",
                    summary="A session was signed out from Settings → Security.", payload={"type": "AUTH_SESSION_REVOKED", "session_id": session_id})
    commit(db, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/revoke-others", response_model=s.RevokedOut, summary="Sign out all of your other sessions")
def revoke_others(db: DB, ctx: Ctx):
    revoked = svc.revoke_sessions(db, user_id=ctx.user_id, reason="revoked_by_user", except_session_id=ctx.session_id)
    _security_event(db, workspace_id=ctx.workspace_id, actor_id=ctx.member_id, title="Other Sessions Revoked",
                    summary=f"Signed out {revoked} other session{'' if revoked == 1 else 's'}.", payload={"type": "AUTH_SESSIONS_REVOKED", "count": revoked})
    return commit(db, s.RevokedOut(revoked=revoked))


# ------------------------------------------------------------------------------ platform admin
@platform.get("/workspaces", response_model=list[s.PlatformWorkspaceOut], dependencies=[Depends(require_auth)],
              summary="Platform administrators only: workspace directory (no tenant data)")
def platform_workspaces(db: DB, ctx: Ctx):
    user = db.get(User, ctx.user_id)
    if not user or not user.is_platform_admin:
        raise svc.ForbiddenError("Platform administrator access required.")
    # Raw SQL on purpose: this is a cross-workspace directory, outside the tenant filter, and it
    # exposes only workspace names and member counts — never workspace data.
    rows = db.execute(text(
        "SELECT w.id, w.name, w.plan, count(m.id) AS members FROM workspaces w "
        "LEFT JOIN team_members m ON m.workspace_id = w.id AND m.status = 'active' GROUP BY w.id ORDER BY w.name"
    )).all()
    return [s.PlatformWorkspaceOut(id=r.id, name=r.name, plan=r.plan, members=r.members) for r in rows]
