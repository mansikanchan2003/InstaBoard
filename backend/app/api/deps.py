"""FastAPI dependencies: database session, authentication context and permission checks.

Every workspace API router is mounted with ``require_auth`` (see ``app/api/router.py``), so a route
cannot accidentally be served without a validated session. ``require_auth`` also binds the request's
database session to the session's workspace, which activates the ORM tenant filter.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated, TypeVar

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import session_scope
from app.services.auth import AuthContext, ForbiddenError, authenticate
from app.services.common import AUTH_KEY
from app.services.permissions import Permission

T = TypeVar("T")


def get_db(request: Request) -> Iterator[Session]:
    yield from session_scope(request.app.state.session_factory)


DB = Annotated[Session, Depends(get_db)]


def require_auth(request: Request, db: DB) -> AuthContext:
    settings = request.app.state.settings
    ctx = authenticate(
        db, settings,
        token=request.cookies.get(settings.session_cookie_name),
        method=request.method,
        origin=request.headers.get("origin"),
        csrf_header=request.headers.get("x-csrf-token"),
    )
    db.info[AUTH_KEY] = ctx
    request.state.auth = ctx
    return ctx


Ctx = Annotated[AuthContext, Depends(require_auth)]


def require(permission: Permission):
    """Route dependency: the caller's workspace role must include ``permission`` (else 403)."""

    def _check(ctx: Ctx) -> AuthContext:
        if not ctx.can(permission):
            raise ForbiddenError(f"Your role ({ctx.role}) does not allow this action.", details={"required": permission})
        return ctx

    return Depends(_check)


def commit(db: Session, value: T) -> T:
    """Commit the request's transaction *before* the response is returned, so a 2xx always means
    the change is durable. On any exception the dependency rolls the transaction back."""
    db.commit()
    return value
