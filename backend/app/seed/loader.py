"""Idempotent import of the frontend demonstration dataset (``demo_data.json``) into PostgreSQL.

* Every imported row is flagged ``is_demo = true`` — it is sample data, never live Instagram data.
* IDs from the frontend are preserved, so in-app links keep working.
* Default mode inserts rows that are missing and leaves existing rows untouched (safe to re-run;
  changes made through the API survive). ``reset=True`` restores demo rows to their original values.
* No records are invented: the loader only maps what the frontend dataset contains.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import Table
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app import models as m

DATA_FILE = Path(__file__).with_name("demo_data.json")

IST = timezone(timedelta(hours=5, minutes=30))
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def load_demo_data(path: Path = DATA_FILE) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _date(value: str | None) -> date | None:
    return date.fromisoformat(value[:10]) if value else None


def _ist(value: str) -> datetime:
    """Parse ISO datetimes; values without an offset are IST wall-clock time (as in the demo data)."""
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=IST)


def _short_day(label: str, year: int) -> date:
    """'Oct 1' → date(year, 10, 1)."""
    match = re.fullmatch(r"([A-Z][a-z]{2}) (\d{1,2})", label)
    if not match:
        raise ValueError(f"Unexpected day label: {label!r}")
    return date(year, MONTHS.index(match.group(1)) + 1, int(match.group(2)))


@dataclass
class SeedReport:
    inserted: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)

    @property
    def total_inserted(self) -> int:
        return sum(self.inserted.values())


class _Writer:
    def __init__(self, session: Session, reset: bool) -> None:
        self.session = session
        self.reset = reset
        self.report = SeedReport()

    def upsert(self, model: type[m.Base], rows: list[dict[str, Any]], conflict: list[str] | None = None) -> None:
        if not rows:
            return
        table: Table = model.__table__  # type: ignore[assignment]
        keys = conflict or [c.name for c in table.primary_key.columns]
        stmt = insert(table).values(rows)
        if self.reset:
            update_cols = {c: stmt.excluded[c] for c in rows[0] if c not in keys}
            stmt = stmt.on_conflict_do_update(index_elements=keys, set_=update_cols) if update_cols else stmt.on_conflict_do_nothing(index_elements=keys)
        else:
            stmt = stmt.on_conflict_do_nothing(index_elements=keys)
        result = self.session.execute(stmt.returning(*[table.c[k] for k in keys]))
        written = len(result.all())
        self.report.inserted[table.name] = self.report.inserted.get(table.name, 0) + written
        self.report.skipped[table.name] = self.report.skipped.get(table.name, 0) + len(rows) - written


def seed_demo_data(session: Session, data: dict[str, Any] | None = None, *, reset: bool = False) -> SeedReport:
    data = data or load_demo_data()
    w = _Writer(session, reset)
    demo = {"is_demo": True}

    ws = data["workspace"]
    period_start = date.fromisoformat(ws["reportingPeriod"]["start"])
    period_end = date.fromisoformat(ws["reportingPeriod"]["end"])
    year = period_start.year

    # --- workspace & team -------------------------------------------------------------
    w.upsert(m.Workspace, [{
        **demo, "id": ws["id"], "name": ws["name"], "plan": ws["plan"], "timezone": ws["timezone"], "currency": ws["currency"],
        "reporting_start": period_start, "reporting_end": period_end, "reporting_label": ws["reportingPeriod"]["label"],
        "baseline_start": _date(ws["baselinePeriod"]["start"]), "baseline_end": _date(ws["baselinePeriod"]["end"]),
        "baseline_label": ws["baselinePeriod"]["label"], "last_synced_label": ws["lastSyncedLabel"],
    }])
    w.upsert(m.TeamMember, [{
        **demo, "id": t["id"], "workspace_id": ws["id"], "name": t["name"], "email": t["email"].lower(), "role": t["role"],
        "access": t["access"], "avatar_url": t.get("avatarUrl"), "status": t["status"], "last_active_label": t["lastActive"],
        "is_session_user": t["id"] == data["currentUserId"], "position": i,
    } for i, t in enumerate(data["teamMembers"])])
    s = data["defaultWorkspaceSettings"]
    w.upsert(m.WorkspaceSettings, [{
        **demo, "workspace_id": ws["id"], "general": s["general"], "sync": s["sync"], "ai": s["ai"], "notifications": s["notifications"],
        "notification_preferences": data["defaultNotificationPreferences"], "updated_at_label": s["updatedAt"], "updated_by": s["updatedBy"],
    }])

    # --- accounts ----------------------------------------------------------------------
    w.upsert(m.InstagramAccount, [{
        **demo, "id": a["id"], "workspace_id": ws["id"], "display_name": a["displayName"], "handle": a["handle"], "initials": a["initials"],
        "avatar_url": a.get("avatarUrl"), "type": a["type"], "status": a["status"], "is_primary": a["isPrimary"], "verified": a["verified"],
        "external_id": a["externalId"], "connected_since": _date(a["connectedSince"]), "last_synced_label": a["lastSyncedAt"],
        "next_sync_label": a.get("nextSyncLabel"), "status_note": a.get("statusNote"), "followers": a["followers"],
        "following": a["following"], "media_count": a["mediaCount"], "data_availability": a["dataAvailability"],
        "scopes": a["scopes"], "position": i,
    } for i, a in enumerate(data["accounts"])])
    w.upsert(m.AccountTelemetry, [{**demo, "account_id": t["accountId"], "document": t} for t in data["accountTelemetry"]])
    w.upsert(m.SyncLog, [{
        **demo, "id": l["id"], "account_id": l["accountId"], "executed_at": _ist(l["executedAt"]), "executed_label": l["executedLabel"],
        "trigger": l["trigger"], "trigger_label": l["triggerLabel"], "duration_sec": l["durationSec"], "media": l["media"],
        "comments": l.get("comments"), "status": l["status"], "status_label": l["statusLabel"], "raw": l["raw"],
    } for l in data["syncLogs"]])

    # --- campaigns ---------------------------------------------------------------------
    spend = data["campaignBoostSpendInr"]
    w.upsert(m.Campaign, [{
        **demo, "id": c["id"], "code": c["code"], "name": c["name"], "objective": c["objective"], "focus": c["focus"], "status": c["status"],
        "start_date": _date(c["startDate"]), "end_date": _date(c["endDate"]), "account_id": c["accountId"],
        "creatives_count": c["creativesCount"], "creatives_note": c.get("creativesNote"), "thumbnail_url": c.get("thumbnailUrl"),
        "thumbnail_type": c.get("thumbnailType"), "owner": c["owner"], "budget_inr": c.get("budgetInr"), "lead_goal": c.get("leadGoal"),
        "primary_age_group": c.get("primaryAgeGroup"), "target_regions": c["targetRegions"], "hashtags": c["hashtags"],
        "health": c["health"], "boost_spend_inr": spend.get(c["id"]), "position": i,
    } for i, c in enumerate(data["campaigns"])])

    def metric_row(campaign_id: str, period: str, x: dict[str, Any]) -> dict[str, Any]:
        return {"campaign_id": campaign_id, "period": period, "views": x["views"], "reach": x["reach"], "engagement_rate": x["engagementRate"],
                "likes": x["likes"], "comments": x["comments"], "shares": x["shares"], "saves": x["saves"], "leads": x["leads"],
                "conversion_rate": x["conversionRate"]}

    metric_rows = [metric_row(c["id"], "current", c["metrics"]) for c in data["campaigns"] if c.get("metrics")]
    metric_rows += [metric_row(c["id"], "baseline", c["baseline"]) for c in data["campaigns"] if c.get("baseline")]
    w.upsert(m.CampaignMetrics, metric_rows)
    w.upsert(m.CampaignDetailExtras, [{
        **demo, "campaign_id": x["campaignId"], "progression": x.get("progression"), "analysis": x.get("analysis"),
        "comments_snapshot": x.get("comments"), "quick_view_recommendation": x.get("quickViewRecommendation"),
    } for x in data["campaignDetailExtras"]])

    # --- content -----------------------------------------------------------------------
    w.upsert(m.ContentItem, [{
        **demo, "id": c["id"], "account_id": c["accountId"], "campaign_id": c["campaignId"], "title": c["title"], "caption": c["caption"],
        "type": c["type"], "published_at": _date(c["publishedAt"]), "duration_sec": c.get("durationSec"), "slides": c.get("slides"),
        "thumbnail_url": c.get("thumbnailUrl"), "thumbnail_alt": c["thumbnailAlt"], "is_top_performer": c.get("isTopPerformer"),
        **{k: c["metrics"][k] for k in ("views", "reach", "likes", "comments", "shares", "saves", "leads")},
        "engagement_rate": c["metrics"]["engagementRate"], "retention": c["metrics"].get("retention"), "position": i,
    } for i, c in enumerate(data["contentItems"])])
    w.upsert(m.ContentAnalytics, [{**demo, "content_id": cid, "document": doc} for cid, doc in data["contentAnalytics"].items()])

    # --- leads -------------------------------------------------------------------------
    w.upsert(m.Lead, [{
        **demo, "id": l["id"], "campaign_id": l["campaignId"], "content_id": l["contentId"], "name": l["name"], "handle": l["handle"],
        "location": l["location"], "score": l["score"], "status": l["status"], "source": l["source"], "last_contact_label": l["lastContact"],
        "first_message": l["firstMessage"], "phone_masked": l.get("phoneMasked"), "notes": l.get("notes"), "position": i,
    } for i, l in enumerate(data["leads"])])
    # The dataset only has a funnel / channel split for SBI CSP October (Campaign Detail export).
    funnel_campaign = "sbi-csp-october"
    w.upsert(m.CampaignLeadFunnelStage, [{"campaign_id": funnel_campaign, "stage": k, "count": v} for k, v in data["octoberLeadFunnel"].items()])
    w.upsert(m.CampaignLeadChannel, [
        {"campaign_id": funnel_campaign, "label": ch["label"], "share": ch["share"], "leads": ch["leads"], "position": i}
        for i, ch in enumerate(data["octoberLeadChannels"])
    ], conflict=["campaign_id", "label"])

    # --- account analytics -------------------------------------------------------------
    ov, lp = data["accountOverview"], data["leadPipelineSummary"]
    account_id = ov["accountId"]
    w.upsert(m.AccountReportingPeriod, [{
        **demo, "account_id": account_id, "period_start": period_start, "period_end": period_end, "ai_health_score": ov["aiHealthScore"],
        "total_comment_inquiries": lp["totalCommentInquiries"], "ai_filtered_potential": lp["aiFilteredPotential"],
        "ai_intent_rate": lp["aiIntentRate"], "converted_operators": lp["convertedOperators"], "close_rate": lp["closeRate"],
    }])
    kpi_keys = ["views", "reach", "engagementRate", "likes", "comments", "shares", "saves", "leads", "watchTimeHours"]
    w.upsert(m.AccountKpi, [{
        "account_id": account_id, "period_start": period_start, "metric": k, "value": ov[k]["value"], "delta_pct": ov[k].get("delta"),
        "baseline": ov[k].get("baseline"), "target": ov[k].get("target"),
    } for k in kpi_keys])
    w.upsert(m.AccountDailyMetric, [{
        **demo, "account_id": account_id, "metric": metric, "day": _short_day(p["date"], year), "current_value": p["current"], "previous_value": p["previous"],
    } for metric, points in data["dailyTrends"].items() for p in points])

    au = data["audienceSummary"]
    w.upsert(m.AudienceSnapshot, [{
        **demo, "account_id": account_id, "period_start": period_start, "period_end": period_end, "follower_growth_pct": au["followerGrowthPct"],
        "net_new_followers": au["netNewFollowers"], "non_follower_reach_pct": au["nonFollowerReachPct"], "engaged_audience": au["engagedAudience"],
        "gender_male": au["gender"]["male"], "gender_female": au["gender"]["female"], "gender_unknown": au["gender"]["unknown"],
        "intelligence": data["audienceIntelligence"],
    }])
    breakdowns = [{
        "account_id": account_id, "period_start": period_start, "dimension": "age", "label": a["label"], "share": a["share"],
        "audience": a.get("audience"), "delta_pct": a.get("deltaPct"), "note": a.get("note"), "reach": None, "engaged": None, "leads": None, "position": i,
    } for i, a in enumerate(au["age"])]
    breakdowns += [{
        "account_id": account_id, "period_start": period_start, "dimension": "state", "label": st["label"], "share": st["share"],
        "audience": None, "delta_pct": None, "note": None, "reach": st.get("reach"), "engaged": st.get("engaged"), "leads": st.get("leads"), "position": i,
    } for i, st in enumerate(au["topStates"])]
    w.upsert(m.AudienceBreakdown, breakdowns, conflict=["account_id", "period_start", "dimension", "label"])

    # --- comments ----------------------------------------------------------------------
    w.upsert(m.Comment, [{
        **demo, "id": c["id"], "ref": c["ref"], "account_id": c["accountId"], "content_id": c["contentId"], "campaign_id": c["campaignId"],
        "lead_id": c.get("leadId"), "author_name": c["authorName"], "handle": c["handle"], "location": c.get("location"),
        "verified": c.get("verified"), "text": c["text"], "highlights": c["highlights"], "received_at": _ist(c["receivedAt"]),
        "received_label": c["receivedLabel"], "surface": c["surface"], "language": c["language"], "sentiment": c["sentiment"],
        "intent": c["intent"], "lead_potential": c["leadPotential"], "intent_score": c["intentScore"], "status": c["status"],
        "flagged": c["flagged"], "suggested_reply": c["suggestedReply"], "ai": c["ai"], "position": i,
    } for i, c in enumerate(data["comments"])])
    cs = data["commentSummary"]
    w.upsert(m.CommentPeriodSummary, [{
        **demo, "account_id": cs["accountId"], "period_start": _date(cs["period"]["start"]), "period_end": _date(cs["period"]["end"]),
        "total_comments": cs["totalComments"], "total_delta_pct": cs["totalDeltaPct"], "baseline_comments": cs["baselineComments"],
        "sentiment_positive": cs["sentiment"]["positive"], "sentiment_neutral": cs["sentiment"]["neutral"], "sentiment_negative": cs["sentiment"]["negative"],
        "potential_leads": cs["potentialLeads"], "potential_leads_delta_label": cs["potentialLeadsDeltaLabel"],
        "needs_response_total": cs["needsResponse"],
        "needs_response_sample_baseline": sum(1 for c in data["comments"] if c["status"] == "needs_response"),
        "responded": cs["responded"], "resolved": cs["resolved"], "avg_sentiment_score": cs["avgSentimentScore"],
        "avg_sentiment_delta_pts": cs["avgSentimentDeltaPts"], "classification_confidence": cs["classificationConfidence"],
        "intents": cs["intents"], "response_queue": cs["responseQueue"], "strategic_intel": cs["strategicIntel"],
        "strategic_intel_confidence": cs["strategicIntelConfidence"], "peak_note": cs["peakNote"],
    }])
    w.upsert(m.CommentSentimentDaily, [{
        **demo, "account_id": cs["accountId"], "day": _short_day(p["date"], year), "positive": p["positive"], "neutral": p["neutral"],
        "negative": p["negative"], "score": p["score"],
    } for p in data["sentimentTrend"]])

    # --- insights (stored AI output; no model is called) --------------------------------
    w.upsert(m.Insight, [{
        **demo, "id": i["id"], "category": i["category"], "priority": i["priority"], "confidence": i["confidence"], "title": i["title"],
        "observed": i["observed"], "interpretation": i["interpretation"], "impact": i["impact"], "primary_link": i["primaryLink"],
        "generated_label": i["generatedAt"], "status": i["status"], "completed_step_ids": i["completedStepIds"], "detail": i.get("detail"),
        "position": n,
    } for n, i in enumerate(data["insights"])])
    w.upsert(m.RecommendedAction, [{
        **demo, "id": a["id"], "insight_id": a["insightId"], "priority": a["priority"], "title": a["title"], "rationale": a["rationale"],
        "metric": a["metric"], "metric_note": a["metricNote"], "metric_note_tone": a.get("metricNoteTone"), "impact": a["impact"],
        "target": a["target"], "status": a["status"], "feedback": a.get("feedback"), "position": n,
    } for n, a in enumerate(data["recommendedActions"])])

    # --- reports -----------------------------------------------------------------------
    w.upsert(m.Report, [{
        **demo, "id": r["id"], "code": r["code"], "title": r["title"], "type": r["type"], "scope": r["scope"], "account_id": r["accountId"],
        "period_start": _date(r["period"]["start"]), "period_end": _date(r["period"]["end"]), "metrics": r["metrics"],
        "sections": r["sections"], "compare_baseline": r["compareBaseline"], "formats": r["formats"], "schedule": r["schedule"],
        "recipients": r["recipients"], "has_content_focus": "contentIds" in r, "status": r["status"], "icon": r["icon"],
        "generated_at": _ist(r["generatedAt"]), "generated_label": r["generatedLabel"], "created_by": r["createdBy"],
        "next_run_label": r.get("nextRunLabel"), "failure_reason": r.get("failureReason"), "narrative": r.get("narrative"),
    } for r in data["reports"]])
    w.upsert(m.ReportCampaign, [{"report_id": r["id"], "campaign_id": cid, "position": i} for r in data["reports"] for i, cid in enumerate(r["campaignIds"])])
    w.upsert(m.ReportContentItem, [{"report_id": r["id"], "content_id": cid, "position": i} for r in data["reports"] for i, cid in enumerate(r.get("contentIds") or [])])

    # --- notifications -------------------------------------------------------------------
    w.upsert(m.Notification, [{
        **demo, "id": n["id"], "category": n["category"], "priority": n["priority"], "title": n["title"], "body": n["body"],
        "emphasis": n.get("emphasis"), "quote": n.get("quote"), "time_label": n["timeLabel"], "timestamp_label": n["timestampLabel"],
        "group_key": n["group"], "read": n["read"], "href": n.get("href"), "icon": n["icon"], "tone": n["tone"], "badge": n["badge"],
        "tags": n["tags"], "primary_action": n["primaryAction"], "secondary_action": n.get("secondaryAction"), "meta": n["meta"],
        "report_id": n.get("reportId"), "position": i,
    } for i, n in enumerate(data["notifications"])])

    # --- activity ------------------------------------------------------------------------
    w.upsert(m.ActivityActor, [{
        **demo, "id": a["id"], "kind": a["kind"], "name": a["name"], "short_label": a["shortLabel"], "icon": a.get("icon"), "position": i,
    } for i, a in enumerate(data["systemActors"])])
    w.upsert(m.ActivityEvent, [{
        **demo, "id": e["id"], "occurred_at": _ist(e["timestamp"]), "category": e["category"], "kind": e["kind"], "kind_icon": e["kindIcon"],
        "kind_tone": e["kindTone"], "kind_icon_class": e.get("kindIconClass"), "title": e["title"], "title_tag": e.get("titleTag"),
        "summary": e["summary"], "narrative": e["narrative"], "target": e["target"], "actor_id": e["actorId"], "account_id": e.get("accountId"),
        "outcome": e["outcome"], "outcome_label": e.get("outcomeLabel"), "response_status": e["responseStatus"], "origin": e["origin"],
        "payload": e["payload"], "diff": e.get("diff"),
    } for e in data["activityEntries"]])

    # --- reference documents (presentation copy without relational structure) -------------
    w.upsert(m.ReferenceDocument, [
        {**demo, "key": key, "description": desc, "document": doc}
        for key, desc, doc in [
            ("insights_overview", "AI Insights overview synthesis copy (stored demo output)", data["insightsOverview"]),
            ("executive_brief", "Dashboard AI executive brief (stored demo output)", data["executiveBrief"]),
            ("accounts_summary", "Accounts overview summary, rate-limit notes and retention policy",
             {"meta": data["accountsSummaryMeta"], "rateLimitNotes": data["rateLimitNotes"], "retentionPolicy": data["retentionPolicy"]}),
            ("meta_scope_catalog", "Instagram Graph API scope descriptions", data["scopeCatalog"]),
            ("connect_reference", "Connect-flow prerequisites and sample (non-real) candidate accounts",
             {"prerequisites": data["connectPrerequisites"], "candidates": data["connectCandidates"]}),
            ("settings_environment", "Settings → environment panel", data["settingsEnvironment"]),
            ("settings_session", "Settings → current session panel (demo identity, no real auth)", data["settingsSession"]),
            ("notification_trigger_meta", "Settings → notification trigger definitions", data["notificationTriggerMeta"]),
            ("activity_meta", "Activity log period comparison", {"previousPeriodEventTotal": data["previousPeriodEventTotal"]}),
            ("report_reference", "Reports CPL benchmark", {"cplBenchmarkInr": data["cplBenchmarkInr"]}),
        ]
    ])

    session.flush()
    return w.report
