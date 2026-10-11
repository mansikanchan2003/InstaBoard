"""Phase 3 write operations: status transitions, lead details, idempotent comment → lead conversion,
mass-assignment protection and activity logging. (Runs inside the rolled-back test transaction.)"""

from __future__ import annotations

from sqlalchemy import func, select

from app.models import Comment, Lead

from .conftest import api


def latest_activity(client) -> dict:
    return client.get(api("/activity"), params={"limit": 1}).json()[0]


# ------------------------------------------------------------------------------------ campaigns
def test_pause_and_resume_are_logged_with_a_diff(client):
    paused = client.patch(api("/campaigns/sbi-csp-october"), json={"status": "paused"})
    assert paused.status_code == 200 and paused.json()["status"] == "paused"
    entry = latest_activity(client)
    assert entry["title"] == "Campaign Paused" and entry["category"] == "campaigns"
    assert entry["diff"] == [{"field": "Status", "before": "active", "after": "paused"}]
    assert entry["actorId"] == "usr-priya" and entry["target"]["to"] == "/campaigns/sbi-csp-october"
    resumed = client.patch(api("/campaigns/sbi-csp-october"), json={"status": "active"})
    assert resumed.json()["status"] == "active" and latest_activity(client)["title"] == "Campaign Resumed"


def test_invalid_status_transitions_are_conflicts(client):
    completed = client.patch(api("/campaigns/digital-banking-awareness"), json={"status": "active"})
    assert completed.status_code == 409
    error = completed.json()["error"]
    assert error["code"] == "conflict" and error["details"] == {"from": "completed", "to": "active", "allowed": []}
    draft_to_active = client.patch(api("/campaigns/micro-atm-awareness-push"), json={"status": "active"})
    assert draft_to_active.status_code == 409 and draft_to_active.json()["error"]["details"]["allowed"] == ["scheduled"]
    # Unchanged after the rejected requests.
    assert client.get(api("/campaigns/digital-banking-awareness")).json()["status"] == "completed"


def test_scheduling_a_draft_requires_dates(client):
    no_dates = client.patch(api("/campaigns/micro-atm-awareness-push"), json={"status": "scheduled"})
    assert no_dates.status_code == 422 and no_dates.json()["error"]["details"] == {"field": "startDate"}
    scheduled = client.patch(api("/campaigns/micro-atm-awareness-push"),
                             json={"startDate": "2024-12-01", "endDate": "2024-12-20", "status": "scheduled"})
    assert scheduled.status_code == 200 and scheduled.json()["status"] == "scheduled"
    assert client.patch(api("/campaigns/micro-atm-awareness-push"), json={"status": "draft"}).json()["status"] == "draft"


def test_same_status_is_a_no_op_without_an_audit_entry(client):
    before = latest_activity(client)["id"]
    assert client.patch(api("/campaigns/sbi-csp-october"), json={"status": "active"}).status_code == 200
    assert latest_activity(client)["id"] == before


def test_account_cannot_change_after_a_campaign_starts(client):
    response = client.patch(api("/campaigns/sbi-csp-october"), json={"accountId": "acc-ekomitracare"})
    assert response.status_code == 409


def test_campaign_writes_reject_read_only_fields(client):
    for body in ({"metrics": {"views": 1}}, {"code": "#CAM-1"}, {"health": "excellent"}, {"name": "ok name", "views": 5}):
        response = client.patch(api("/campaigns/sbi-csp-october"), json=body)
        assert response.status_code == 422, body
    assert client.get(api("/campaigns/sbi-csp-october")).json()["metrics"]["views"] == 842000


def test_campaign_create_is_logged(client):
    created = client.post(api("/campaigns"), json={
        "name": "Winter Draft", "objective": "Awareness", "accountId": "acc-ekoindia", "status": "draft",
    })
    assert created.status_code == 201 and created.json()["startDate"] is None
    entry = latest_activity(client)
    assert entry["title"] == "Campaign Created" and entry["target"]["to"] == f"/campaigns/{created.json()['id']}"


# ---------------------------------------------------------------------------------------- leads
def test_lead_notes_persist_and_are_audited_without_their_content(client):
    response = client.patch(api("/leads/lead-sunita-devi"), json={"notes": "  Called; wants kiosk in Muzaffarpur.  "})
    assert response.status_code == 200 and response.json()["notes"] == "Called; wants kiosk in Muzaffarpur."
    assert response.json()["lastContact"] == "2h ago"  # notes alone do not count as contact
    again = client.get(api("/leads")).json()
    assert next(l for l in again if l["id"] == "lead-sunita-devi")["notes"] == "Called; wants kiosk in Muzaffarpur."
    entry = latest_activity(client)
    assert entry["title"] == "Lead Updated"
    assert "Muzaffarpur" not in str(entry)  # free-text notes are not copied into the audit trail


def test_lead_status_and_details_validation(client):
    assert client.patch(api("/leads/lead-sunita-devi"), json={"status": "won"}).status_code == 422
    assert client.patch(api("/leads/lead-sunita-devi"), json={"status": None}).status_code == 422
    assert client.patch(api("/leads/lead-sunita-devi"), json={}).status_code == 422
    assert client.patch(api("/leads/lead-sunita-devi"), json={"score": 1}).status_code == 422  # not editable
    assert client.patch(api("/leads/lead-missing"), json={"status": "lost"}).status_code == 404
    lost = client.patch(api("/leads/lead-sunita-devi"), json={"status": "lost"})
    assert lost.json()["status"] == "lost" and lost.json()["lastContact"] == "Just now"


