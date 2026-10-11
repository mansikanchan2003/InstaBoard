"""Workspace isolation: a second tenant's records must be invisible and untouchable — for lists, details,
nested resources, aggregates, writes, bulk operations and foreign keys smuggled in request bodies."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    ActivityEvent, Campaign, Comment, ContentItem, Insight, InstagramAccount, Lead, Notification, RecommendedAction, Report,
    ReportCampaign, SyncLog, TeamMember, User, Workspace, WorkspaceSettings,
)
from app.services.auth import hash_password

from .conftest import TEST_PASSWORD, api

OTHER = "ws-other"


@pytest.fixture
def other_workspace(connection):
    """A second tenant ("Other Co") with one record of every kind, created inside the test transaction."""
    now = datetime(2024, 10, 15, 10, 0, tzinfo=timezone.utc)
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        s.add(Workspace(id=OTHER, name="Other Co", plan="Starter", timezone="UTC", currency="USD", reporting_start=date(2024, 10, 1),
                        reporting_end=date(2024, 10, 31), reporting_label="Oct 2024", baseline_start=date(2024, 9, 1),
                        baseline_end=date(2024, 9, 30), baseline_label="Sep 2024", last_synced_label="never"))
        s.flush()
        s.add(User(id="usr_bob", email="bob@other.example", name="Bob Other", password_hash=hash_password(TEST_PASSWORD)))
        s.flush()
        s.add(TeamMember(id="mem-bob", workspace_id=OTHER, user_id="usr_bob", name="Bob Other", email="bob@other.example", role="Owner",
                         access="Owner", status="active", last_active_label="now"))
        s.add(WorkspaceSettings(workspace_id=OTHER, general={}, sync={}, ai={}, notifications={}, notification_preferences={},
                                updated_at_label="x", updated_by="Bob"))
        s.add(InstagramAccount(id="acc-other", workspace_id=OTHER, display_name="Other IG", handle="other_ig", initials="O", type="business",
                               status="connected", is_primary=True, verified=False, external_id="ig_other_1", connected_since=date(2024, 1, 1),
                               last_synced_label="x", followers=10, following=1, media_count=1, data_availability={}, scopes=[]))
        s.flush()
        s.add(Campaign(id="cmp-other", workspace_id=OTHER, code="#CAM-8802", name="Other secret campaign", objective="Awareness", focus="x",
                       status="active", account_id="acc-other", owner="Bob", target_regions=[], hashtags=[]))
        s.add(ContentItem(id="cnt-other", workspace_id=OTHER, account_id="acc-other", campaign_id="cmp-other", title="Other reel", caption="x",
                          type="reel", published_at=date(2024, 10, 2), thumbnail_alt="x", views=1, reach=1, likes=0, comments=0, shares=0,
                          saves=0, engagement_rate=1.0, leads=1))
        s.flush()
        s.add(Lead(id="lead-other", workspace_id=OTHER, campaign_id="cmp-other", content_id="cnt-other", name="Other Lead",
                   handle="ramesh_m_up", location="X", score=50, status="new", source="comment", last_contact_label="x", first_message="x"))
        s.add(Comment(id="cmt-other", workspace_id=OTHER, ref="#IG-CM-91823", account_id="acc-other", content_id="cnt-other",
                      campaign_id="cmp-other", author_name="Other Commenter", handle="other_commenter", text="secret", highlights=[],
                      received_at=now, received_label="x", surface="Post", language="en", sentiment="neutral", intent="other",
                      lead_potential="low", intent_score=10, status="needs_response", flagged=False, suggested_reply="x", ai={}))
        s.add(Insight(id="ins-other", workspace_id=OTHER, category="content", priority="high", confidence=90, title="Other insight",
                      observed="x", interpretation="x", impact={}, primary_link={}, generated_label="x", status="new", completed_step_ids=[]))
        s.flush()
        s.add(RecommendedAction(id="act-other", workspace_id=OTHER, insight_id="ins-other", priority="high", title="x", rationale="x",
                                metric="x", metric_note="x", impact="x", target={}, status="pending_review"))
        s.add(Report(id="rep-other", workspace_id=OTHER, code="#REP-2024-884", title="Other report", type="audience", scope="account",
                     account_id="acc-other", period_start=date(2024, 10, 1), period_end=date(2024, 10, 31), metrics=["views"],
                     sections=["summary"], compare_baseline=False, formats=["csv"], schedule="none", recipients=[], status="ready",
                     icon="x", generated_at=now, generated_label="x", created_by="Bob"))
        s.flush()
        s.add(ReportCampaign(report_id="rep-other", campaign_id="cmp-other", position=0))
        s.add(Notification(id="ntf-other", workspace_id=OTHER, category="leads", priority="high", title="Other alert", body="x",
                           time_label="x", timestamp_label="x", group="today", read=False, icon="x", tone="amber", badge={}, tags=[],
                           primary_action={}, meta=[]))
        s.add(ActivityEvent(id="EVT_OTHER", workspace_id=OTHER, occurred_at=now, category="campaigns", kind="x", kind_icon="x",
                            kind_tone="neutral", title="Other event", summary="x", narrative="x", target={}, actor_id="mem-bob",
                            outcome="success", response_status="200", origin="x", payload={}))
        s.add(SyncLog(id="sync-other", workspace_id=OTHER, account_id="acc-other", executed_at=now, executed_label="x", trigger="manual",
                      trigger_label="x", duration_sec=1.0, media=1, status="success", status_label="x", raw={}))
        s.commit()
    return OTHER


OTHER_IDS = {"cmp-other", "cnt-other", "lead-other", "cmt-other", "ins-other", "act-other", "rep-other", "ntf-other", "EVT_OTHER",
             "sync-other", "acc-other", "mem-bob"}


def _ids(payload) -> set[str]:
    items = payload["items"] if isinstance(payload, dict) and "items" in payload else payload
    return {item["id"] for item in items}


@pytest.mark.parametrize("path", ["/campaigns", "/content", "/leads", "/comments", "/insights", "/insights/actions", "/reports",
                                  "/notifications", "/activity", "/accounts", "/accounts/sync-logs", "/workspace/members", "/activity/actors"])
def test_lists_never_include_another_workspace(client, other_workspace, path):
    response = client.get(api(path))
    assert response.status_code == 200
    assert not (_ids(response.json()) & OTHER_IDS), path


@pytest.mark.parametrize("path", [
    "/campaigns/cmp-other", "/campaigns/cmp-other/detail", "/campaigns/cmp-other/content", "/campaigns/cmp-other/leads",
    "/campaigns/cmp-other/leads/funnel", "/content/cnt-other", "/content/cnt-other/analytics", "/comments/cmt-other",
    "/insights/ins-other", "/reports/rep-other", "/accounts/acc-other", "/accounts/acc-other/overview", "/accounts/acc-other/trends",
    "/accounts/acc-other/telemetry", "/accounts/acc-other/sync-logs",
])
def test_id_tampering_on_reads_returns_404(client, other_workspace, path):
    response = client.get(api(path))
    assert response.status_code == 404, path
    assert "Other" not in response.text and "secret" not in response.text  # nothing about the other tenant leaks


@pytest.mark.parametrize(("method", "path", "body"), [
    ("patch", "/campaigns/cmp-other", {"status": "paused"}),
    ("patch", "/leads/lead-other", {"status": "lost"}),
    ("patch", "/comments/cmt-other", {"status": "archived"}),
    ("post", "/comments/cmt-other/convert-to-lead", None),
    ("patch", "/insights/ins-other", {"status": "dismissed"}),
    ("patch", "/insights/actions/act-other", {"status": "done"}),
    ("post", "/insights/ins-other/steps/s1/toggle", None),
    ("patch", "/reports/rep-other", {"archived": True}),
    ("post", "/reports/rep-other/duplicate", None),
    ("post", "/reports/rep-other/regenerate", None),
    ("patch", "/notifications/ntf-other", {"read": True}),
    ("delete", "/notifications/ntf-other", None),
    ("patch", "/workspace/members/mem-bob", {"access": "Viewer"}),
    ("delete", "/workspace/members/mem-bob", None),
    ("post", "/accounts/acc-other/sync", None),
])
def test_id_tampering_on_writes_returns_404_and_changes_nothing(client, other_workspace, db_session, method, path, body):
    response = getattr(client, method)(api(path), **({"json": body} if body is not None else {}))
    assert response.status_code == 404, (path, response.text)
    db_session.expire_all()
    assert db_session.get(Campaign, "cmp-other").status.value == "active"
    assert db_session.get(Notification, "ntf-other").read is False
    assert db_session.get(Comment, "cmt-other").status.value == "needs_response"
    assert db_session.get(TeamMember, "mem-bob").access.value == "Owner"


def test_foreign_keys_from_another_workspace_are_rejected(client, other_workspace):
    campaign = client.post(api("/campaigns"), json={"name": "Sneaky", "objective": "Awareness", "accountId": "acc-other", "status": "draft"})
    assert campaign.status_code == 404
    lead = client.post(api("/leads"), json={"name": "X", "handle": "sneaky_x", "location": "X", "campaignId": "cmp-other",
                                             "contentId": None, "score": 1, "source": "comment", "firstMessage": "x"})
    assert lead.status_code == 404
    report = client.post(api("/reports"), json={
        "title": "Sneaky report", "type": "audience", "scope": "campaigns", "accountId": "ws-eko-india", "campaignIds": ["cmp-other"],
        "period": {"start": "2024-10-01", "end": "2024-10-31"}, "metrics": ["views"], "sections": ["summary"], "compareBaseline": False,
        "formats": ["csv"], "schedule": "none", "recipients": [],
    })
    assert report.status_code == 404


def test_bulk_updates_cannot_reach_another_workspace(client, other_workspace, db_session):
    response = client.post(api("/comments/bulk"), json={"ids": ["cmt-other"], "status": "archived"})
    assert response.json() == {"updated": 0}
    db_session.expire_all()
    assert db_session.get(Comment, "cmt-other").status.value == "needs_response"
    client.post(api("/notifications/mark-all-read"))
    db_session.expire_all()
    assert db_session.get(Notification, "ntf-other").read is False


def test_comment_cannot_be_linked_to_another_workspaces_lead(client, other_workspace, db_session):
    own_comment = db_session.scalar(select(Comment).where(Comment.workspace_id == "ws-eko-india").limit(1))
    response = client.patch(api(f"/comments/{own_comment.id}"), json={"leadId": "lead-other"})
    assert response.status_code == 404


def test_same_handles_and_codes_may_exist_in_both_workspaces(client, other_workspace):
    # The other tenant reuses "#CAM-8802", "#REP-2024-884", "#IG-CM-91823" and the lead handle "ramesh_m_up".
    assert client.get(api("/campaigns/sbi-csp-october")).json()["code"] == "#CAM-8802"
    leads = client.get(api("/leads"), params={"q": "ramesh_m_up"}).json()
    assert [l["id"] for l in leads] == ["lead-ramesh-maurya"]


def test_aggregates_are_per_workspace(client, client_as, other_workspace):
    assert client.get(api("/notifications/unread-count")).json() == 3  # the other tenant's unread alert is not counted
    bob = client_as("mem-bob", workspace_id=OTHER, user_id="usr_bob")
    assert bob.get(api("/notifications/unread-count")).json() == 1
    assert [c["id"] for c in bob.get(api("/campaigns")).json()] == ["cmp-other"]
    assert _ids(bob.get(api("/activity")).json()) == {"EVT_OTHER"}
    assert bob.get(api("/campaigns/sbi-csp-october")).status_code == 404
    assert bob.get(api("/workspace")).json()["name"] == "Other Co"


def test_a_session_cannot_be_pointed_at_a_workspace_without_membership(client_as, other_workspace):
    tampered = client_as("mem-bob", workspace_id="ws-eko-india", user_id="usr_bob")  # Bob has no membership there
    response = tampered.get(api("/campaigns"))
    assert response.status_code == 401 and response.json()["error"]["code"] == "session_expired"


def test_new_rows_are_stamped_with_the_session_workspace(client, other_workspace, db_session):
    created = client.post(api("/campaigns"), json={"name": "Stamped campaign", "objective": "Awareness", "accountId": "acc-ekoindia", "status": "draft"})
    assert created.status_code == 201
    row = db_session.get(Campaign, created.json()["id"])
    assert row.workspace_id == "ws-eko-india"
