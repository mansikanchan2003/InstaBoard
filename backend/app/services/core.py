"""Workspace, accounts, campaigns, content, leads and account-level analytics."""

from __future__ import annotations

import secrets
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ConflictError, NotFoundError, NotImplementedInPhaseError, UnprocessableError
from app.models import (
    AccountDailyMetric,
    AccountKpi,
    AccountReportingPeriod,
    AccountTelemetry,
    AudienceSnapshot,
    Campaign,
    CampaignDetailExtras,
    CampaignLeadChannel,
    CampaignLeadFunnelStage,
    CampaignMetrics,
    ContentAnalytics,
    ContentItem,
    InstagramAccount,
    Lead,
    SyncLog,
    TeamMember,
)
from app.models.enums import AudienceDimension, FunnelStage, MetricPeriod, TrendMetric
from app.schemas import core as s
from app.schemas.base import ev, num
from app.schemas.inputs import CampaignCreateIn, CampaignPatchIn, LeadCreateIn, LeadPatchIn

from .audit import diff_rows, record_user_change
from .common import current_workspace, day_label, get_account, iso_date, iso_ist, next_position_first, reference, session_member

# ===================================================================================== workspace


def workspace_out(db: Session) -> s.WorkspaceOut:
    ws = current_workspace(db)
    return s.WorkspaceOut(
        id=ws.id, name=ws.name, plan=ws.plan, timezone=ws.timezone, currency=ws.currency,
        reporting_period=s.Period(start=ws.reporting_start.isoformat(), end=ws.reporting_end.isoformat(), label=ws.reporting_label),
        baseline_period=s.Period(start=ws.baseline_start.isoformat(), end=ws.baseline_end.isoformat(), label=ws.baseline_label),
        last_synced_label=ws.last_synced_label,
    )


def member_out(m: TeamMember) -> s.TeamMemberOut:
    return s.TeamMemberOut(id=m.id, name=m.name, email=m.email, role=m.role, access=ev(m.access), avatar_url=m.avatar_url,
                           status=ev(m.status), last_active=m.last_active_label)


def list_members(db: Session) -> list[s.TeamMemberOut]:
    ws = current_workspace(db)
    rows = db.scalars(select(TeamMember).where(TeamMember.workspace_id == ws.id).order_by(TeamMember.position, TeamMember.created_at))
    return [member_out(m) for m in rows]


def current_member(db: Session) -> s.TeamMemberOut:
    return member_out(session_member(db))


# ====================================================================================== accounts


def account_out(a: InstagramAccount) -> s.InstagramAccountOut:
    return s.InstagramAccountOut(
        id=a.id, display_name=a.display_name, handle=a.handle, initials=a.initials, avatar_url=a.avatar_url, type=ev(a.type),
        status=ev(a.status), is_primary=a.is_primary, verified=a.verified, external_id=a.external_id,
        connected_since=a.connected_since.isoformat(), last_synced_at=a.last_synced_label, next_sync_label=a.next_sync_label,
        status_note=a.status_note, followers=a.followers, following=a.following, media_count=a.media_count,
        data_availability=a.data_availability, scopes=a.scopes,
    )


def list_accounts(db: Session, status: str | None = None) -> list[s.InstagramAccountOut]:
    query = select(InstagramAccount).order_by(InstagramAccount.position, InstagramAccount.id)
    if status:
        query = query.where(InstagramAccount.status == status)
    return [account_out(a) for a in db.scalars(query)]


def account_telemetry(db: Session, account_id: str) -> dict:
    row = db.get(AccountTelemetry, account_id)
    if row is None:
        raise NotFoundError("Instagram account telemetry", account_id)
    return row.document


