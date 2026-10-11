/**
 * Core domain entities shared across screens. Shapes are intentionally close to what a
 * FastAPI backend would return so demo data can later be swapped for API responses.
 * Feature-specific types live next to them in src/types/<feature>.ts.
 */

export type ID = string;
/** ISO date (YYYY-MM-DD) or datetime string. */
export type ISODate = string;

/* ----------------------------- Workspace / users ---------------------------- */

export interface TeamMember {
  id: ID;
  name: string;
  email: string;
  role: string;
  /** Workspace permission level. */
  access: 'Owner' | 'Admin' | 'Editor' | 'Viewer';
  avatarUrl?: string;
  status: 'active' | 'invited' | 'suspended';
  lastActive: string;
}

export interface Workspace {
  id: ID;
  name: string;
  plan: string;
  timezone: string;
  currency: string;
  /** Demo reporting window shown in the header date picker. */
  reportingPeriod: { start: ISODate; end: ISODate; label: string };
  baselinePeriod: { start: ISODate; end: ISODate; label: string };
  lastSyncedLabel: string;
}

/* ------------------------------ Instagram accounts -------------------------- */

export type AccountType = 'business' | 'creator';
export type AccountStatus = 'connected' | 'action_required' | 'expired' | 'syncing';
export type DataAvailability = 'available' | 'partial' | 'inactive' | 'unavailable';

export interface InstagramAccount {
  id: ID;
  displayName: string;
  handle: string;
  /** Short avatar initials used when no image is present. */
  initials: string;
  avatarUrl?: string;
  type: AccountType;
  status: AccountStatus;
  isPrimary: boolean;
  verified: boolean;
  externalId: string;
  connectedSince: ISODate;
  lastSyncedAt: string;
  nextSyncLabel?: string;
  statusNote?: string;
  followers: number;
  following: number;
  mediaCount: number;
  dataAvailability: {
    media: { level: DataAvailability; detail: string; label: string };
    audience: { level: DataAvailability; detail: string; label: string };
    comments: { level: DataAvailability; detail: string; label: string };
    stories: { level: DataAvailability; detail: string; label: string };
  };
  scopes: string[];
}

/* ----------------------------------- Campaigns ------------------------------ */

export type CampaignStatus = 'active' | 'paused' | 'completed' | 'scheduled' | 'draft';
export type CampaignObjective = 'Lead Generation' | 'Awareness' | 'Engagement';
export type CampaignHealth = 'excellent' | 'good' | 'needs_attention';

export interface CampaignMetrics {
  views: number;
  reach: number;
  /** Percent value, e.g. 5.42 */
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  leads: number;
  /** Lead conversion rate, percent. */
  conversionRate: number;
}

export interface Campaign {
  id: ID;
  /** Human readable code, e.g. "#CAM-8802". */
  code: string;
  name: string;
  objective: CampaignObjective;
  /** Short focus label shown in dashboard rows, e.g. "Agent Recruitment". */
  focus: string;
  status: CampaignStatus;
  startDate: ISODate | null;
  endDate: ISODate | null;
  accountId: ID;
  creativesCount: number;
  /** Optional sub-label replacing the creatives count (e.g. "Drafting copy"). */
  creativesNote?: string;
  thumbnailUrl?: string;
  /** Format of the thumbnail creative (drives the small camera / video overlay icon in tables). */
  thumbnailType?: 'image' | 'video';
  owner: string;
  budgetInr?: number;
  /** Target number of leads set when the campaign was planned. */
  leadGoal?: number;
  /** Primary age demographic targeted, e.g. "25–34". */
  primaryAgeGroup?: string;
  targetRegions: string[];
  hashtags: string[];
  /** null until the campaign has run. */
  metrics: CampaignMetrics | null;
  /** Previous-period (baseline) metrics for comparison, when known. */
  baseline?: CampaignMetrics;
  health: CampaignHealth | null;
}

/* ------------------------------------ Content ------------------------------- */

export type ContentType = 'reel' | 'post' | 'carousel' | 'story';

export interface ContentMetrics {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  leads: number;
  /** Average retention / completion percentage for video formats. */
  retention?: number;
}

export interface ContentItem {
  id: ID;
  title: string;
  caption: string;
  type: ContentType;
  campaignId: ID | null;
  accountId: ID;
  publishedAt: ISODate;
  durationSec?: number;
  slides?: number;
  thumbnailUrl?: string;
  thumbnailAlt: string;
  isTopPerformer?: boolean;
  metrics: ContentMetrics;
}

/* ------------------------------------- Leads -------------------------------- */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadSource = 'comment' | 'dm' | 'bio_link' | 'profile_visit';

export interface Lead {
  id: ID;
  name: string;
  handle: string;
  location: string;
  campaignId: ID;
  contentId: ID | null;
  /** AI intent score 0-100. */
  score: number;
  status: LeadStatus;
  source: LeadSource;
  lastContact: string;
  firstMessage: string;
  phoneMasked?: string;
  notes?: string;
  /** Comment this lead was converted from (set by "Convert to lead"). */
  sourceCommentId?: ID;
}

/** Fields a user may edit on a lead (PATCH /leads/{id}); score, source and links are derived. */
export interface LeadDetailsPatch {
  notes?: string;
  name?: string;
  location?: string;
  phoneMasked?: string;
}

/** POST /leads result: `created` is false when the handle already belonged to a lead. */
export interface LeadCreateResult {
  lead: Lead;
  created: boolean;
}

export interface LeadPipelineSummary {
  totalCommentInquiries: number;
  aiFilteredPotential: number;
  aiIntentRate: number;
  qualifiedLeads: number;
  qualifiedLeadsDelta: number;
  convertedOperators: number;
  closeRate: number;
}

/* ------------------------------- Account overview --------------------------- */

export interface KpiValue {
  value: number;
  /** Percent change vs baseline period. */
  delta?: number;
  baseline?: number;
}

/** Account-level totals for the reporting period (campaign + organic content). */
export interface AccountOverview {
  accountId: ID;
  followers: number;
  totalContent: number;
  views: KpiValue;
  reach: KpiValue;
  engagementRate: KpiValue;
  likes: KpiValue;
  comments: KpiValue;
  shares: KpiValue;
  saves: KpiValue;
  leads: KpiValue & { target: number };
  watchTimeHours: KpiValue;
  aiHealthScore: number;
}

export interface TrendPoint {
  date: string;
  /** Current-period value. */
  current: number;
  /** Previous-period (baseline) value. */
  previous: number;
}

export type TrendMetric = 'views' | 'reach' | 'engagement' | 'leads' | 'shares' | 'watchTime';
