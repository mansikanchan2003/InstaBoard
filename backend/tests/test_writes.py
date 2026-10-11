"""Write endpoints used by the frontend (all local to InstaBoard; nothing reaches Instagram/Meta/AI)."""

from __future__ import annotations

import copy

from .conftest import api

NEW_CAMPAIGN = {
    "name": "Diwali CSP Push", "objective": "Lead Generation", "startDate": "2024-11-01", "endDate": "2024-11-15",
    "accountId": "acc-ekoindia", "targetRegions": ["Bihar"], "hashtags": ["#Eko"], "status": "scheduled",
}


def test_create_campaign_lists_it_first(client):
    created = client.post(api("/campaigns"), json=NEW_CAMPAIGN)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "scheduled" and body["metrics"] is None and body["code"] == "#CAM-8856"
    assert client.get(api("/campaigns")).json()[0]["id"] == body["id"]
    assert client.get(api(f"/campaigns/{body['id']}")).status_code == 200


def test_create_campaign_validation(client):
    bad_dates = {**NEW_CAMPAIGN, "startDate": "2024-11-20", "endDate": "2024-11-01"}
    assert client.post(api("/campaigns"), json=bad_dates).status_code == 422
    no_dates = {**NEW_CAMPAIGN, "startDate": "", "endDate": ""}
    assert client.post(api("/campaigns"), json=no_dates).status_code == 422  # scheduling needs dates
    expired = {**NEW_CAMPAIGN, "accountId": "acc-ekoregional"}
    response = client.post(api("/campaigns"), json=expired)
    assert response.status_code == 422 and response.json()["error"]["code"] == "validation_error"
    assert client.post(api("/campaigns"), json={**NEW_CAMPAIGN, "accountId": "acc-missing"}).status_code == 404


def test_patch_campaign_status_and_fields(client):
    paused = client.patch(api("/campaigns/sbi-csp-october"), json={"status": "paused"})
    assert paused.status_code == 200 and paused.json()["status"] == "paused"
    renamed = client.patch(api("/campaigns/sbi-csp-october"), json={"name": "SBI CSP October (edited)", "leadGoal": 250})
    assert renamed.json()["name"] == "SBI CSP October (edited)" and renamed.json()["leadGoal"] == 250
    assert client.patch(api("/campaigns/sbi-csp-october"), json={"endDate": "2024-09-01"}).status_code == 422
    assert client.patch(api("/campaigns/sbi-csp-october"), json={}).status_code == 422
    assert client.patch(api("/campaigns/nope"), json={"status": "paused"}).status_code == 404


def test_lead_status_update(client):
    response = client.patch(api("/leads/lead-ramesh-maurya"), json={"status": "contacted"})
    assert response.status_code == 200
    assert response.json()["status"] == "contacted" and response.json()["lastContact"] == "Just now"
    assert client.patch(api("/leads/lead-ramesh-maurya"), json={"status": "won"}).status_code == 422


def test_create_lead_from_comment_deduplicates_by_handle(client):
    payload = {"name": "Manoj Yadav", "handle": "manoj_y_up", "location": "Ballia, UP", "campaignId": "sbi-csp-october",
               "contentId": "sbi-csp-mitra-reel", "score": 81, "source": "comment", "firstMessage": "CSP ke liye kaise apply karein?"}
    first = client.post(api("/leads"), json=payload)
    assert first.status_code == 201 and first.json()["created"] is True and first.json()["lead"]["status"] == "new"
    again = client.post(api("/leads"), json={**payload, "name": "Different Name"})
    assert again.status_code == 200 and again.json() == {"lead": first.json()["lead"], "created": False}
    existing = client.post(api("/leads"), json={**payload, "handle": "RAMESH_M_UP"})  # case-insensitive
    assert existing.status_code == 200 and existing.json()["lead"]["id"] == "lead-ramesh-maurya"


def test_comment_triage_updates_awaiting_count(client):
    before = client.get(api("/comments/summary")).json()["needsResponse"]
    waiting = client.get(api("/comments"), params={"status": "needs_response"}).json()["items"]
    response = client.patch(api(f"/comments/{waiting[0]['id']}"), json={"status": "reviewed", "flagged": True})
    assert response.status_code == 200 and response.json()["flagged"] is True
    assert client.get(api("/comments/summary")).json()["needsResponse"] == before - 1
    bulk = client.post(api("/comments/bulk"), json={"ids": [c["id"] for c in waiting[1:3]], "status": "archived"})
    assert bulk.json() == {"updated": 2}
    assert client.patch(api(f"/comments/{waiting[0]['id']}"), json={"leadId": "lead-missing"}).status_code == 404


def test_notifications_read_state(client):
    assert client.patch(api("/notifications/ntf-token-ekomitracare"), json={"read": True}).json()["read"] is True
    assert client.get(api("/notifications/unread-count")).json() == 2
    assert client.post(api("/notifications/mark-all-read")).json() == 9
    assert client.get(api("/notifications/unread-count")).json() == 0
    assert client.delete(api("/notifications/ntf-token-ekomitracare")).json() == {"id": "ntf-token-ekomitracare"}
    assert client.delete(api("/notifications/ntf-token-ekomitracare")).status_code == 404


def test_notification_preferences_validation(client):
    prefs = client.get(api("/notifications/preferences")).json()
    prefs["thresholds"]["tokenExpiryDays"] = 7
    assert client.put(api("/notifications/preferences"), json=prefs).json()["thresholds"]["tokenExpiryDays"] == 7
    broken = copy.deepcopy(prefs)
    del broken["categories"]["ai"]
    assert client.put(api("/notifications/preferences"), json=broken).status_code == 422