def sync_logs(db: Session, account_id: str | None = None, *, limit: int | None = None, offset: int = 0) -> list[s.SyncLogOut]:
    if account_id is not None:
        get_account(db, account_id)
    query = select(SyncLog).order_by(SyncLog.executed_at.desc(), SyncLog.id)
    if account_id:
        query = query.where(SyncLog.account_id == account_id)
    query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return [
        s.SyncLogOut(id=l.id, account_id=l.account_id, executed_at=iso_ist(l.executed_at), executed_label=l.executed_label,
                     trigger=ev(l.trigger), trigger_label=l.trigger_label, duration_sec=num(l.duration_sec), media=l.media,
                     comments=l.comments, status=ev(l.status), status_label=l.status_label, raw=l.raw)
        for l in db.scalars(query)
    ]


def accounts_summary(db: Session) -> dict:
    return reference(db, "accounts_summary")


def connect_reference(db: Session) -> dict:
    return {**reference(db, "connect_reference"), "scopes": reference(db, "meta_scope_catalog")}


def request_sync(db: Session, account_id: str) -> None:
    get_account(db, account_id)
    raise NotImplementedInPhaseError(
        "Instagram sync is not available: this backend has no Meta / Instagram Graph API integration yet. Data shown is demonstration data.",
        details={"accountId": account_id},
    )


def disconnect_account(db: Session, account_id: str) -> None:
    get_account(db, account_id)
    raise NotImplementedInPhaseError(
        "Disconnecting an Instagram account requires the Meta integration (token revocation), which is not part of this phase.",
        details={"accountId": account_id},
    )


def _reporting_period(db: Session, account_id: str) -> AccountReportingPeriod:
    ws = current_workspace(db)
    period = db.get(AccountReportingPeriod, (account_id, ws.reporting_start))
    if period is None:
        raise NotFoundError("Account reporting period", f"{account_id}@{ws.reporting_start.isoformat()}")
    return period


def account_overview(db: Session, account_id: str) -> s.AccountOverviewOut:
    account = get_account(db, account_id)
    period = _reporting_period(db, account_id)
    kpis = {ev(k.metric): k for k in db.scalars(select(AccountKpi).where(AccountKpi.account_id == account_id, AccountKpi.period_start == period.period_start))}
    total_content = db.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.account_id == account_id)) or 0

    def kpi(name: str) -> s.KpiValueOut:
        k = kpis.get(name)
        if k is None:
            raise NotFoundError("Account KPI", name)
        return s.KpiValueOut(value=num(k.value), delta=num(k.delta_pct), baseline=num(k.baseline))

    leads = kpis.get("leads")
    if leads is None or leads.target is None:
        raise NotFoundError("Account KPI", "leads")
    return s.AccountOverviewOut(
        account_id=account.id, followers=account.followers, total_content=total_content,
        views=kpi("views"), reach=kpi("reach"), engagement_rate=kpi("engagementRate"), likes=kpi("likes"), comments=kpi("comments"),
        shares=kpi("shares"), saves=kpi("saves"),
        leads=s.LeadKpiOut(value=num(leads.value), delta=num(leads.delta_pct), baseline=num(leads.baseline), target=num(leads.target)),
        watch_time_hours=kpi("watchTimeHours"), ai_health_score=period.ai_health_score or 0,
    )


def account_trends(db: Session, account_id: str) -> dict[str, list[s.TrendPointOut]]:
    get_account(db, account_id)
    ws = current_workspace(db)
    rows = db.scalars(
        select(AccountDailyMetric)
        .where(AccountDailyMetric.account_id == account_id, AccountDailyMetric.day.between(ws.reporting_start, ws.reporting_end))
        .order_by(AccountDailyMetric.metric, AccountDailyMetric.day)
    )
    out: dict[str, list[s.TrendPointOut]] = {ev(m): [] for m in TrendMetric}
    for r in rows:
        out[ev(r.metric)].append(s.TrendPointOut(date=day_label(r.day), current=num(r.current_value), previous=num(r.previous_value)))
    return out


# ===================================================================================== campaigns


