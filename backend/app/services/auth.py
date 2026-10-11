"""Authentication: login, server-side sessions, CSRF, password changes, invitations.

Secrets never leave this module in logs: raw tokens and passwords are not logged or stored.
"""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, ConflictError, NotFoundError, UnprocessableError
from app.core.security import (
    RateLimiter,
    csrf_matches,
    csrf_token_for,
    hash_password,
    needs_rehash,
    new_token,
    password_problems,
    token_digest,
    verify_password,
)
from app.core.tenancy import bind_workspace
from app.models import AuthSession, Invitation, TeamMember, User, Workspace

from .common import utcnow
from .permissions import has_permission

logger = logging.getLogger("instaboard.auth")

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
INVALID_CREDENTIALS = "Invalid email or password."


class AuthError(ApiError):
    status_code = 401
    code = "not_authenticated"


class SessionExpiredError(AuthError):
    code = "session_expired"


class ForbiddenError(ApiError):
    status_code = 403
    code = "forbidden"


class CsrfError(ForbiddenError):
    code = "csrf_failed"


class RateLimitedError(ApiError):
    status_code = 429
    code = "rate_limited"

    def __init__(self, retry_after: int) -> None:
        super().__init__("Too many attempts. Please wait and try again.", details={"retryAfterSeconds": retry_after})
        self.retry_after = retry_after


@dataclass(frozen=True)
class AuthContext:
    """The validated identity of a request: user + active membership + workspace."""

    user_id: str
    member_id: str
    workspace_id: str
    role: str
    session_id: str
    session_token_digest: str

    def can(self, permission) -> bool:
        return has_permission(self.role, permission)


# ------------------------------------------------------------------------------------- helpers
def _active_membership(db: Session, user_id: str, workspace_id: str | None = None) -> TeamMember | None:
    query = select(TeamMember).where(TeamMember.user_id == user_id, TeamMember.status == "active")
    if workspace_id:
        query = query.where(TeamMember.workspace_id == workspace_id)
    return db.scalar(query.order_by(TeamMember.position, TeamMember.created_at).limit(1))


def find_user_by_email(db: Session, email: str) -> User | None:
    from sqlalchemy import func

    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def _new_session(db: Session, settings: Settings, user: User, workspace_id: str, *, user_agent: str | None, ip: str | None) -> tuple[str, AuthSession]:
    token = new_token()
    now = utcnow()
    absolute = now + timedelta(hours=settings.session_max_age_hours)
    session = AuthSession(
        id=f"ses_{secrets.token_hex(8)}", token_hash=token_digest(token), user_id=user.id, workspace_id=workspace_id,
        created_at=now, last_seen_at=now, idle_expires_at=min(now + timedelta(minutes=settings.session_idle_minutes), absolute),
        absolute_expires_at=absolute, user_agent=(user_agent or "")[:300] or None, ip_address=(ip or "")[:64] or None,
    )
    db.add(session)
    db.flush()
    return token, session


def revoke_sessions(db: Session, *, user_id: str, reason: str, except_session_id: str | None = None, workspace_id: str | None = None) -> int:
    stmt = update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    if except_session_id:
        stmt = stmt.where(AuthSession.id != except_session_id)
    if workspace_id:
        stmt = stmt.where(AuthSession.workspace_id == workspace_id)
    return db.execute(stmt.values(revoked_at=utcnow(), revoked_reason=reason)).rowcount or 0


def check_origin(settings: Settings, method: str, origin: str | None) -> None:
    """Browsers send Origin on cross-origin and state-changing requests; reject unknown origins."""
    if method in UNSAFE_METHODS and origin and origin not in settings.cors_origins:
        raise ForbiddenError("Request origin is not allowed.", details={"origin": origin})


