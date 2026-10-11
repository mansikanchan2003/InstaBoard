"""Auth request/response schemas. Password fields are write-only and never echoed back."""

from __future__ import annotations

from pydantic import ConfigDict, Field, SecretStr

from .base import ApiModel, optional
from .core import TeamMemberOut, WorkspaceOut
from .engagement import Email


class StrictIn(ApiModel):
    model_config = ConfigDict(extra="forbid")


class LoginIn(StrictIn):
    email: Email
    password: SecretStr = Field(min_length=1, max_length=256)


class PasswordChangeIn(StrictIn):
    current_password: SecretStr = Field(min_length=1, max_length=256)
    new_password: SecretStr = Field(min_length=1, max_length=256)


class InvitationTokenIn(StrictIn):
    token: str = Field(min_length=20, max_length=200)


class AcceptInvitationIn(StrictIn):
    token: str = Field(min_length=20, max_length=200)
    name: str | None = Field(default=None, max_length=160)
    password: SecretStr = Field(min_length=1, max_length=256)


class UserOut(ApiModel):
    id: str
    name: str
    email: str
    is_platform_admin: bool


class SessionInfoOut(ApiModel):
    __omit_if_none__ = optional("user_agent", "ip_address")
    id: str
    created_at: str
    last_seen_at: str
    idle_expires_at: str
    absolute_expires_at: str
    user_agent: str | None = None
    ip_address: str | None = None
    current: bool = False


class AuthMeOut(ApiModel):
    """``GET /auth/me`` / login result: who is signed in, where, and with which permissions."""

    user: UserOut
    member: TeamMemberOut
    workspace: WorkspaceOut
    role: str
    permissions: list[str]
    # Echo this in the X-CSRF-Token header on POST/PUT/PATCH/DELETE. Bound to the session.
    csrf_token: str
    session: SessionInfoOut


class InvitationPreviewOut(ApiModel):
    email: str
    role: str
    workspace_name: str
    expires_at: str
    account_exists: bool


class PasswordChangedOut(ApiModel):
    revoked_sessions: int


class RevokedOut(ApiModel):
    revoked: int


class PlatformWorkspaceOut(ApiModel):
    id: str
    name: str
    plan: str
    members: int