def _metrics_out(m: CampaignMetrics | None) -> s.CampaignMetricsOut | None:
    if m is None:
        return None
    return s.CampaignMetricsOut(views=m.views, reach=m.reach, engagement_rate=num(m.engagement_rate), likes=m.likes, comments=m.comments,
                                shares=m.shares, saves=m.saves, leads=m.leads, conversion_rate=num(m.conversion_rate))


def campaign_out(c: Campaign) -> s.CampaignOut:
    by_period = {m.period: m for m in c.metrics}
    return s.CampaignOut(
        id=c.id, code=c.code, name=c.name, objective=ev(c.objective), focus=c.focus, status=ev(c.status),
        start_date=iso_date(c.start_date), end_date=iso_date(c.end_date), account_id=c.account_id, creatives_count=c.creatives_count,
        creatives_note=c.creatives_note, thumbnail_url=c.thumbnail_url, thumbnail_type=ev(c.thumbnail_type) if c.thumbnail_type else None,
        owner=c.owner, budget_inr=c.budget_inr, lead_goal=c.lead_goal, primary_age_group=c.primary_age_group,
        target_regions=c.target_regions, hashtags=c.hashtags, metrics=_metrics_out(by_period.get(MetricPeriod.current)),
        baseline=_metrics_out(by_period.get(MetricPeriod.baseline)), health=ev(c.health) if c.health else None,
    )


def list_campaigns(db: Session, *, status: str | None = None, objective: str | None = None, account_id: str | None = None, q: str | None = None) -> list[s.CampaignOut]:
    query = select(Campaign).options(selectinload(Campaign.metrics)).order_by(Campaign.position, Campaign.created_at)
    if status:
        query = query.where(Campaign.status == status)
    if objective:
        query = query.where(Campaign.objective == objective)
    if account_id:
        query = query.where(Campaign.account_id == account_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(Campaign.name.ilike(like), Campaign.code.ilike(like)))
    return [campaign_out(c) for c in db.scalars(query)]


def _get_campaign(db: Session, campaign_id: str) -> Campaign:
    campaign = db.get(Campaign, campaign_id, options=[selectinload(Campaign.metrics)])
    if campaign is None:
        raise NotFoundError("Campaign", campaign_id)
    return campaign


def get_campaign(db: Session, campaign_id: str) -> s.CampaignOut:
    return campaign_out(_get_campaign(db, campaign_id))


def campaign_detail(db: Session, campaign_id: str) -> s.CampaignDetailExtrasOut | None:
    _get_campaign(db, campaign_id)
    x = db.get(CampaignDetailExtras, campaign_id)
    if x is None:
        return None
    return s.CampaignDetailExtrasOut(campaign_id=x.campaign_id, progression=x.progression, analysis=x.analysis, comments=x.comments_snapshot,
                                     quick_view_recommendation=x.quick_view_recommendation)


def campaign_funnel(db: Session, campaign_id: str) -> s.LeadFunnelOut | None:
    _get_campaign(db, campaign_id)
    stages = {r.stage: r.count for r in db.scalars(select(CampaignLeadFunnelStage).where(CampaignLeadFunnelStage.campaign_id == campaign_id))}
    if not stages:
        return None
    channels = db.scalars(select(CampaignLeadChannel).where(CampaignLeadChannel.campaign_id == campaign_id).order_by(CampaignLeadChannel.position))
    return s.LeadFunnelOut(
        funnel={ev(stage): stages.get(stage, 0) for stage in FunnelStage},
        channels=[{"label": c.label, "share": num(c.share), "leads": c.leads} for c in channels],
    )


def _next_campaign_code(db: Session) -> str:
    codes = db.scalars(select(Campaign.code)).all()
    numbers = [int("".join(ch for ch in code if ch.isdigit()) or 0) for code in codes]
    return f"#CAM-{max(numbers, default=8800) + 1}"


