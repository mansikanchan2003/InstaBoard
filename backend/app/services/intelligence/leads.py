"""Lead intelligence: deterministic follow-up priorities and optional AI summaries for human review.

Deterministic (always available, no AI):
* **Waiting for contact** — leads with status ``new`` recorded more than ``WAITING_DAYS`` days ago (from
  ``leads.created_at``; the demo dataset's rows carry their import time, which the response states).
* **Interest by campaign / content** — attributed lead counts and current status distribution. This is the
  *current* status of each lead, not a historical funnel (status history is not recorded), so no stage-to-stage
  drop-off rates are claimed.

AI (optional): a short summary, follow-up reason and suggested next action from the lead's status, campaign, source,
days since recorded and first message. Name, handle, phone, location and notes are never sent. No conversion
probability is produced (there is no validated model or training data for one). Nothing is sent to the lead.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from collections import Counter, defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import LEADS_PROMPT_VERSION, LEADS_SYSTEM, data_block
from app.ai.safety import injection_suspected, sanitize_untrusted
from app.ai.schemas import LeadSummary
from app.ai.service import AIGateway
from app.core.errors import NotFoundError
from app.models import Campaign, ContentItem, Lead, LeadAISummary
from app.services.common import utcnow

WAITING_DAYS = 2


def priorities(db: Session) -> dict:
    now = utcnow()
    leads = list(db.scalars(select(Lead)))
    campaigns = {c.id: c.name for c in db.scalars(select(Campaign))}
    contents = {c.id: c.title for c in db.scalars(select(ContentItem))}
    waiting = []
    for lead in leads:
        if lead.status.value == "new":
            days = (now - lead.created_at).days
            if days >= WAITING_DAYS:
                waiting.append({"leadId": lead.id, "name": lead.name, "campaign": campaigns.get(lead.campaign_id), "daysWaiting": days,
                                "recordedAt": lead.created_at.isoformat()})
    waiting.sort(key=lambda w: -w["daysWaiting"])
    by_campaign: dict[str, Counter] = defaultdict(Counter)
    by_content: Counter = Counter()
    for lead in leads:
        by_campaign[lead.campaign_id][lead.status.value] += 1
        if lead.content_id:
            by_content[lead.content_id] += 1
    return {
        "generatedAt": now.isoformat(),
        "definition": f"Waiting for contact = status 'new' and recorded at least {WAITING_DAYS} days ago (leads.created_at).",
        "dataNote": "Demo-dataset leads carry the time they were imported as their recorded time." if any(lead.is_demo for lead in leads) else None,
        "waitingForContact": waiting,
        "newLeadsTotal": sum(1 for lead in leads if lead.status.value == "new"),
        "byCampaign": [{"campaignId": cid, "campaign": campaigns.get(cid, cid), "total": sum(c.values()), "statuses": dict(c)}
                       for cid, c in sorted(by_campaign.items(), key=lambda kv: -sum(kv[1].values()))],
        "byContent": [{"contentId": cid, "title": contents.get(cid, cid), "leads": n} for cid, n in by_content.most_common(10)],
        "statusNote": "Counts are each lead's current status, not a historical funnel; stage drop-off rates are not computed.",
    }


def _context(db: Session, lead: Lead) -> dict:
    campaign = db.get(Campaign, lead.campaign_id)
    return {"status": lead.status.value, "campaign": campaign.name if campaign else None, "source": lead.source.value,
            "days_since_recorded": max((utcnow() - lead.created_at).days, 0), "first_message": sanitize_untrusted(lead.first_message, max_chars=800)}


def latest_summary(db: Session, lead_id: str) -> LeadAISummary | None:
    if db.get(Lead, lead_id) is None:
        raise NotFoundError("Lead", lead_id)
    return db.scalar(select(LeadAISummary).where(LeadAISummary.lead_id == lead_id).order_by(LeadAISummary.created_at.desc()).limit(1))


def summarize(db: Session, gateway: AIGateway, *, lead_id: str, job_id: str | None) -> dict:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise NotFoundError("Lead", lead_id)
    context = _context(db, lead)
    version = f"{LEADS_PROMPT_VERSION}|{gateway.model_key}"
    input_hash = hashlib.sha256(json.dumps(context, sort_keys=True).encode()).hexdigest()
    existing = db.scalar(select(LeadAISummary).where(LeadAISummary.lead_id == lead_id, LeadAISummary.input_hash == input_hash,
                                                     LeadAISummary.version == version))
    if existing is not None:
        return {"leadId": lead_id, "summaryId": existing.id, "cached": True}
    gen = gateway.generate(task="lead_summary", prompt_version=LEADS_PROMPT_VERSION, schema=LeadSummary, job_id=job_id, system=LEADS_SYSTEM,
                           user=data_block("LEAD_CONTEXT", context), max_output_tokens=600)
    out: LeadSummary = gen.output  # type: ignore[assignment]
    row = LeadAISummary(id=f"lsum_{secrets.token_hex(8)}", workspace_id=gateway.workspace_id, lead_id=lead_id, input_hash=input_hash, version=version,
                        summary=out.summary, follow_up_reason=out.follow_up_reason, suggested_next_action=out.suggested_next_action,
                        uncertainty="high" if injection_suspected(lead.first_message) else out.uncertainty,
                        injection_suspected=injection_suspected(lead.first_message), job_id=job_id)
    db.add(row)
    db.flush()
    return {"leadId": lead_id, "summaryId": row.id, "cached": False}