# --------------------------------------------------------------------------- request validation
def authenticate(db: Session, settings: Settings, *, token: str | None, method: str, origin: str | None, csrf_header: str | None) -> AuthContext:
    """Validates the session cookie, renews its idle timeout, enforces CSRF on unsafe methods and binds
    the request's database session to the session's workspace."""
    check_origin(settings, method, origin)
    if not token:
        raise AuthError("Sign in to continue.")
    digest = token_digest(token)
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == digest))
    now = utcnow()
    if session is None:
        raise SessionExpiredError("Your session is no longer valid. Please sign in again.")
    if session.revoked_at is not None:
        raise SessionExpiredError("You were signed out. Please sign in again.", details={"reason": session.revoked_reason})
    if now >= session.idle_expires_at or now >= session.absolute_expires_at:
        session.revoked_at, session.revoked_reason = now, "expired"
        db.commit()
        raise SessionExpiredError("Your session expired. Please sign in again.")

    user = db.get(User, session.user_id)
    membership = _active_membership(db, session.user_id, session.workspace_id) if user and user.is_active else None
    if user is None or not user.is_active or membership is None:
        session.revoked_at, session.revoked_reason = now, "access_removed"
        db.commit()
        raise SessionExpiredError("Your access to this workspace has changed. Please sign in again.")

    if method in UNSAFE_METHODS and not csrf_matches(settings.signing_key, digest, csrf_header):
        raise CsrfError("Missing or invalid CSRF token. Reload the page and try again.")

    # Sliding renewal (at most once a minute to avoid a write per request), capped by the absolute expiry.
    if (now - session.last_seen_at) > timedelta(seconds=60):
        session.last_seen_at = now
        session.idle_expires_at = min(now + timedelta(minutes=settings.session_idle_minutes), session.absolute_expires_at)
        db.commit()

    bind_workspace(db, session.workspace_id)
    return AuthContext(user_id=user.id, member_id=membership.id, workspace_id=session.workspace_id, role=membership.access.value,
                       session_id=session.id, session_token_digest=digest)


# --------------------------------------------------------------------------------------- login
def login(db: Session, settings: Settings, limiter: RateLimiter, *, email: str, password: str, ip: str | None, user_agent: str | None) -> tuple[str, AuthSession, User, TeamMember]:
    email_key = email.strip().lower()
    allowed, retry = limiter.hit(f"auth-ip:{ip}", limit=settings.auth_requests_per_minute_per_ip, window_seconds=60)
    if not allowed:
        raise RateLimitedError(retry)
    failure_key = f"login-fail:{email_key}:{ip}"
    if limiter.count(failure_key, window_seconds=settings.login_window_seconds) >= settings.login_attempts_per_window:
        raise RateLimitedError(settings.login_window_seconds)

    user = find_user_by_email(db, email_key)
    if not verify_password(user.password_hash if user else None, password) or user is None or not user.is_active:
        limiter.hit(failure_key, limit=10**9, window_seconds=settings.login_window_seconds)
        logger.info("Failed sign-in attempt (ip=%s)", ip)  # never log the email/password
        raise AuthError(INVALID_CREDENTIALS, details=None)

    membership = _active_membership(db, user.id)
    if membership is None:
        raise ForbiddenError("This account is not an active member of any workspace. Ask a workspace admin for an invitation.")
    limiter.reset(failure_key)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = utcnow()
    membership.last_active_label = "Active now"
    token, session = _new_session(db, settings, user, membership.workspace_id, user_agent=user_agent, ip=ip)
    return token, session, user, membership


def logout(db: Session, ctx: AuthContext) -> None:
    db.execute(update(AuthSession).where(AuthSession.id == ctx.session_id).values(revoked_at=utcnow(), revoked_reason="logout"))


def csrf_for(settings: Settings, ctx: AuthContext) -> str:
    return csrf_token_for(settings.signing_key, ctx.session_token_digest)