def test_lead_create_validates_references(client):
    base = {"name": "A B", "handle": "ab_test", "location": "X", "campaignId": "sbi-csp-october", "contentId": "sbi-csp-mitra-reel",
            "score": 70, "source": "comment", "firstMessage": "hi"}
    assert client.post(api("/leads"), json={**base, "campaignId": "nope"}).status_code == 404
    assert client.post(api("/leads"), json={**base, "contentId": "nope"}).status_code == 404
    mismatch = client.post(api("/leads"), json={**base, "contentId": "daily-income-eko-csp-mitra"})
    assert mismatch.status_code == 422  # that reel belongs to another campaign
    assert client.post(api("/leads"), json={**base, "status": "converted"}).status_code == 422  # status is not settable here


# ------------------------------------------------------------------------- comment → lead conversion
def _unconverted_comment(db_session) -> Comment:
    lead_handles = select(func.lower(Lead.handle))
    return db_session.scalar(
        select(Comment).where(Comment.lead_id.is_(None), Comment.campaign_id.is_not(None), func.lower(Comment.handle).not_in(lead_handles)).limit(1)
    )


def test_convert_comment_creates_one_lead_and_is_idempotent(client, db_session):
    comment = _unconverted_comment(db_session)
    leads_before = db_session.scalar(select(func.count()).select_from(Lead))
    first = client.post(api(f"/comments/{comment.id}/convert-to-lead"))
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["created"] is True
    assert body["comment"]["status"] == "lead_created" and body["comment"]["leadId"] == body["lead"]["id"]
    assert body["lead"]["sourceCommentId"] == comment.id and body["lead"]["campaignId"] == comment.campaign_id
    assert body["lead"]["contentId"] == comment.content_id and body["lead"]["source"] == "comment"

    for _ in range(2):  # retried requests
        repeat = client.post(api(f"/comments/{comment.id}/convert-to-lead"))
        assert repeat.status_code == 200 and repeat.json()["created"] is False and repeat.json()["lead"]["id"] == body["lead"]["id"]
    assert db_session.scalar(select(func.count()).select_from(Lead)) == leads_before + 1
    # Retries change nothing, so they add no audit entries: exactly one conversion event exists.
    events = [e for e in client.get(api("/activity"), params={"limit": 10}).json() if e["payload"].get("comment_id") == comment.id]
    assert [e["title"] for e in events] == ["Comment Converted to Lead"]


def test_convert_comment_from_existing_lead_links_instead_of_duplicating(client, db_session):
    comment = db_session.scalar(select(Comment).where(func.lower(Comment.handle) == "ramesh_m_up", Comment.lead_id.is_(None)).limit(1))
    if comment is None:  # every seeded comment by this handle may already be linked
        comment = db_session.scalar(select(Comment).where(func.lower(Comment.handle) == "ramesh_m_up"))
        comment.lead_id = None
        db_session.flush()
    response = client.post(api(f"/comments/{comment.id}/convert-to-lead"))
    assert response.status_code == 200 and response.json()["created"] is False
    assert response.json()["lead"]["id"] == "lead-ramesh-maurya"
    assert db_session.scalar(select(func.count()).select_from(Lead).where(func.lower(Lead.handle) == "ramesh_m_up")) == 1


def test_convert_comment_errors(client, db_session):
    assert client.post(api("/comments/nope/convert-to-lead")).status_code == 404
    comment = _unconverted_comment(db_session)
    comment.campaign_id = None
    db_session.flush()
    response = client.post(api(f"/comments/{comment.id}/convert-to-lead"))
    assert response.status_code == 409 and response.json()["error"]["code"] == "conflict"


def test_lead_created_status_requires_a_lead(client, db_session):
    comment = _unconverted_comment(db_session)
    assert client.patch(api(f"/comments/{comment.id}"), json={"status": "lead_created"}).status_code == 422
    assert client.post(api("/comments/bulk"), json={"ids": [comment.id], "status": "lead_created"}).status_code == 422
    assert client.patch(api(f"/comments/{comment.id}"), json={"intent": "complaint"}).status_code == 422  # AI fields are read-only


def test_bulk_triage_is_logged_once(client, db_session):
    ids = list(db_session.scalars(select(Comment.id).where(Comment.status == "needs_response").limit(3)))
    response = client.post(api("/comments/bulk"), json={"ids": ids + ids[:1], "status": "reviewed"})
    assert response.json() == {"updated": 3}
    assert latest_activity(client)["summary"] == "Set 3 comments to reviewed."


# ----------------------------------------------------------------------- insights / reports / prefs
def test_insight_dismiss_and_report_archive_are_logged(client):
    client.patch(api("/insights/ins-hindi-reels-vs-carousels"), json={"status": "dismissed"})
    assert latest_activity(client)["title"] == "Insight Dismissed"
    client.patch(api("/reports/rep-2024-884"), json={"archived": True})
    entry = latest_activity(client)
    assert entry["title"] == "Report Archived" and "nothing was emailed" in entry["narrative"]


def test_notification_preferences_persist_and_are_logged(client):
    prefs = client.get(api("/notifications/preferences")).json()
    prefs["channels"]["emailDigest"] = not prefs["channels"]["emailDigest"]
    assert client.put(api("/notifications/preferences"), json=prefs).status_code == 200
    assert client.get(api("/notifications/preferences")).json() == prefs
    assert latest_activity(client)["title"] == "Notification Preferences Updated"
