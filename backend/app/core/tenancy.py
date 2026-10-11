"""Workspace isolation enforced at the ORM layer.

After authentication, the request's Session is bound to exactly one workspace
(``bind_workspace``). From then on:

* every ORM SELECT / UPDATE / DELETE touching a ``WorkspaceOwned`` model gets
  ``WHERE workspace_id = :active_workspace`` added automatically (including ``Session.get`` loads,
  joins and bulk updates), so another tenant's rows are invisible — an ID from another workspace
  behaves exactly like an ID that does not exist (404);
* new tenant rows are stamped with the active workspace, and a flush that would write a row into a
  *different* workspace raises ``CrossTenantWriteError`` (fail closed).

Sessions without a bound workspace (migrations, seeding, the auth lookup that resolves the
membership) are unfiltered by design. Services still check ownership explicitly where they accept
foreign keys from request bodies; this layer is the safety net, not the only check.
"""

from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.models.base import WorkspaceOwned

WORKSPACE_KEY = "workspace_id"


class CrossTenantWriteError(RuntimeError):
    pass


def bind_workspace(session: Session, workspace_id: str) -> None:
    session.info[WORKSPACE_KEY] = workspace_id


def active_workspace(session: Session) -> str | None:
    return session.info.get(WORKSPACE_KEY)


@event.listens_for(Session, "do_orm_execute")
def _scope_statements(state: ORMExecuteState) -> None:
    workspace_id = state.session.info.get(WORKSPACE_KEY)
    if workspace_id is None:
        return
    if state.is_select or state.is_update or state.is_delete:
        state.statement = state.statement.options(
            with_loader_criteria(WorkspaceOwned, lambda cls: cls.workspace_id == workspace_id, include_aliases=True)
        )


@event.listens_for(Session, "before_flush")
def _guard_writes(session: Session, _flush_context, _instances) -> None:
    workspace_id = session.info.get(WORKSPACE_KEY)
    if workspace_id is None:
        return
    for obj in session.new:
        if isinstance(obj, WorkspaceOwned):
            if obj.workspace_id is None:
                obj.workspace_id = workspace_id
            elif obj.workspace_id != workspace_id:
                raise CrossTenantWriteError(f"Refusing to create {type(obj).__name__} in another workspace")
    for obj in session.dirty:
        if isinstance(obj, WorkspaceOwned) and obj.workspace_id != workspace_id:
            raise CrossTenantWriteError(f"Refusing to modify {type(obj).__name__} outside the active workspace")
    for obj in session.deleted:
        if isinstance(obj, WorkspaceOwned) and obj.workspace_id != workspace_id:
            raise CrossTenantWriteError(f"Refusing to delete {type(obj).__name__} outside the active workspace")