def change_password(db: Session, settings: Settings, ctx: AuthContext, *, current_password: str, new_password: str) -> int:
    user = db.get(User, ctx.user_id)
    if user is None or not verify_password(user.password_hash, current_password):
        raise UnprocessableError("Current password is incorrect.", details={"field": "currentPassword"})
    if current_password == new_password:
        raise UnprocessableError("Choose a password you have not just used.", details={"field": "newPassword"})
    problems = password_problems(new_password, min_length=settings.min_password_length, email=user.email, name=user.name)
    if problems:
        raise UnprocessableError(problems[0], details={"field": "newPassword", "problems": problems})
    user.password_hash = hash_password(new_password)
    user.password_changed_at = utcnow()
    # Every other session of this user is signed out.
    return revoke_sessions(db, user_id=user.id, reason="password_changed", except_session_id=ctx.session_id)


def list_sessions(db: Session, ctx: AuthContext) -> list[AuthSession]:
    now = utcnow()
    return list(db.scalars(
        select(AuthSession).where(AuthSession.user_id == ctx.user_id, AuthSession.revoked_at.is_(None), AuthSession.idle_expires_at > now)
        .order_by(AuthSession.last_seen_at.desc())
    ))


def revoke_session(db: Session, ctx: AuthContext, session_id: str) -> None:
    session = db.get(AuthSession, session_id)
    if session is None or session.user_id != ctx.user_id:  # other users' sessions are indistinguishable from missing
        raise NotFoundError("Session", session_id)
    if session.revoked_at is None:
        session.revoked_at, session.revoked_reason = utcnow(), "revoked_by_user"


# --------------------------------------------------------------------------------- invitations
def create_invitation(db: Session, settings: Settings, *, member: TeamMember, invited_by_member_id: str) -> str:
    """Returns the raw token (shown once to the inviter as a link; only its hash is stored)."""
    token = new_token()
    existing = db.scalar(select(Invitation).where(Invitation.member_id == member.id))
    if existing is not None:
        db.delete(existing)
        db.flush()
    db.add(Invitation(
        id=f"inv_{secrets.token_hex(8)}", token_hash=token_digest(token), workspace_id=member.workspace_id, member_id=member.id,
        email=member.email, access=member.access, invited_by_member_id=invited_by_member_id,
        expires_at=utcnow() + timedelta(hours=settings.invitation_ttl_hours),
    ))
    db.flush()
    return token


def _valid_invitation(db: Session, token: str) -> Invitation:
    invitation = db.scalar(select(Invitation).where(Invitation.token_hash == token_digest(token)))
    if invitation is None or invitation.revoked_at or invitation.accepted_at or utcnow() >= invitation.expires_at:
        raise NotFoundError("Invitation", "token")  # same response for unknown / used / expired tokens
    return invitation


def preview_invitation(db: Session, token: str) -> dict:
    invitation = _valid_invitation(db, token)
    workspace = db.get(Workspace, invitation.workspace_id)
    return {
        "email": invitation.email, "role": invitation.access.value, "workspaceName": workspace.name if workspace else "",
        "expiresAt": invitation.expires_at.isoformat(timespec="seconds"),
        "accountExists": find_user_by_email(db, invitation.email) is not None,
    }


