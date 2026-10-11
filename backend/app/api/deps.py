"""FastAPI dependencies.

Authentication is intentionally not implemented in this phase: every endpoint acts as the seeded
demo "session user". When auth is added, introduce a ``current_principal`` dependency here and
add it to the routers (plus role checks for write routes) — services already resolve the workspace
through one function (``services.common.current_workspace``).
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated, TypeVar

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import session_scope

T = TypeVar("T")


def get_db(request: Request) -> Iterator[Session]:
    yield from session_scope(request.app.state.session_factory)


DB = Annotated[Session, Depends(get_db)]


def commit(db: Session, value: T) -> T:
    """Commit the request's transaction *before* the response is returned, so a 2xx always means
    the change is durable. On any exception the dependency rolls the transaction back."""
    db.commit()
    return value
