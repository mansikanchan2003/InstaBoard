"""Workspace, accounts, campaigns, content, leads, audience and dashboard routes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import DB, commit, require
from app.schemas import core as s
from app.schemas.base import JsonDoc
from app.schemas.inputs import CampaignCreateIn, CampaignPatchIn, LeadCreateIn, LeadPatchIn
from app.services import core as svc
from app.services import engagement as eng

def IdPath():  # noqa: N802 - a fresh Path() per parameter (FastAPI binds a FieldInfo to one parameter)
    return Path(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.\-]+$")

CampaignStatus = Literal["active", "paused", "completed", "scheduled", "draft"]
Objective = Literal["Lead Generation", "Awareness", "Engagement"]
LeadStatus = Literal["new", "contacted", "qualified", "converted", "lost"]
ContentType = Literal["reel", "post", "carousel", "story"]
AccountStatus = Literal["connected", "action_required", "expired", "syncing"]
def Search():  # noqa: N802
    return Query(default=None, min_length=1, max_length=100, description="Case-insensitive text search")

workspace = APIRouter(tags=["workspace"])
accounts = APIRouter(prefix="/accounts", tags=["instagram accounts"])
campaigns = APIRouter(prefix="/campaigns", tags=["campaigns"])
content = APIRouter(prefix="/content", tags=["content"])
leads = APIRouter(prefix="/leads", tags=["leads"])
audience = APIRouter(prefix="/audience", tags=["audience"])
dashboard = APIRouter(prefix="/dashboard", tags=["dashboard"])
meta = APIRouter(prefix="/meta", tags=["instagram accounts"])


# --- workspace ------------------------------------------------------------------------------
@workspace.get("/workspace", response_model=s.WorkspaceOut, summary="Current workspace (demo session)")
def get_workspace(db: DB):
    return svc.workspace_out(db)


@workspace.get("/workspace/members", response_model=list[s.TeamMemberOut])
def list_members(db: DB):
    return svc.list_members(db)


@workspace.get("/me", response_model=s.TeamMemberOut, summary="Demo session user (no authentication in this phase)")
def me(db: DB):
    return svc.current_member(db)


# --- accounts (static paths before /{account_id}) ----------------------------------------------
@accounts.get("", response_model=list[s.InstagramAccountOut], summary="Instagram accounts (demo records; nothing is connected)")
def list_accounts(db: DB, status_: AccountStatus | None = Query(default=None, alias="status")):
    return svc.list_accounts(db, status_)


@accounts.get("/summary", response_model=JsonDoc)
def accounts_summary(db: DB):
    return svc.accounts_summary(db)


@accounts.get("/sync-logs", response_model=list[s.SyncLogOut], summary="Sync audit log for all accounts (newest first)")
def all_sync_logs(db: DB, limit: int | None = Query(default=None, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    return svc.sync_logs(db, None, limit=limit, offset=offset)


@accounts.get("/connect/reference", response_model=JsonDoc, summary="Connect-flow reference copy (no OAuth is performed)")
def connect_reference(db: DB):
    return svc.connect_reference(db)


@accounts.get("/{account_id}", response_model=s.InstagramAccountOut)
def get_account(db: DB, account_id: str = IdPath()):
    return svc.account_out(svc.get_account(db, account_id))


@accounts.get("/{account_id}/overview", response_model=s.AccountOverviewOut, summary="Account KPIs for the reporting period")
def account_overview(db: DB, account_id: str = IdPath()):
    return svc.account_overview(db, account_id)


@accounts.get("/{account_id}/trends", response_model=dict[str, list[s.TrendPointOut]], summary="Daily trends, current vs baseline")
def account_trends(db: DB, account_id: str = IdPath()):
    return svc.account_trends(db, account_id)


@accounts.get("/{account_id}/telemetry", response_model=JsonDoc)
def account_telemetry(db: DB, account_id: str = IdPath()):
    return svc.account_telemetry(db, account_id)


@accounts.get("/{account_id}/sync-logs", response_model=list[s.SyncLogOut])
def account_sync_logs(db: DB, account_id: str = IdPath(), limit: int | None = Query(default=None, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    return svc.sync_logs(db, account_id, limit=limit, offset=offset)


@accounts.post("/{account_id}/sync", status_code=status.HTTP_501_NOT_IMPLEMENTED, summary="Not available: no Meta integration in this phase")
def request_sync(db: DB, account_id: str = IdPath(), _perm=require("accounts:manage")):
    svc.request_sync(db, account_id)


@accounts.delete("/{account_id}", status_code=status.HTTP_501_NOT_IMPLEMENTED, summary="Not available: needs Meta token revocation")
def disconnect_account(db: DB, account_id: str = IdPath(), _perm=require("accounts:manage")):
    svc.disconnect_account(db, account_id)


@meta.get("/scopes", response_model=list[JsonDoc], summary="Instagram Graph API scope descriptions (reference copy)")
def scope_catalog(db: DB):
    from app.services.common import reference

    return reference(db, "meta_scope_catalog")


# --- campaigns -------------------------------------------------------------------------------
@campaigns.get("", response_model=list[s.CampaignOut])
def list_campaigns(db: DB, status_: CampaignStatus | None = Query(default=None, alias="status"), objective: Objective | None = None,
                   account_id: str | None = Query(default=None, alias="accountId", max_length=80), q: str | None = Search()):
    return svc.list_campaigns(db, status=status_, objective=objective, account_id=account_id, q=q)


@campaigns.post("", response_model=s.CampaignOut, status_code=status.HTTP_201_CREATED,
                summary="Save a draft / scheduled campaign in InstaBoard (nothing is published to Instagram)")
def create_campaign(db: DB, body: CampaignCreateIn, _perm=require("write")):
    return commit(db, svc.create_campaign(db, body))


@campaigns.get("/{campaign_id}", response_model=s.CampaignOut)
def get_campaign(db: DB, campaign_id: str = IdPath()):
    return svc.get_campaign(db, campaign_id)


@campaigns.patch("/{campaign_id}", response_model=s.CampaignOut, summary="Edit fields and/or status (InstaBoard only)")
def update_campaign(db: DB, body: CampaignPatchIn, campaign_id: str = IdPath(), _perm=require("write")):
    return commit(db, svc.update_campaign(db, campaign_id, body))


@campaigns.get("/{campaign_id}/detail", response_model=s.CampaignDetailExtrasOut | None, summary="Detail extras, or null when none exist")
def campaign_detail(db: DB, campaign_id: str = IdPath()):
    return svc.campaign_detail(db, campaign_id)


@campaigns.get("/{campaign_id}/content", response_model=list[s.ContentItemOut])
def campaign_content(db: DB, campaign_id: str = IdPath()):
    return svc.list_campaign_content(db, campaign_id)


@campaigns.get("/{campaign_id}/leads", response_model=list[s.LeadOut])
def campaign_leads(db: DB, campaign_id: str = IdPath()):
    return svc.list_campaign_leads(db, campaign_id)


@campaigns.get("/{campaign_id}/leads/funnel", response_model=s.LeadFunnelOut | None, summary="Lead funnel, or null when not recorded")
def campaign_funnel(db: DB, campaign_id: str = IdPath()):
    return svc.campaign_funnel(db, campaign_id)


# --- content ---------------------------------------------------------------------------------
@content.get("", response_model=list[s.ContentItemOut])
def list_content(db: DB, campaign_id: str | None = Query(default=None, alias="campaignId", max_length=80),
                 type_: ContentType | None = Query(default=None, alias="type"), q: str | None = Search()):
    return svc.list_content(db, campaign_id=campaign_id, type_=type_, q=q)


@content.get("/{content_id}", response_model=s.ContentItemOut)
def get_content(db: DB, content_id: str = IdPath()):
    return svc.get_content(db, content_id)


@content.get("/{content_id}/analytics", response_model=JsonDoc | None, summary="Detailed breakdowns, or null when none exist")
def content_analytics(db: DB, content_id: str = IdPath()):
    return svc.content_analytics(db, content_id)


# --- leads -----------------------------------------------------------------------------------
@leads.get("", response_model=list[s.LeadOut])
def list_leads(db: DB, status_: LeadStatus | None = Query(default=None, alias="status"),
               campaign_id: str | None = Query(default=None, alias="campaignId", max_length=80), q: str | None = Search()):
    return svc.list_leads(db, status=status_, campaign_id=campaign_id, q=q)


@leads.post("", response_model=s.LeadCreateResultOut, status_code=status.HTTP_201_CREATED,
            summary="Create a lead (201), or return the existing lead for the same handle (200, created=false)")
def create_lead(db: DB, body: LeadCreateIn, response: Response, _perm=require("write")):
    result = svc.create_lead(db, body)
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return commit(db, result)


@leads.get("/summary", response_model=s.LeadPipelineSummaryOut)
def lead_summary(db: DB):
    return svc.lead_summary(db)


@leads.patch("/{lead_id}", response_model=s.LeadOut, summary="Update status and/or editable details (notes, name, location, phone)")
def update_lead(db: DB, body: LeadPatchIn, lead_id: str = IdPath(), _perm=require("write")):
    return commit(db, svc.update_lead(db, lead_id, body))


# --- audience / dashboard --------------------------------------------------------------------
@audience.get("/summary", response_model=s.AudienceSummaryOut)
def audience_summary(db: DB):
    return svc.audience_summary(db)


@audience.get("/intelligence", response_model=JsonDoc)
def audience_intelligence(db: DB):
    return svc.audience_intelligence(db)


@dashboard.get("/executive-brief", response_model=JsonDoc, summary="Stored AI executive brief (demo output; no model is called)")
def executive_brief(db: DB):
    return eng.executive_brief(db)


routers = [workspace, accounts, meta, campaigns, content, leads, audience, dashboard]