# Allowed campaign status changes. Statuses are InstaBoard's own planning states — changing them
# never publishes, pauses or edits anything on Instagram.
CAMPAIGN_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"scheduled"}),
    "scheduled": frozenset({"draft", "active", "paused"}),
    "active": frozenset({"paused", "completed"}),
    "paused": frozenset({"active", "completed"}),
    "completed": frozenset(),
}
CAMPAIGN_FIELD_LABELS = {
    "name": "Name", "objective": "Objective", "start_date": "Start date", "end_date": "End date", "account_id": "Instagram account",
    "target_regions": "Target regions", "hashtags": "Hashtags", "budget_inr": "Budget (INR)", "lead_goal": "Lead goal",
    "primary_age_group": "Primary age group", "status": "Status",
}
EDITABLE_CAMPAIGN_FIELDS = tuple(k for k in CAMPAIGN_FIELD_LABELS if k != "status")


def create_campaign(db: Session, body: CampaignCreateIn) -> s.CampaignOut:
    account = get_account(db, body.account_id)
    if ev(account.status) != "connected":
        raise UnprocessableError("Campaigns can only be planned for an account whose status is 'connected'", details={"accountId": account.id})
    campaign = Campaign(
        id=f"cmp-{secrets.token_hex(4)}", code=_next_campaign_code(db), name=body.name.strip(), objective=body.objective,
        focus=body.objective, status=body.status, start_date=date.fromisoformat(body.start_date) if body.start_date else None,
        end_date=date.fromisoformat(body.end_date) if body.end_date else None, account_id=account.id, creatives_count=0,
        creatives_note="Draft — no creatives yet" if body.status == "draft" else "Awaiting creatives", owner=session_member(db).name,
        budget_inr=body.budget_inr, lead_goal=body.lead_goal, primary_age_group=body.primary_age_group,
        target_regions=body.target_regions, hashtags=body.hashtags, health=None, position=next_position_first(db, Campaign.position),
    )
    db.add(campaign)
    db.flush()
    db.refresh(campaign)
    record_user_change(
        db, category="campaigns", kind="Campaign Created", icon="campaign", title="Campaign Created",
        summary=f"Created {campaign.code} \"{campaign.name}\" as {body.status}.", target_label=campaign.code,
        target_to=f"/campaigns/{campaign.id}", module="Campaigns", account_id=campaign.account_id,
        payload={"type": "CAMPAIGN_CREATED", "campaign_id": campaign.id, "status": body.status},
        narrative_suffix="Saved in InstaBoard only — nothing was published to Instagram.",
    )
    return campaign_out(campaign)


def _check_transition(campaign: Campaign, target: str) -> None:
    current = ev(campaign.status)
    if target == current:
        return
    allowed = CAMPAIGN_TRANSITIONS[current]
    if target not in allowed:
        raise ConflictError(
            f"A {current} campaign cannot be moved to {target}.",
            details={"from": current, "to": target, "allowed": sorted(allowed)},
        )
    if target == "scheduled" and not (campaign.start_date and campaign.end_date):
        raise UnprocessableError("Set a start date and end date before scheduling this campaign.", details={"field": "startDate"})


