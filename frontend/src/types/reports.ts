/** Reports (Reports Overview + Report Detail screens). Owned by the Reports feature. */
import type { AccountOverview, Campaign, ContentItem, ContentType, ID, ISODate, TrendMetric, TrendPoint } from './domain';
import type { AudienceSummary } from './audience';

export type ReportType = 'campaign_performance' | 'content_reel' | 'audience' | 'comments_sentiment' | 'lead_generation' | 'executive_summary';

/** `ready_demo` = generated/edited inside this prototype session from canonical demo data. */
export type ReportStatus = 'ready' | 'ready_demo' | 'generating' | 'scheduled' | 'failed' | 'archived';

export type ReportMetricKey = 'views' | 'reach' | 'engagement' | 'watchTime' | 'comments' | 'leads';

export type ReportSectionKey = 'summary' | 'kpis' | 'timeline' | 'formats' | 'campaigns' | 'creatives' | 'audience' | 'recommendations';

export type ReportFormat = 'pdf' | 'csv';

export type ReportSchedule = 'none' | 'weekly' | 'monthly';

/** `account` = whole @account totals (campaigns + organic); `campaigns` = only the selected campaigns. */
export type ReportScope = 'campaigns' | 'account';

/** Everything the "Create New Performance Report" form edits. */
export interface ReportConfig {
  title: string;
  type: ReportType;
  scope: ReportScope;
  accountId: ID;
  campaignIds: ID[];
  /** Optional content focus (Content & Reel reports). */
  contentIds?: ID[];
  period: { start: ISODate; end: ISODate };
  metrics: ReportMetricKey[];
  sections: ReportSectionKey[];
  compareBaseline: boolean;
  formats: ReportFormat[];
  schedule: ReportSchedule;
  /** Saved only — the prototype never sends email. */
  recipients: string[];
}

/** Report-specific AI narrative (things only the report screen shows). */
export interface ReportNarrative {
  responseVelocity?: { title: string; highlight: string; detail: string };
  observed: string;
  recommendation: string;
  projectedImpact: string;
  confidencePct: number;
  modelLabel: string;
}

export interface Report extends ReportConfig {
  id: ID;
  /** Human readable number, e.g. "#REP-2024-884". */
  code: string;
  status: ReportStatus;
  icon: string;
  /** Sortable ISO datetime of the last generation (or creation for scheduled-only reports). */
  generatedAt: string;
  generatedLabel: string;
  createdBy: string;
  nextRunLabel?: string;
  failureReason?: string;
  narrative?: ReportNarrative;
}

/* ------------------------------- Derived data ------------------------------ */

/** Canonical data a report is computed from (fetched through the shared services). */
export interface ReportContext {
  campaigns: Campaign[];
  content: ContentItem[];
  overview: AccountOverview;
  trends: Record<TrendMetric, TrendPoint[]>;
  audience: AudienceSummary;
  /** Paid boost spend per campaign (INR) — used for CPL. */
  boostSpendInr: Record<ID, number>;
  /** Pre-Eko-automation CPL benchmark used by the "vs baseline" callouts. */
  cplBenchmarkInr: number;
}

export interface ReportTotals {
  views: number;
  reach: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  leads: number;
  conversionRate: number | null;
  spendInr: number;
  cpl: number | null;
  watchTimeHours: number;
  avgWatchSec: number | null;
  reelCount: number;
}

export interface ReportDeltas {
  views?: number;
  reach?: number;
  /** Percentage-point change. */
  engagement?: number;
  leads?: number;
  /** e.g. "1 of 2 campaigns with Sep baseline" when not every campaign has a baseline. */
  note: string | null;
}

export interface ReportCampaignRow {
  campaign: Campaign;
  views: number;
  reach: number;
  engagementRate: number;
  leads: number;
  comments: number;
  cpl: number | null;
}

export interface ReportCreativeRow {
  content: ContentItem;
  avgWatchSec: number | null;
}

export interface ReportFormatRow {
  type: ContentType;
  label: string;
  icon: string;
  count: number;
  views: number;
  engagement: number;
  leads: number;
  /** Share of total engagement in scope, percent. */
  share: number;
  avgEngagementRate: number;
}

export interface ComputedReport {
  campaigns: Campaign[];
  /** Selected campaigns without data in the period (scheduled / draft). */
  campaignsWithoutData: Campaign[];
  periodLabel: string;
  /** Share of the month's activity that falls inside the report period (1 for the full month). */
  periodShare: number;
  totals: ReportTotals;
  deltas: ReportDeltas;
  campaignRows: ReportCampaignRow[];
  creatives: ReportCreativeRow[];
  formats: ReportFormatRow[];
  /** Leads-per-view ratio of the best format vs the runner-up. */
  efficiencyRatio: number | null;
  /** Cumulative views, current period vs baseline. */
  timeline: TrendPoint[];
  peak: { date: string; views: number; share: number } | null;
  baselineGap: number | null;
  topStates: Array<{ label: string; share: number; leads: number }>;
}

export interface ReportListItem extends Report {
  summary: { primary: string; secondary: string; tone?: 'positive' | 'muted' };
  totals: ReportTotals;
}

export interface ReportDetail {
  report: Report;
  computed: ComputedReport;
  cplBenchmarkInr: number;
  audience: AudienceSummary;
}
