"""Read endpoints: lists, details, filters, pagination, 404s, empty database, aggregation consistency."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models import ActivityEvent, Campaign, CampaignMetrics, ContentItem, Notification
from app.models.enums import MetricPeriod

from .conftest import api


# ------------------------------------------------------------------------------- health
def test_ready_with_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}


# ------------------------------------------------------------------------------- lists & details
@pytest.mark.parametrize(
    ("path", "count"),
    [("/campaigns", 7), ("/content", 10), ("/leads", 10), ("/accounts", 3), ("/insights", 8), ("/notifications", 9),
     ("/reports", 12), ("/workspace/members", 5), ("/activity", 148), ("/accounts/sync-logs", 18)],
)
def test_list_sizes_match_seeded_records(client, path, count):
    response = client.get(api(path))
    assert response.status_code == 200
    assert len(response.json()) == count


@pytest.mark.parametrize(
    "path",
    ["/campaigns/nope", "/campaigns/nope/detail", "/campaigns/nope/content", "/campaigns/nope/leads", "/campaigns/nope/leads/funnel",
     "/content/nope", "/content/nope/analytics", "/accounts/nope", "/accounts/nope/overview", "/accounts/nope/trends",
     "/accounts/nope/telemetry", "/accounts/nope/sync-logs", "/comments/nope", "/insights/nope", "/reports/nope"],
)
def test_missing_records_return_404_envelope(client, path):
    response = client.get(api(path))
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert "nope" in error["message"]


def test_optional_detail_payloads_are_null_not_404(client):
    assert client.get(api("/campaigns/eko-kiosk-festival-drive/detail")).json() is None
    assert client.get(api("/campaigns/digital-banking-awareness/leads/funnel")).json() is None
    assert client.get(api("/content/open-your-csp-today/analytics")).json() is None


def test_campaign_shape_keeps_nullable_and_optional_fields_distinct(client):
    draft = client.get(api("/campaigns/micro-atm-awareness-push")).json()
    assert draft["metrics"] is None and draft["startDate"] is None and draft["health"] is None  # nullable → present
    assert "baseline" not in draft and "thumbnailUrl" not in draft  # optional → omitted


# ------------------------------------------------------------------------------- filtering
def test_campaign_filters(client):
    active = client.get(api("/campaigns"), params={"status": "active"}).json()
    assert {c["id"] for c in active} == {"sbi-csp-october", "sbi-csp-mitra-recruitment"}
    awareness = client.get(api("/campaigns"), params={"objective": "Awareness"}).json()
    assert all(c["objective"] == "Awareness" for c in awareness) and len(awareness) == 3
    search = client.get(api("/campaigns"), params={"q": "cam-8802"}).json()
    assert [c["id"] for c in search] == ["sbi-csp-october"]


def test_lead_content_comment_filters(client):
    assert all(l["status"] == "new" for l in client.get(api("/leads"), params={"status": "new"}).json())
    reels = client.get(api("/content"), params={"type": "reel"}).json()
    assert reels and all(c["type"] == "reel" for c in reels)
    negative = client.get(api("/comments"), params={"sentiment": "negative"}).json()
    assert negative["items"] and all(c["sentiment"] == "negative" for c in negative["items"])
    assert negative["totalComments"] == 6410  # period total is independent of the filter


def test_activity_filters_and_pagination(client):
    first = client.get(api("/activity"), params={"limit": 5}).json()
    second = client.get(api("/activity"), params={"limit": 5, "offset": 5}).json()
    assert len(first) == 5 and len(second) == 5
    assert {e["id"] for e in first}.isdisjoint({e["id"] for e in second})
    assert [e["timestamp"] for e in first] == sorted((e["timestamp"] for e in first), reverse=True)
    failed = client.get(api("/activity"), params={"outcome": "failed"}).json()
    assert failed and all(e["outcome"] == "failed" for e in failed)


def test_sync_log_pagination_is_newest_first(client):
    logs = client.get(api("/accounts/acc-ekoindia/sync-logs"), params={"limit": 3}).json()
    assert len(logs) == 3
    assert logs[0]["executedAt"] >= logs[1]["executedAt"] >= logs[2]["executedAt"]


# ------------------------------------------------------------------------------- empty database
@pytest.mark.parametrize("path", ["/campaigns", "/content", "/leads", "/accounts", "/insights", "/insights/actions", "/notifications",
                                  "/reports", "/activity", "/accounts/sync-logs", "/comments/sentiment-trend"])
def test_empty_workspace_returns_empty_lists(empty_client, path):
    response = empty_client.get(api(path))
    assert response.status_code == 200
    assert response.json() == []


def test_empty_workspace_singletons_return_404(empty_client):
    for path in ["/settings", "/leads/summary", "/comments/summary", "/audience/summary", "/insights/overview", "/dashboard/executive-brief"]:
        response = empty_client.get(api(path))
        assert response.status_code == 404, path
        assert response.json()["error"]["code"] == "not_found"


def test_empty_workspace_still_knows_who_you_are(empty_client):
    assert empty_client.get(api("/workspace")).json()["id"] == "ws-eko-india"
    assert empty_client.get(api("/me")).json()["id"] == "usr-priya"


def test_empty_workspace_counts(empty_client):
    assert empty_client.get(api("/notifications/unread-count")).json() == 0
    comments = empty_client.get(api("/comments")).json()
    assert comments == {"items": [], "sampleSize": 0, "totalComments": 0}


# ------------------------------------------------------------------------------- aggregation consistency
def test_overview_total_content_is_counted_from_content_rows(client, db_session):
    overview = client.get(api("/accounts/acc-ekoindia/overview")).json()
    count = db_session.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.account_id == "acc-ekoindia"))
    assert overview["totalContent"] == count == 10


def test_campaign_totals_stay_within_account_totals(client, db_session):
    overview = client.get(api("/accounts/acc-ekoindia/overview")).json()
    sums = db_session.execute(
        select(func.sum(CampaignMetrics.views), func.sum(CampaignMetrics.comments), func.sum(CampaignMetrics.leads))
        .where(CampaignMetrics.period == MetricPeriod.current)
    ).one()
    assert sums[0] <= overview["views"]["value"]
    assert sums[1] <= overview["comments"]["value"]
    assert sums[2] <= overview["leads"]["value"]


def test_october_creatives_sum_to_campaign_totals(client):
    campaign = client.get(api("/campaigns/sbi-csp-october")).json()
    items = client.get(api("/campaigns/sbi-csp-october/content")).json()
    for key in ("views", "reach", "leads"):
        assert sum(i["metrics"][key] for i in items) == campaign["metrics"][key]
    funnel = client.get(api("/campaigns/sbi-csp-october/leads/funnel")).json()
    assert sum(funnel["funnel"].values()) == campaign["metrics"]["leads"]


def test_daily_trends_sum_to_kpis(client):
    trends = client.get(api("/accounts/acc-ekoindia/trends")).json()
    overview = client.get(api("/accounts/acc-ekoindia/overview")).json()
    assert len(trends["views"]) == 31
    assert abs(sum(p["current"] for p in trends["views"]) - overview["views"]["value"]) < 100


def test_lead_summary_derives_from_account_kpis(client):
    summary = client.get(api("/leads/summary")).json()
    overview = client.get(api("/accounts/acc-ekoindia/overview")).json()
    assert summary["qualifiedLeads"] == overview["leads"]["value"] == 482
    assert summary["qualifiedLeadsDelta"] == overview["leads"]["delta"]


def test_unread_count_is_counted_from_rows(client, db_session):
    expected = db_session.scalar(select(func.count()).select_from(Notification).where(Notification.read.is_(False)))
    assert client.get(api("/notifications/unread-count")).json() == expected == 3


def test_activity_summary_matches_rows(client, db_session):
    from datetime import datetime, timedelta, timezone

    ist = timezone(timedelta(hours=5, minutes=30))
    window = (ActivityEvent.occurred_at >= datetime(2024, 10, 1, tzinfo=ist)) & (ActivityEvent.occurred_at < datetime(2024, 11, 1, tzinfo=ist))
    summary = client.get(api("/activity/summary")).json()
    in_october = db_session.scalar(select(func.count()).select_from(ActivityEvent).where(window))
    outside = db_session.scalar(select(func.count()).select_from(ActivityEvent).where(~window))
    assert summary["total"] == in_october == 146 and outside == 2  # two September events are excluded
    assert summary["automated"] + summary["operator"] == summary["total"]
    assert 0 <= summary["pipelineHealth"] <= 100


def test_comment_summary_sentiment_adds_up(client):
    summary = client.get(api("/comments/summary")).json()
    assert sum(summary["sentiment"].values()) == summary["totalComments"] == 6410
    assert summary["needsResponse"] == 142


def test_campaign_list_avoids_n_plus_one(client, connection):
    statements: list[str] = []
    from sqlalchemy import event

    def record(conn, cursor, statement, *args):
        statements.append(statement)

    event.listen(connection, "before_cursor_execute", record)
    try:
        assert len(client.get(api("/campaigns")).json()) == 7
    finally:
        event.remove(connection, "before_cursor_execute", record)
    # Ignore the authentication lookups (session, user, membership) — count the campaign queries only.
    selects = [s for s in statements if s.lstrip().upper().startswith("SELECT") and ("FROM campaigns" in s or "FROM campaign_metrics" in s)]
    assert len(selects) <= 2, selects  # campaigns + eager-loaded metrics, not one query per campaign


def test_demo_rows_are_flagged(db_session):
    assert db_session.scalar(select(func.count()).select_from(Campaign).where(Campaign.is_demo.is_(False))) == 0