def update_campaign(db: Session, campaign_id: str, body: CampaignPatchIn) -> s.CampaignOut:
    campaign = _get_campaign(db, campaign_id)
    patch = body.model_dump(exclude_unset=True)
    for key in ("name", "objective", "account_id", "target_regions", "hashtags", "status"):
        if key in patch and patch[key] is None:
            raise UnprocessableError(f"{key} cannot be null", details={"field": key})
    for key in ("start_date", "end_date"):
        if key in patch:
            patch[key] = date.fromisoformat(patch[key]) if patch[key] else None
    if "account_id" in patch and patch["account_id"] != campaign.account_id:
        get_account(db, patch["account_id"])
        if ev(campaign.status) not in ("draft", "scheduled"):
            raise ConflictError("The Instagram account can only be changed before a campaign starts.", details={"status": ev(campaign.status)})

    before = {k: getattr(campaign, k) for k in patch}
    # Only explicitly editable fields are assigned (no mass assignment).
    for key in EDITABLE_CAMPAIGN_FIELDS:
        if key in patch:
            setattr(campaign, key, patch[key])
    if campaign.start_date and campaign.end_date and campaign.end_date < campaign.start_date:
        raise UnprocessableError("endDate must be on or after startDate", details={"field": "endDate"})
    if "status" in patch:
        _check_transition(campaign, patch["status"])
        campaign.status = patch["status"]
    db.flush()

    changes = diff_rows(before, patch, CAMPAIGN_FIELD_LABELS)
    if changes:
        status_only = list(patch) == ["status"]
        title = f"Campaign {STATUS_VERBS.get(patch['status'], 'Updated')}" if status_only else "Campaign Updated"
        record_user_change(
            db, category="campaigns", kind="Status Change" if status_only else "Campaign Edit", icon="campaign", title=title,
            summary=f"{campaign.code} \"{campaign.name}\": " + "; ".join(f"{c['field']} {c['before']} → {c['after']}" for c in changes[:3]) + ".",
            target_label=campaign.code, target_to=f"/campaigns/{campaign.id}", module="Campaigns", account_id=campaign.account_id,
            payload={"type": "CAMPAIGN_UPDATED", "campaign_id": campaign.id, "fields": sorted(patch)}, diff=changes,
            narrative_suffix="Changed in InstaBoard only — nothing was changed on Instagram.",
        )
    return campaign_out(campaign)


STATUS_VERBS = {"paused": "Paused", "active": "Resumed", "scheduled": "Scheduled", "draft": "Moved to Draft", "completed": "Completed"}


# ======================================================================================= content


def content_out(c: ContentItem) -> s.ContentItemOut:
    return s.ContentItemOut(
        id=c.id, title=c.title, caption=c.caption, type=ev(c.type), campaign_id=c.campaign_id, account_id=c.account_id,
        published_at=c.published_at.isoformat(), duration_sec=c.duration_sec, slides=c.slides, thumbnail_url=c.thumbnail_url,
        thumbnail_alt=c.thumbnail_alt, is_top_performer=c.is_top_performer,
        metrics=s.ContentMetricsOut(views=c.views, reach=c.reach, likes=c.likes, comments=c.comments, shares=c.shares, saves=c.saves,
                                    engagement_rate=num(c.engagement_rate), leads=c.leads, retention=num(c.retention)),
    )


def list_content(db: Session, *, campaign_id: str | None = None, type_: str | None = None, q: str | None = None) -> list[s.ContentItemOut]:
    query = select(ContentItem).order_by(ContentItem.position, ContentItem.id)
    if campaign_id is not None:
        query = query.where(ContentItem.campaign_id == campaign_id)
    if type_:
        query = query.where(ContentItem.type == type_)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(ContentItem.title.ilike(like), ContentItem.caption.ilike(like)))
    return [content_out(c) for c in db.scalars(query)]


def list_campaign_content(db: Session, campaign_id: str) -> list[s.ContentItemOut]:
    _get_campaign(db, campaign_id)
    return list_content(db, campaign_id=campaign_id)


def get_content(db: Session, content_id: str) -> s.ContentItemOut:
    item = db.get(ContentItem, content_id)
    if item is None:
        raise NotFoundError("Content", content_id)
    return content_out(item)


def content_analytics(db: Session, content_id: str) -> dict | None:
    if db.get(ContentItem, content_id) is None:
        raise NotFoundError("Content", content_id)
    row = db.get(ContentAnalytics, content_id)
    return row.document if row else None


# ========================================================================================= leads


def lead_out(l: Lead) -> s.LeadOut:
    return s.LeadOut(id=l.id, name=l.name, handle=l.handle, location=l.location, campaign_id=l.campaign_id, content_id=l.content_id,
                     score=l.score, status=ev(l.status), source=ev(l.source), last_contact=l.last_contact_label,
                     first_message=l.first_message, phone_masked=l.phone_masked, notes=l.notes, source_comment_id=l.source_comment_id)