def accept_invitation(db: Session, settings: Settings, limiter: RateLimiter, *, token: str, name: str | None, password: str,
                      ip: str | None, user_agent: str | None) -> tuple[str, AuthSession, User, TeamMember]:
    allowed, retry = limiter.hit(f"auth-ip:{ip}", limit=settings.auth_requests_per_minute_per_ip, window_seconds=60)
    if not allowed:
        raise RateLimitedError(retry)
    invitation = _valid_invitation(db, token)
    member = db.get(TeamMember, invitation.member_id)
    if member is None or member.workspace_id != invitation.workspace_id:
        raise NotFoundError("Invitation", "token")
    user = find_user_by_email(db, invitation.email)
    if user is not None:
        # Existing account joining another workspace: prove ownership of the account.
        if not verify_password(user.password_hash, password):
            raise AuthError(INVALID_CREDENTIALS)
    else:
        display_name = (name or "").strip() or member.name
        problems = password_problems(password, min_length=settings.min_password_length, email=invitation.email, name=display_name)
        if problems:
            raise UnprocessableError(problems[0], details={"field": "password", "problems": problems})
        user = User(id=f"usr_{secrets.token_hex(8)}", email=invitation.email.lower(), name=display_name,
                    password_hash=hash_password(password), password_changed_at=utcnow())
        db.add(user)
        db.flush()
    if db.scalar(select(TeamMember).where(TeamMember.workspace_id == member.workspace_id, TeamMember.user_id == user.id, TeamMember.id != member.id)):
        raise ConflictError("This account is already a member of the workspace.")
    member.user_id, member.status, member.name = user.id, "active", user.name
    member.last_active_label = "Active now"
    invitation.accepted_at = utcnow()
    user.last_login_at = utcnow()
    session_token, session = _new_session(db, settings, user, member.workspace_id, user_agent=user_agent, ip=ip)
    return session_token, session, user, member


def provision_owner(db: Session, *, workspace_id: str, email: str, name: str, password: str, min_length: int, member_id: str | None = None) -> tuple[User, TeamMember]:
    """CLI onboarding (scripts/create_owner.py): create or link the workspace Owner account."""
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace", workspace_id)
    problems = password_problems(password, min_length=min_length, email=email, name=name)
    if problems:
        raise UnprocessableError(problems[0], details={"problems": problems})
    email = email.strip().lower()
    user = find_user_by_email(db, email)
    if user is None:
        user = User(id=f"usr_{secrets.token_hex(8)}", email=email, name=name, password_hash=hash_password(password), password_changed_at=utcnow())
        db.add(user)
        db.flush()
    else:
        user.password_hash, user.password_changed_at = hash_password(password), utcnow()
    member = db.get(TeamMember, member_id) if member_id else None
    if member is None:
        member = db.scalar(select(TeamMember).where(TeamMember.workspace_id == workspace_id, TeamMember.access == "Owner"))
    if member is None:
        member = TeamMember(id=f"mem_{secrets.token_hex(6)}", workspace_id=workspace_id, name=name, email=email, role="Workspace owner",
                            access="Owner", status="active", last_active_label="Never signed in", position=0)
        db.add(member)
    if member.workspace_id != workspace_id:
        raise UnprocessableError("That member belongs to a different workspace.")
    member.user_id, member.email, member.status, member.access = user.id, email, "active", "Owner"
    db.flush()
    return user, member


def ensure_rate_limit_ok(limiter: RateLimiter, settings: Settings, ip: str | None) -> None:
    allowed, retry = limiter.hit(f"auth-ip:{ip}", limit=settings.auth_requests_per_minute_per_ip, window_seconds=60)
    if not allowed:
        raise RateLimitedError(retry)


def session_summary(session: AuthSession) -> dict:
    return {"id": session.id, "createdAt": session.created_at.isoformat(timespec="seconds"),
            "lastSeenAt": session.last_seen_at.isoformat(timespec="seconds"),
            "idleExpiresAt": session.idle_expires_at.isoformat(timespec="seconds"),
            "absoluteExpiresAt": session.absolute_expires_at.isoformat(timespec="seconds"),
            "userAgent": session.user_agent, "ipAddress": session.ip_address}


def describe_device(user_agent: str | None) -> str:
    ua = (user_agent or "").lower()
    browser = next((b for k, b in (("edg/", "Edge"), ("chrome/", "Chrome"), ("firefox/", "Firefox"), ("safari/", "Safari")) if k in ua), "Browser")
    system = next((s for k, s in (("windows", "Windows"), ("mac os", "macOS"), ("android", "Android"), ("iphone", "iOS"), ("linux", "Linux")) if k in ua), "Unknown OS")
    return f"{browser} on {system}" if user_agent else "Unknown device"