def test_insight_review_and_step_toggle(client):
    reviewed = client.patch(api("/insights/ins-hindi-reels-vs-carousels"), json={"status": "reviewed"})
    assert reviewed.json()["status"] == "reviewed"
    toggled = client.post(api("/insights/ins-hindi-reels-vs-carousels/steps/step-1/toggle")).json()
    assert "step-1" in toggled["completedStepIds"]
    untoggled = client.post(api("/insights/ins-hindi-reels-vs-carousels/steps/step-1/toggle")).json()
    assert "step-1" not in untoggled["completedStepIds"]
    assert client.post(api("/insights/ins-hindi-reels-vs-carousels/steps/step-99/toggle")).status_code == 404
    actions = client.get(api("/insights/actions")).json()
    done = client.patch(api(f"/insights/actions/{actions[0]['id']}"), json={"status": "done", "feedback": "Shipped"})
    assert done.json()["status"] == "done" and done.json()["feedback"] == "Shipped"


def test_features_needing_external_integrations_return_501(client):
    for method, path in [("post", "/accounts/acc-ekoindia/sync"), ("delete", "/accounts/acc-ekoindia")]:
        response = getattr(client, method)(api(path))
        assert response.status_code == 501, path
        assert response.json()["error"]["code"] == "not_available"
    assert client.post(api("/accounts/nope/sync")).status_code == 404
    # Phase 7: insight regeneration exists now; without an AI provider it reports that clearly instead of 501.
    response = client.post(api("/insights/regenerate"))
    assert response.status_code == 503 and response.json()["error"]["code"] == "ai_disabled"


REPORT_CONFIG = {
    "title": "November preview", "type": "campaign_performance", "scope": "campaigns", "accountId": "acc-ekoindia",
    "campaignIds": ["sbi-csp-october"], "period": {"start": "2024-10-01", "end": "2024-10-31"}, "metrics": ["views", "leads"],
    "sections": ["summary", "kpis"], "compareBaseline": True, "formats": ["csv"], "schedule": "weekly", "recipients": ["Ops@Eko.example"],
}


def test_report_lifecycle(client):
    created = client.post(api("/reports"), json=REPORT_CONFIG)
    assert created.status_code == 201, created.text
    report = created.json()
    assert report["id"] == "rep-2024-887" and report["status"] == "ready_demo"
    assert report["recipients"] == ["ops@eko.example"] and "contentIds" not in report
    assert "requires a scheduler" in report["nextRunLabel"]
    updated = client.put(api(f"/reports/{report['id']}"), json={**REPORT_CONFIG, "title": "Renamed", "contentIds": ["sbi-csp-mitra-reel"]})
    assert updated.json()["title"] == "Renamed" and updated.json()["contentIds"] == ["sbi-csp-mitra-reel"]
    assert client.patch(api(f"/reports/{report['id']}"), json={"archived": True}).json()["status"] == "archived"
    assert client.post(api(f"/reports/{report['id']}/duplicate")).json()["title"] == "Renamed (Copy)"
    assert client.post(api("/reports/rep-2024-884/regenerate")).json()["generatedLabel"] == "Regenerated just now"


def test_report_validation(client):
    assert client.post(api("/reports"), json={**REPORT_CONFIG, "campaignIds": ["nope"]}).status_code == 404
    assert client.post(api("/reports"), json={**REPORT_CONFIG, "period": {"start": "2024-10-31", "end": "2024-10-01"}}).status_code == 422
    assert client.post(api("/reports"), json={**REPORT_CONFIG, "recipients": ["not-an-email"]}).status_code == 422


def test_settings_save_records_an_audit_entry(client):
    settings = client.get(api("/settings")).json()
    settings["general"]["displayName"] = "Eko India (renamed)"
    saved = client.put(api("/settings"), json=settings)
    assert saved.status_code == 200
    assert saved.json()["general"]["displayName"] == "Eko India (renamed)" and saved.json()["updatedBy"] == "Priya Sharma"
    latest = client.get(api("/activity"), params={"limit": 1}).json()[0]
    assert latest["title"] == "Workspace Settings Updated"
    assert latest["diff"] == [{"field": "Workspace display name", "before": "Eko India Financial Services", "after": "Eko India (renamed)"}]


def test_settings_validation(client):
    settings = client.get(api("/settings")).json()
    settings["sync"]["intervalHours"] = 5
    assert client.put(api("/settings"), json=settings).status_code == 422
    settings = client.get(api("/settings")).json()
    settings["ai"]["categories"] = {k: False for k in settings["ai"]["categories"]}
    assert client.put(api("/settings"), json=settings).status_code == 422


def test_team_management(client):
    invited = client.post(api("/workspace/members"), json={"email": "New.Person@eko.example", "access": "Viewer"})
    assert invited.status_code == 201
    member = invited.json()
    assert member["status"] == "invited" and member["name"] == "New Person"
    assert client.post(api("/workspace/members"), json={"email": "new.person@eko.example", "access": "Viewer"}).status_code == 409
    assert client.patch(api(f"/workspace/members/{member['id']}"), json={"access": "Editor"}).json()["access"] == "Editor"
    assert client.patch(api("/workspace/members/usr-priya"), json={"access": "Viewer"}).status_code == 409  # owner
    assert client.patch(api(f"/workspace/members/{member['id']}"), json={"access": "Owner"}).status_code == 422
    assert client.delete(api(f"/workspace/members/{member['id']}")).json() == {"id": member["id"]}
    assert client.delete(api("/workspace/members/usr-priya")).status_code == 409