def list_leads(db: Session, *, status: str | None = None, campaign_id: str | None = None, q: str | None = None) -> list[s.LeadOut]:
    query = select(Lead).order_by(Lead.position, Lead.created_at)
    if status:
        query = query.where(Lead.status == status)
    if campaign_id:
        query = query.where(Lead.campaign_id == campaign_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(Lead.name.ilike(like), Lead.handle.ilike(like), Lead.location.ilike(like)))
    return [lead_out(l) for l in db.scalars(query)]


def list_campaign_leads(db: Session, campaign_id: str) -> list[s.LeadOut]:
    _get_campaign(db, campaign_id)
    return list_leads(db, campaign_id=campaign_id)


def lead_summary(db: Session) -> s.LeadPipelineSummaryOut:
    account_id = _primary_account_id(db)
    period = _reporting_period(db, account_id)
    leads_kpi = db.get(AccountKpi, (account_id, period.period_start, "leads"))
    if leads_kpi is None:
        raise NotFoundError("Account KPI", "leads")
    return s.LeadPipelineSummaryOut(
        total_comment_inquiries=period.total_comment_inquiries, ai_filtered_potential=period.ai_filtered_potential,
        ai_intent_rate=num(period.ai_intent_rate), qualified_leads=int(leads_kpi.value), qualified_leads_delta=num(leads_kpi.delta_pct) or 0,
        converted_operators=period.converted_operators, close_rate=num(period.close_rate),
    )


LEAD_FIELD_LABELS = {"status": "Pipeline status", "notes": "Outreach notes", "name": "Name", "location": "Location", "phone_masked": "Phone"}


def _get_lead(db: Session, lead_id: str) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise NotFoundError("Lead", lead_id)
    return lead


def update_lead(db: Session, lead_id: str, body: LeadPatchIn) -> s.LeadOut:
    lead = _get_lead(db, lead_id)
    patch = body.model_dump(exclude_unset=True)
    if "notes" in patch and patch["notes"] is not None:
        patch["notes"] = patch["notes"].strip() or None
    before = {k: getattr(lead, k) for k in patch}
    for key in LEAD_FIELD_LABELS:  # explicit allow-list
        if key in patch:
            setattr(lead, key, patch[key])
    changes = diff_rows(before, patch, LEAD_FIELD_LABELS)
    if "status" in patch and patch["status"] != ev(before["status"]):
        lead.last_contact_label = "Just now"
    db.flush()
    if changes:
        # Notes are free text; the audit row records that they changed, not their content.
        audit_diff = [c if c["field"] != "Outreach notes" else {"field": c["field"], "before": "…", "after": "updated"} for c in changes]
        record_user_change(
            db, category="leads", kind="Lead Update", icon="contact_page",
            title="Lead Status Changed" if list(patch) == ["status"] else "Lead Updated",
            summary=f"{lead.name} (@{lead.handle}): " + "; ".join(f"{c['field']} {c['before']} → {c['after']}" for c in audit_diff[:3]) + ".",
            target_label=f"@{lead.handle}", target_to=f"/leads?lead={lead.id}", module="Leads",
            payload={"type": "LEAD_UPDATED", "lead_id": lead.id, "fields": sorted(patch)}, diff=audit_diff,
            narrative_suffix="Stored in InstaBoard only — no message was sent to the lead.",
        )
    return lead_out(lead)


def find_lead_by_handle(db: Session, handle: str) -> Lead | None:
    return db.scalar(select(Lead).where(func.lower(Lead.handle) == handle.lower()))


