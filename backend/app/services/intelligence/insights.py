"""Evidence-grounded insight generation.

1. ``analytics.campaign_report`` computes the facts (deterministic; no AI).
2. Cache: key = sha256(evidence hash · period · prompt version · provider/model). A cache hit (within
   ``AI_INSIGHT_CACHE_HOURS``) answers without a model call; changed evidence → new key → fresh analysis.
3. The model receives only aggregate facts (no names, handles, comment text or contact data) and must cite fact ids.
4. Each draft is verified: cited ids exist, and every number in its text matches a cited fact (± rounding). Drafts
   that fail are discarded and counted — they are never shown.
5. Evidence quality (stored in ``confidence``) is computed from the cited facts, not taken from the model:
   high = all cited facts sufficient, sample ≥ 10 and ≤ 10 % missing (80); medium = all sufficient (60);
   low = any cited fact insufficient (35, priority forced to low). It describes the data, not a probability.
6. Dedup: fingerprint = category + cited metrics/scopes + period. An existing insight with the same fingerprint is
   refreshed instead of duplicated; a dismissed one is not resurrected until it expires.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import INSIGHTS_PROMPT_VERSION, INSIGHTS_SYSTEM, data_block
from app.ai.safety import unverified_numbers
from app.ai.schemas import InsightBatch, InsightDraft
from app.ai.service import AIGateway
from app.core.config import Settings
from app.models import AIAnalysisCache, Insight
from app.models.enums import InsightStatus
from app.services.common import utcnow

from .analytics import AnalyticsReport, Fact, campaign_report

QUALITY_SCORE = {"high": 80, "medium": 60, "low": 35}


def evidence_quality(facts: list[Fact]) -> str:
    if any(not f.sufficient for f in facts):
        return "low"
    if all(f.sample_size >= 10 and (f.missing / max(f.sample_size + f.missing, 1)) <= 0.10 for f in facts):
        return "high"
    return "medium"


def fingerprint(category: str, facts: list[Fact], period: tuple[date, date]) -> str:
    keys = sorted({f"{f.metric}:{f.scope.get('type')}:{f.scope.get('id', '')}" for f in facts})
    return hashlib.sha256("|".join([category, *keys, period[0].isoformat(), period[1].isoformat()]).encode()).hexdigest()


def cache_key(report: AnalyticsReport, model_key: str) -> str:
    raw = "|".join([report.evidence_hash(), report.period_start.isoformat(), report.period_end.isoformat(), INSIGHTS_PROMPT_VERSION, model_key])
    return hashlib.sha256(raw.encode()).hexdigest()


def _evidence_payload(report: AnalyticsReport) -> list[dict]:
    """Only aggregates go to the model: ids, labels, values, definitions, periods, sample sizes, provenance."""
    return [{"id": f.id, "label": f.label, "value": f.value, "display": f.display(), "unit": f.unit, "kind": f.kind, "definition": f.definition,
             "period": f"{f.period_start}..{f.period_end}", "sample_size": f.sample_size, "missing": f.missing, "sufficient": f.sufficient,
             "note": f.note, "source": f.source, "scope": f.scope.get("name") or f.scope.get("type")} for f in report.facts]


def verify_draft(draft: InsightDraft, facts_by_id: dict[str, Fact]) -> tuple[list[Fact] | None, str | None]:
    cited = [facts_by_id[i] for i in dict.fromkeys(draft.evidence_ids) if i in facts_by_id]
    if not cited or len(cited) != len(set(draft.evidence_ids)):
        return None, "unknown_evidence"
    allowed: list[float] = []
    for f in cited:
        if f.value is not None:
            allowed.append(float(f.value))
        allowed.append(float(f.sample_size))
    bad = unverified_numbers([draft.title, draft.summary, draft.observation, draft.explanation, draft.recommended_action], allowed)
    if bad:
        return None, "unverified_numbers"
    return cited, None


def generate_insights(db: Session, settings: Settings, gateway: AIGateway, *, workspace_id: str, start: date, end: date,
                      job_id: str | None, progress=lambda stage, pct: None) -> dict:
    progress("analytics", 10)
    report = campaign_report(db, start, end)
    key = cache_key(report, gateway.model_key)
    now = utcnow()
    cached = db.scalar(select(AIAnalysisCache).where(AIAnalysisCache.cache_key == key, AIAnalysisCache.expires_at > now))
    if cached is not None:
        return {**cached.outcome, "cached": True, "insightIds": cached.insight_ids}
    # The model is only consulted when at least one calculated rate or comparison is supported by enough data.
    if not any(f.sufficient and f.kind in ("calculated", "comparison") for f in report.facts):
        outcome = {"generated": 0, "refreshed": 0, "rejected": 0, "insufficientData": True,
                   "note": "Not enough data in this period for evidence-based insights.", "evidenceHash": report.evidence_hash()}
        _store_cache(db, workspace_id, key, report, gateway.model_key, [], outcome, settings)
        return {**outcome, "cached": False, "insightIds": []}

    progress("model", 30)
    gen = gateway.generate(
        task="insights", prompt_version=INSIGHTS_PROMPT_VERSION, schema=InsightBatch, job_id=job_id,
        system=INSIGHTS_SYSTEM.format(max_insights=settings.ai_max_insights_per_run),
        user=f"Period analysed: {start}..{end} (previous period for comparisons: {report.previous_start}..{report.previous_end}).\n"
             f"Data sources: {', '.join(report.sources)}.\n" + data_block("EVIDENCE", _evidence_payload(report)),
    )
    batch: InsightBatch = gen.output  # type: ignore[assignment]
    progress("verify", 75)
    facts_by_id = {f.id: f for f in report.facts}
    generated = refreshed = 0
    rejected: dict[str, int] = {}
    ids: list[str] = []
    for draft in batch.insights[: settings.ai_max_insights_per_run]:
        cited, reason = verify_draft(draft, facts_by_id)
        if cited is None:
            rejected[reason or "invalid"] = rejected.get(reason or "invalid", 0) + 1
            continue
        insight, created = _upsert(db, settings, draft, cited, report, gen, key, job_id, workspace_id)
        if insight is None:
            continue
        ids.append(insight.id)
        generated += int(created)
        refreshed += int(not created)
    outcome = {"generated": generated, "refreshed": refreshed, "rejected": sum(rejected.values()), "rejectedReasons": rejected,
               "insufficientData": False, "note": batch.insufficient_data_note, "evidenceHash": report.evidence_hash(),
               "provider": gen.provider, "model": gen.model}
    _store_cache(db, workspace_id, key, report, gateway.model_key, ids, outcome, settings)
    return {**outcome, "cached": False, "insightIds": ids}


def _store_cache(db: Session, workspace_id: str, key: str, report: AnalyticsReport, model_key: str, ids: list[str], outcome: dict, settings: Settings) -> None:
    from sqlalchemy.dialects.postgresql import insert

    now = utcnow()
    values = {"evidence_hash": report.evidence_hash(), "insight_ids": ids, "outcome": outcome, "created_at": now,
              "expires_at": now + timedelta(hours=settings.ai_insight_cache_hours)}
    db.execute(insert(AIAnalysisCache).values(
        workspace_id=workspace_id, cache_key=key, period_start=_dt(report.period_start), period_end=_dt(report.period_end),
        prompt_version=INSIGHTS_PROMPT_VERSION, model_key=model_key, **values,
    ).on_conflict_do_update(index_elements=["workspace_id", "cache_key"], set_=values))


def _dt(d: date):
    from datetime import datetime, time, timezone

    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _upsert(db: Session, settings: Settings, draft: InsightDraft, cited: list[Fact], report: AnalyticsReport, gen, key: str,
            job_id: str | None, workspace_id: str) -> tuple[Insight | None, bool]:
    now = utcnow()
    quality = evidence_quality(cited)
    priority = "low" if quality == "low" else draft.priority
    fp = fingerprint(draft.category, cited, (report.period_start, report.period_end))
    existing = db.scalar(select(Insight).where(Insight.fingerprint == fp))
    if existing is not None and existing.status == InsightStatus.dismissed and existing.expires_at and existing.expires_at > now:
        return None, False  # the user dismissed this finding; don't bring it back while it is still current
    campaign = next((f.scope for f in cited if f.scope.get("type") == "campaign" and f.scope.get("id") not in (None, "unassigned")), None)
    link = {"label": f"Open {campaign['name']}", "to": f"/campaigns/{campaign['id']}"} if campaign else {"label": "View campaigns", "to": "/campaigns"}
    evidence = [{"id": f.id, "label": f.label, "value": f.value, "display": f.display(), "unit": f.unit, "kind": f.kind, "definition": f.definition,
                 "periodStart": f.period_start, "periodEnd": f.period_end, "sampleSize": f.sample_size, "missing": f.missing,
                 "sufficient": f.sufficient, "source": f.source, "scope": f.scope, "note": f.note} for f in cited]
    ai = {
        "generated": True, "provider": gen.provider, "model": gen.model, "promptVersion": INSIGHTS_PROMPT_VERSION, "evidenceQuality": quality,
        "evidence": evidence, "summary": draft.summary, "explanation": draft.explanation, "recommendedAction": draft.recommended_action,
        "period": {"start": report.period_start.isoformat(), "end": report.period_end.isoformat()}, "sources": sorted({f.source for f in cited}),
        "evidenceHash": report.evidence_hash(), "cacheKey": key, "jobId": job_id, "generatedAt": now.isoformat(),
        "expiresAt": (now + timedelta(days=settings.ai_insight_ttl_days)).isoformat(),
    }
    created = existing is None
    insight = existing or Insight(id=f"ai-{secrets.token_hex(6)}", workspace_id=workspace_id, origin="ai", fingerprint=fp,
                                  status=InsightStatus.new, completed_step_ids=[], position=-1, is_demo=False)
    insight.category = draft.category
    insight.priority = priority
    insight.confidence = QUALITY_SCORE[quality]
    insight.title = draft.title
    insight.observed = draft.observation
    insight.interpretation = draft.explanation
    insight.impact = {"summary": draft.summary, "evidenceQuality": quality}
    insight.primary_link = link
    insight.generated_label = f"AI · {now:%b %d, %Y}"
    insight.generated_at = now
    insight.expires_at = now + timedelta(days=settings.ai_insight_ttl_days)
    insight.detail = None
    insight.ai_meta = ai
    if created:
        db.add(insight)
    db.flush()
    return insight, created
