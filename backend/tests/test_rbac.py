"""Role-based access control: Owner / Admin / Editor / Viewer, privilege escalation, platform admin,
and a guard that every workspace route rejects anonymous callers."""

from __future__ import annotations

import re

import pytest
from fastapi.routing import APIRoute

from app.main import create_app

from .conftest import UNREACHABLE_DB, api, make_settings

PUBLIC_ROUTES = {
    ("POST", "/api/v1/auth/login"), ("POST", "/api/v1/auth/invitations/preview"), ("POST", "/api/v1/auth/invitations/accept"),
    # Called by Instagram/Meta, not the web app. The callback requires the initiating session + single-use state and the
    # Meta callbacks require a valid signed_request — both covered in tests/test_instagram.py.
    ("GET", "/api/v1/integrations/instagram/callback"), ("POST", "/api/v1/integrations/instagram/deauthorize"),
    ("POST", "/api/v1/integrations/instagram/data-deletion"), ("GET", "/api/v1/integrations/instagram/data-deletion/{code}"),
}


def test_every_api_route_requires_authentication(anon_client):
    """Fails if a new route is added without being mounted behind authentication."""
    app = create_app(make_settings(UNREACHABLE_DB))
    checked = 0
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/v1"):
            continue
        for method in route.methods - {"HEAD", "OPTIONS"}:
            if (method, route.path) in PUBLIC_ROUTES:
                continue
            path = re.sub(r"\{[^}]+\}", "probe-id", route.path)
            response = anon_client.request(method, path, json={})
            assert response.status_code == 401, (method, route.path, response.status_code)
            checked += 1
    assert checked >= 75


# ---------------------------------------------------------------------------------------- viewer
def test_viewer_can_read_but_not_change_data(viewer_client):
    assert viewer_client.get(api("/campaigns")).status_code == 200
    assert viewer_client.get(api("/activity/summary")).status_code == 200
    denied = viewer_client.patch(api("/campaigns/sbi-csp-october"), json={"status": "paused"})
    assert denied.status_code == 403 and denied.json()["error"]["details"] == {"required": "write"}
    assert viewer_client.patch(api("/leads/lead-sunita-devi"), json={"notes": "x"}).status_code == 403
    assert viewer_client.post(api("/comments/bulk"), json={"ids": ["x"], "status": "reviewed"}).status_code == 403
    assert viewer_client.delete(api("/notifications/ntf-token-ekomitracare")).status_code == 403
    # Personal notification read state is allowed for every member.
    assert viewer_client.patch(api("/notifications/ntf-token-ekomitracare"), json={"read": True}).status_code == 200


def test_viewer_permissions_are_reported_by_auth_me(viewer_client):
    me = viewer_client.get(api("/auth/me")).json()
    assert me["role"] == "Viewer" and me["permissions"] == ["notifications:read_state", "read"]


# ---------------------------------------------------------------------------------------- editor
def test_editor_changes_data_but_not_settings_or_team(client_as):
    editor = client_as("usr-ananya")
    assert editor.patch(api("/campaigns/sbi-csp-october"), json={"status": "paused"}).status_code == 200
    settings = editor.get(api("/settings")).json()
    assert editor.put(api("/settings"), json=settings).status_code == 403
    assert editor.put(api("/notifications/preferences"), json=editor.get(api("/notifications/preferences")).json()).status_code == 403
    assert editor.post(api("/workspace/members"), json={"email": "x@eko.example", "access": "Viewer"}).status_code == 403
    assert editor.post(api("/accounts/acc-ekoindia/sync")).status_code == 403


# ----------------------------------------------------------------------------------------- admin
def test_admin_manages_settings_and_lower_roles_only(client_as, client):
    admin = client_as("usr-rahul")
    assert admin.put(api("/settings"), json=admin.get(api("/settings")).json()).status_code == 200
    assert admin.post(api("/workspace/members"), json={"email": "ed@eko.example", "access": "Editor"}).status_code == 201
    # Privilege escalation attempts:
    assert admin.post(api("/workspace/members"), json={"email": "adm@eko.example", "access": "Admin"}).status_code == 403
    assert admin.post(api("/workspace/members"), json={"email": "own@eko.example", "access": "Owner"}).status_code == 422
    assert admin.patch(api("/workspace/members/usr-ananya"), json={"access": "Admin"}).status_code == 403
    assert admin.patch(api("/workspace/members/usr-rahul"), json={"access": "Viewer"}).status_code == 403  # own role
    assert admin.patch(api("/workspace/members/usr-priya"), json={"access": "Viewer"}).status_code == 409  # the Owner
    assert admin.delete(api("/workspace/members/usr-priya")).status_code == 409
    assert admin.patch(api("/workspace/members/usr-ananya"), json={"access": "Viewer"}).status_code == 200
    # Admins cannot touch other Admins — only the Owner can.
    invited = client.post(api("/workspace/members"), json={"email": "second.admin@eko.example", "access": "Admin"})
    assert invited.status_code == 201
    second_admin = invited.json()["id"]
    assert admin.delete(api(f"/workspace/members/{second_admin}")).status_code == 403
    assert client.delete(api(f"/workspace/members/{second_admin}")).status_code == 200


def test_mass_assignment_of_roles_is_impossible(client_as):
    editor = client_as("usr-ananya")
    assert editor.patch(api("/leads/lead-sunita-devi"), json={"status": "lost", "access": "Owner"}).status_code == 422
    assert editor.post(api("/auth/login"), json={"email": "x@y.z", "password": "p", "isPlatformAdmin": True}).status_code == 422


# ---------------------------------------------------------------------------------- platform admin
def test_platform_admin_is_separate_from_workspace_roles(client, db_session):
    assert client.get(api("/platform/workspaces")).status_code == 403  # an Owner is not a platform admin
    from app.models import User

    user = db_session.get(User, "usr_test_usr-priya")
    user.is_platform_admin = True
    db_session.commit()
    listing = client.get(api("/platform/workspaces")).json()
    assert {"id", "name", "plan", "members"} == set(listing[0]) and any(w["id"] == "ws-eko-india" for w in listing)


@pytest.mark.parametrize("role_member", ["usr-ananya", "usr-rahul"])
def test_non_owners_cannot_grant_admin(client_as, role_member):
    c = client_as(role_member)
    assert c.patch(api("/workspace/members/usr-arjun"), json={"access": "Admin"}).status_code == 403