def validate_lead_refs(db: Session, campaign_id: str, content_id: str | None) -> None:
    _get_campaign(db, campaign_id)
    if content_id:
        content = db.get(ContentItem, content_id)
        if content is None:
            raise NotFoundError("Content", content_id)
        if content.campaign_id and content.campaign_id != campaign_id:
            raise UnprocessableError(
                "contentId belongs to a different campaign than campaignId",
                details={"contentId": content_id, "contentCampaignId": content.campaign_id, "campaignId": campaign_id},
            )


def new_lead(db: Session, *, source_comment_id: str | None = None, **fields) -> Lead:
    lead = Lead(id=f"lead-{secrets.token_hex(4)}", status="new", last_contact_label="Just now",
                position=next_position_first(db, Lead.position), source_comment_id=source_comment_id, **fields)
    db.add(lead)
    db.flush()
    return lead


def create_lead(db: Session, body: LeadCreateIn) -> s.LeadCreateResultOut:
    """Creates a lead, or returns the existing lead for the same handle (``created=False``)."""
    existing = find_lead_by_handle(db, body.handle)
    if existing is not None:
        return s.LeadCreateResultOut(lead=lead_out(existing), created=False)
    validate_lead_refs(db, body.campaign_id, body.content_id)
    lead = new_lead(
        db, campaign_id=body.campaign_id, content_id=body.content_id, name=body.name, handle=body.handle, location=body.location,
        score=body.score, source=body.source, first_message=body.first_message, phone_masked=body.phone_masked, notes=body.notes,
    )
    record_user_change(
        db, category="leads", kind="Lead Created", icon="person_add", title="Lead Created",
        summary=f"Added {lead.name} (@{lead.handle}) to the pipeline as New (source: {body.source}).",
        target_label=f"@{lead.handle}", target_to=f"/leads?lead={lead.id}", module="Leads",
        payload={"type": "LEAD_CREATED", "lead_id": lead.id, "campaign_id": lead.campaign_id, "content_id": lead.content_id},
    )
    return s.LeadCreateResultOut(lead=lead_out(lead), created=True)


# ====================================================================================== audience


def _primary_account_id(db: Session) -> str:
    ws = current_workspace(db)
    account_id = db.scalar(select(InstagramAccount.id).where(InstagramAccount.workspace_id == ws.id, InstagramAccount.is_primary.is_(True)))
    if account_id is None:
        raise NotFoundError("Instagram account", "primary")
    return account_id


def _audience_snapshot(db: Session) -> AudienceSnapshot:
    account_id = _primary_account_id(db)
    ws = current_workspace(db)
    snap = db.get(AudienceSnapshot, (account_id, ws.reporting_start), options=[selectinload(AudienceSnapshot.breakdowns)])
    if snap is None:
        raise NotFoundError("Audience snapshot", account_id)
    return snap


def audience_summary(db: Session) -> s.AudienceSummaryOut:
    snap = _audience_snapshot(db)
    account = get_account(db, snap.account_id)
    age = [b for b in snap.breakdowns if b.dimension == AudienceDimension.age]
    states = [b for b in snap.breakdowns if b.dimension == AudienceDimension.state]
    return s.AudienceSummaryOut(
        followers=account.followers, follower_growth_pct=num(snap.follower_growth_pct), net_new_followers=snap.net_new_followers,
        non_follower_reach_pct=num(snap.non_follower_reach_pct), engaged_audience=snap.engaged_audience,
        gender=s.GenderOut(male=snap.gender_male, female=snap.gender_female, unknown=snap.gender_unknown),
        age=[s.AgeShareOut(label=b.label, share=num(b.share), audience=b.audience or 0, delta_pct=num(b.delta_pct) or 0, note=b.note) for b in age],
        topStates=[s.StateShareOut(label=b.label, share=num(b.share), reach=b.reach or 0, engaged=b.engaged or 0, leads=b.leads or 0) for b in states],
    )


def audience_intelligence(db: Session) -> dict:
    snap = _audience_snapshot(db)
    if snap.intelligence is None:
        raise NotFoundError("Audience intelligence", snap.account_id)
    return snap.intelligence
