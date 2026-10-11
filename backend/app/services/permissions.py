"""Workspace roles and what each may do. Enforced by route dependencies *and* service-level checks.

Roles (``team_members.access``):
* Owner  — everything, including managing Admins. Exactly one per workspace; cannot be removed.
* Admin  — manage settings, notification preferences, Instagram accounts and Editor/Viewer members.
* Editor — the "Member" role: read everything and change workspace data (campaigns, leads, comments,
           insight review, reports).
* Viewer — read-only member (may still mark notifications read for themselves).

Platform administration (``users.is_platform_admin``) is separate and grants no workspace access.
"""

from __future__ import annotations

from typing import Literal

Role = Literal["Owner", "Admin", "Editor", "Viewer"]
Permission = Literal["read", "notifications:read_state", "write", "settings:manage", "team:manage", "accounts:manage", "admins:manage"]

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    "Viewer": frozenset({"read", "notifications:read_state"}),
    "Editor": frozenset({"read", "notifications:read_state", "write"}),
    "Admin": frozenset({"read", "notifications:read_state", "write", "settings:manage", "team:manage", "accounts:manage"}),
    "Owner": frozenset({"read", "notifications:read_state", "write", "settings:manage", "team:manage", "accounts:manage", "admins:manage"}),
}

ROLE_RANK: dict[Role, int] = {"Viewer": 0, "Editor": 1, "Admin": 2, "Owner": 3}


def permissions_for(role: str) -> list[str]:
    return sorted(ROLE_PERMISSIONS.get(role, frozenset()))  # type: ignore[arg-type]


def has_permission(role: str, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())  # type: ignore[arg-type]


def can_manage_member(actor_role: str, target_role: str) -> bool:
    """Admins manage Editors/Viewers; only the Owner manages Admins; nobody manages the Owner."""
    if target_role == "Owner":
        return False
    if target_role == "Admin" or actor_role == "Owner":
        return actor_role == "Owner"
    return has_permission(actor_role, "team:manage")


def can_grant(actor_role: str, new_role: str) -> bool:
    """Nobody can grant Owner; only the Owner can grant Admin; Admins can grant Editor/Viewer."""
    if new_role == "Owner":
        return False
    if new_role == "Admin":
        return actor_role == "Owner"
    return has_permission(actor_role, "team:manage")
