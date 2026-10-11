"""Deterministic campaign analytics (no AI). Every number the AI layer may mention comes from here.

Definitions (also in the README):

* **Engagements** = likes + comments + shares + saves (measured per content item).
* **Engagement rate (by reach)** = engagements ÷ reach × 100, computed over items where all five inputs are present
  and reach > 0. Aggregate ER = Σ engagements ÷ Σ reach × 100 (reach-weighted), not an average of ratios.
* **Lead attribution** = a lead counts for the period when its source content (``leads.content_id``) was published in
  the period; leads with only a campaign attribution count when that campaign's dates overlap the period.
* **Lead conversion rate** = attributed leads with status ``converted`` ÷ attributed leads × 100.
* **Lead yield** = attributed leads ÷ reach × 1,000 (leads per 1,000 accounts reached).
* **Period change** = (current − previous) ÷ previous × 100, previous = the equal-length period just before.

Sufficiency rules: a rate needs ≥ ``MIN_ITEMS`` content items (or ≥ ``MIN_LEADS`` leads for conversion); a comparison
needs both sides sufficient; a change is "notable" only when |change| ≥ ``NOTABLE_CHANGE_PCT``. Missing values are
excluded from numerators *and* denominators and reported as ``missing`` — never treated as zero.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import UnprocessableError
from app.models import (
    Campaign, ContentItem, InstagramAccountInsight, InstagramConnection, InstagramMedia, InstagramMediaInsight, Lead,
)
from app.models.enums import IgConnectionStatus
from app.services.common import current_workspace

MIN_ITEMS = 3
MIN_LEADS = 10
NOTABLE_CHANGE_PCT = 20.0
ENGAGEMENT_PARTS = ("likes", "comments", "shares", "saves")
DEFINITIONS = {
    "posts": "Number of content items published in the period.",
    "views": "Sum of views of content published in the period (measured).",
    "reach": "Sum of reach of content published in the period (measured).",
    "engagements": "likes + comments + shares + saves, summed over content published in the period.",
    "engagement_rate": "Σ(likes + comments + shares + saves) ÷ Σ reach × 100 over items with all values present and reach > 0.",
    "leads": "Leads whose source content was published in the period (plus campaign-only leads when the campaign overlaps the period).",
    "conversion_rate": "Attributed leads with status 'converted' ÷ attributed leads × 100.",
    "lead_yield": "Attributed leads ÷ Σ reach × 1,000.",
    "followers": "Followers count observed at each sync (Instagram API); first vs last observation in the period.",
    "period_change": "(current − previous) ÷ previous × 100; previous = equal-length period immediately before.",
}


@dataclass
class Fact:
    """One verifiable number with its definition, period, sample size and provenance."""

    id: str
    metric: str
    label: str
    value: float | None
    unit: str  # count | percent | per_1000
    kind: str  # measured | calculated | comparison
    definition: str
    period_start: str
    period_end: str
    sample_size: int
    missing: int = 0
    sufficient: bool = True
    source: str = "demo_dataset"  # demo_dataset | workspace_data | instagram_api
    scope: dict = field(default_factory=dict)  # {type, id, name}
    note: str | None = None

    def display(self) -> str:
        if self.value is None:
            return "unavailable"
        if self.unit == "percent":
            return f"{self.value:.1f}%"
        if self.unit == "per_1000":
            return f"{self.value:.2f} per 1,000 reach"
        return f"{self.value:,.0f}"


@dataclass
class AnalyticsReport:
    period_start: date
    period_end: date
    previous_start: date
    previous_end: date
    facts: list[Fact]
    campaigns: list[dict]
    formats: list[dict]
    comparisons: list[dict]
    insufficient: list[str]
    sources: list[str]

    def evidence(self) -> list[dict]:
        return [asdict(f) for f in self.facts]

    def evidence_hash(self) -> str:
        return hashlib.sha256(json.dumps(self.evidence(), sort_keys=True, default=str).encode()).hexdigest()

    def as_dict(self) -> dict:
        return {
            "periodStart": self.period_start.isoformat(), "periodEnd": self.period_end.isoformat(),
            "previousStart": self.previous_start.isoformat(), "previousEnd": self.previous_end.isoformat(),
            "facts": [_camel(asdict(f)) for f in self.facts], "campaigns": self.campaigns, "formats": self.formats,
            "comparisons": self.comparisons, "insufficient": self.insufficient, "sources": self.sources,
            "definitions": DEFINITIONS, "thresholds": {"minItems": MIN_ITEMS, "minLeads": MIN_LEADS, "notableChangePct": NOTABLE_CHANGE_PCT},
            "evidenceHash": self.evidence_hash(),
        }


def _camel(d: dict) -> dict:
    return {"".join(p if i == 0 else p.title() for i, p in enumerate(k.split("_"))): v for k, v in d.items()}


# ------------------------------------------------------------------------------- math helpers
def safe_ratio(numerator: float | None, denominator: float | None, scale: float = 100.0) -> float | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return round(numerator / denominator * scale, 4)


def pct_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous <= 0:
        return None
    return round((current - previous) / previous * 100, 2)


def engagement_totals(rows: list[dict]) -> dict:
    """Σ parts over rows with all parts and reach present (reach > 0); counts missing rows separately."""
    complete = [r for r in rows if all(r.get(p) is not None for p in ENGAGEMENT_PARTS) and r.get("reach") not in (None, 0)]
    engagements = sum(sum(r[p] for p in ENGAGEMENT_PARTS) for r in complete)
    reach = sum(r["reach"] for r in complete)
    return {"n": len(complete), "missing": len(rows) - len(complete), "engagements": engagements if complete else None,
            "reach": reach if complete else None, "rate": safe_ratio(engagements, reach) if complete else None}


def _sum(rows: list[dict], key: str) -> tuple[float | None, int]:
    present = [r[key] for r in rows if r.get(key) is not None]
    return (float(sum(present)) if present else None), len(rows) - len(present)


# --------------------------------------------------------------------------------- inputs
def resolve_period(db: Session, start: date | None, end: date | None, *, max_days: int) -> tuple[date, date]:
    if start is None or end is None:
        ws = current_workspace(db)
        start, end = start or ws.reporting_start, end or ws.reporting_end
    if end < start:
        raise UnprocessableError("The period end must not be before its start.", details={"field": "end"})
    if (end - start).days + 1 > max_days:
        raise UnprocessableError(f"The period may span at most {max_days} days.", details={"field": "start"})
    return start, end


def _content_rows(db: Session, start: date, end: date) -> list[dict]:
    rows = db.scalars(select(ContentItem).where(ContentItem.published_at >= start, ContentItem.published_at <= end))
    return [{"id": c.id, "campaign_id": c.campaign_id, "type": c.type.value, "title": c.title, "views": c.views, "reach": c.reach,
             "likes": c.likes, "comments": c.comments, "shares": c.shares, "saves": c.saves, "is_demo": c.is_demo} for c in rows]


def _attributed_leads(db: Session, start: date, end: date, content_ids: set[str], campaigns: dict[str, Campaign]) -> list[Lead]:
    leads = list(db.scalars(select(Lead)))
    out = []
    for lead in leads:
        if lead.content_id:
            if lead.content_id in content_ids:
                out.append(lead)
        else:
            c = campaigns.get(lead.campaign_id)
            if c and (c.start_date is None or c.start_date <= end) and (c.end_date is None or c.end_date >= start):
                out.append(lead)
    return out


# --------------------------------------------------------------------------------- report
def campaign_report(db: Session, start: date, end: date) -> AnalyticsReport:
    days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    campaigns = {c.id: c for c in db.scalars(select(Campaign))}
    current = _content_rows(db, start, end)
    previous = _content_rows(db, prev_start, prev_end)
    leads = _attributed_leads(db, start, end, {r["id"] for r in current}, campaigns)
    source = "demo_dataset" if any(r["is_demo"] for r in current) or any(lead.is_demo for lead in leads) else "workspace_data"
    facts: list[Fact] = []
    insufficient: list[str] = []
    period = (start.isoformat(), end.isoformat())

    def add(metric: str, label: str, value, unit: str, kind: str, n: int, *, missing: int = 0, scope: dict | None = None,
            sufficient: bool = True, note: str | None = None, period_override: tuple[str, str] | None = None, definition: str | None = None) -> Fact:
        p = period_override or period
        fact = Fact(id=f"E{len(facts) + 1}", metric=metric, label=label, value=None if value is None else round(float(value), 2), unit=unit,
                    kind=kind, definition=definition or DEFINITIONS.get(metric, metric), period_start=p[0], period_end=p[1], sample_size=n,
                    missing=missing, sufficient=sufficient and value is not None, source=source, scope=scope or {"type": "workspace"}, note=note)
        facts.append(fact)
        return fact

    # Workspace totals (measured) and rates (calculated)
    add("posts", "Content items published", len(current), "count", "measured", len(current))
    for key in ("views", "reach"):
        total, missing = _sum(current, key)
        add(key, f"Total {key}", total, "count", "measured", len(current), missing=missing)
    eng = engagement_totals(current)
    add("engagements", "Total engagements", eng["engagements"], "count", "measured", eng["n"], missing=eng["missing"])
    er_ok = eng["n"] >= MIN_ITEMS
    add("engagement_rate", "Engagement rate (by reach)", eng["rate"], "percent", "calculated", eng["n"], missing=eng["missing"], sufficient=er_ok,
        note=None if er_ok else f"Fewer than {MIN_ITEMS} complete items.")
    if not er_ok:
        insufficient.append("engagement_rate")
    n_leads = len(leads)
    converted = sum(1 for lead in leads if lead.status.value == "converted")
    add("leads", "Attributed leads", n_leads, "count", "measured", n_leads)
    conv_ok = n_leads >= MIN_LEADS
    add("conversion_rate", "Lead conversion rate", safe_ratio(converted, n_leads), "percent", "calculated", n_leads, sufficient=conv_ok,
        note=None if conv_ok else f"Only {n_leads} attributed leads (needs ≥ {MIN_LEADS}); not reliable.")
    if not conv_ok:
        insufficient.append("conversion_rate")
    reach_total, _ = _sum(current, "reach")
    add("lead_yield", "Leads per 1,000 reach", safe_ratio(n_leads, reach_total, 1000.0), "per_1000", "calculated", len(current),
        sufficient=len(current) >= MIN_ITEMS)

    # Period-over-period (only when both periods have enough items)
    prev_eng = engagement_totals(previous)
    comparisons: list[dict] = []
    both_ok = eng["n"] >= MIN_ITEMS and prev_eng["n"] >= MIN_ITEMS
    for metric, cur_v, prev_v in (("reach", eng["reach"], prev_eng["reach"]), ("engagement_rate", eng["rate"], prev_eng["rate"])):
        change = pct_change(cur_v, prev_v) if both_ok else None
        fact = add("period_change", f"{metric.replace('_', ' ').capitalize()} vs previous period", change, "percent", "comparison",
                   min(eng["n"], prev_eng["n"]), sufficient=both_ok and change is not None,
                   note=None if both_ok else f"Previous period {prev_start}–{prev_end} has {prev_eng['n']} complete items (needs ≥ {MIN_ITEMS}).",
                   definition=f"{DEFINITIONS['period_change']} Metric: {metric}.")
        comparisons.append({"type": "period", "metric": metric, "current": cur_v, "previous": prev_v, "changePct": change,
                            "sufficient": fact.sufficient, "notable": bool(change is not None and abs(change) >= NOTABLE_CHANGE_PCT), "factId": fact.id})
    if not both_ok:
        insufficient.append("period_comparison")

    # Per campaign
    by_campaign: dict[str, list[dict]] = defaultdict(list)
    for row in current:
        by_campaign[row["campaign_id"] or "unassigned"].append(row)
    leads_by_campaign: dict[str, list[Lead]] = defaultdict(list)
    for lead in leads:
        leads_by_campaign[lead.campaign_id].append(lead)
    campaign_rows = []
    for cid in sorted(set(by_campaign) | set(leads_by_campaign)):
        rows = by_campaign.get(cid, [])
        c = campaigns.get(cid)
        name = c.name if c else "Unassigned content"
        scope = {"type": "campaign", "id": cid, "name": name}
        ce = engagement_totals(rows)
        cl = leads_by_campaign.get(cid, [])
        conv = sum(1 for lead in cl if lead.status.value == "converted")
        reach_c, _ = _sum(rows, "reach")
        er_fact = add("engagement_rate", f"Engagement rate — {name}", ce["rate"], "percent", "calculated", ce["n"], missing=ce["missing"], scope=scope,
                      sufficient=ce["n"] >= MIN_ITEMS, note=None if ce["n"] >= MIN_ITEMS else f"{ce['n']} complete items (needs ≥ {MIN_ITEMS}).")
        lead_fact = add("leads", f"Attributed leads — {name}", len(cl), "count", "measured", len(cl), scope=scope)
        yield_fact = add("lead_yield", f"Leads per 1,000 reach — {name}", safe_ratio(len(cl), reach_c, 1000.0), "per_1000", "calculated", len(rows),
                         scope=scope, sufficient=len(rows) >= MIN_ITEMS)
        campaign_rows.append({
            "campaignId": cid, "name": name, "posts": len(rows), "views": _sum(rows, "views")[0], "reach": reach_c, "engagements": ce["engagements"],
            "engagementRate": ce["rate"], "engagementRateSufficient": er_fact.sufficient, "leads": len(cl), "converted": conv,
            "conversionRate": safe_ratio(conv, len(cl)), "conversionSufficient": len(cl) >= MIN_LEADS, "leadYield": yield_fact.value,
            "factIds": [er_fact.id, lead_fact.id, yield_fact.id],
        })

    # Campaign-to-campaign comparison (comparable = both have ≥ MIN_ITEMS complete items)
    comparable = [r for r in campaign_rows if r["engagementRateSufficient"] and r["campaignId"] != "unassigned"]
    if len(comparable) >= 2:
        best = max(comparable, key=lambda r: r["engagementRate"])
        worst = min(comparable, key=lambda r: r["engagementRate"])
        comparisons.append({"type": "campaign", "metric": "engagement_rate", "best": best["name"], "bestValue": best["engagementRate"],
                            "worst": worst["name"], "worstValue": worst["engagementRate"], "sufficient": True})
    else:
        insufficient.append("campaign_comparison")

    # Content formats (mean of per-item ER would be unweighted; we use reach-weighted ER per format)
    by_type: dict[str, list[dict]] = defaultdict(list)
    for row in current:
        by_type[row["type"]].append(row)
    formats = []
    for ctype, rows in sorted(by_type.items()):
        te = engagement_totals(rows)
        fact = add("engagement_rate", f"Engagement rate — {ctype}s", te["rate"], "percent", "calculated", te["n"], missing=te["missing"],
                   scope={"type": "content_type", "id": ctype, "name": ctype}, sufficient=te["n"] >= MIN_ITEMS,
                   note=None if te["n"] >= MIN_ITEMS else f"{te['n']} {ctype} item(s) (needs ≥ {MIN_ITEMS}).")
        formats.append({"type": ctype, "items": len(rows), "engagementRate": te["rate"], "sufficient": fact.sufficient, "factId": fact.id})
    if len([f for f in formats if f["sufficient"]]) < 2:
        insufficient.append("format_comparison")

    # Live Instagram accounts (follower trend + media totals from stored observations)
    sources = {source}
    for connection in db.scalars(select(InstagramConnection).where(InstagramConnection.status != IgConnectionStatus.disconnected)):
        sources.add("instagram_api")
        _live_facts(db, connection, start, end, add)
    return AnalyticsReport(start, end, prev_start, prev_end, facts, campaign_rows, formats, comparisons, sorted(set(insufficient)), sorted(sources))


def _live_facts(db: Session, connection: InstagramConnection, start: date, end: date, add) -> None:
    lo = datetime.combine(start, time.min, tzinfo=timezone.utc)
    hi = datetime.combine(end, time.max, tzinfo=timezone.utc)
    scope = {"type": "instagram_account", "id": connection.id, "name": f"@{connection.username}"}
    snaps = list(db.scalars(select(InstagramAccountInsight).where(
        InstagramAccountInsight.connection_id == connection.id, InstagramAccountInsight.metric == "followers_count",
        InstagramAccountInsight.metric_type == "snapshot", InstagramAccountInsight.status == "ok",
        InstagramAccountInsight.range_end >= lo, InstagramAccountInsight.range_end <= hi).order_by(InstagramAccountInsight.range_end)))
    first, last = (snaps[0], snaps[-1]) if snaps else (None, None)
    change = (last.value - first.value) if (first and last and len(snaps) >= 2) else None
    fact = add("followers", f"Follower change — @{connection.username}", change, "count", "calculated", len(snaps), scope=scope,
               sufficient=len(snaps) >= 2, note=None if len(snaps) >= 2 else "Needs at least two follower observations in the period.",
               definition=DEFINITIONS["followers"])
    fact.source = "instagram_api"
    media = list(db.scalars(select(InstagramMedia).where(InstagramMedia.connection_id == connection.id, InstagramMedia.posted_at >= lo,
                                                         InstagramMedia.posted_at <= hi, InstagramMedia.removed_at.is_(None))))
    rows = []
    for m in media:
        latest = db.scalars(select(InstagramMediaInsight).where(InstagramMediaInsight.media_id == m.id)
                            .order_by(InstagramMediaInsight.captured_at.desc()).limit(7))
        values = {r.metric: r.value for r in latest}
        rows.append({"reach": values.get("reach"), "views": values.get("views"), "likes": values.get("likes"), "comments": values.get("comments"),
                     "shares": values.get("shares"), "saves": values.get("saved")})
    eng = engagement_totals(rows)
    er = add("engagement_rate", f"Engagement rate — @{connection.username}", eng["rate"], "percent", "calculated", eng["n"], missing=eng["missing"],
             scope=scope, sufficient=eng["n"] >= MIN_ITEMS, note=None if eng["n"] >= MIN_ITEMS else f"{eng['n']} media with complete insights.")
    er.source = "instagram_api"
