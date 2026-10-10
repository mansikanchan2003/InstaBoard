import { formatDate } from '@/lib/format';
import type { Campaign, CampaignMetrics, CampaignObjective, CampaignStatus } from '@/types/domain';

export const OBJECTIVES: CampaignObjective[] = ['Lead Generation', 'Awareness', 'Engagement'];

export const STATUS_ORDER: CampaignStatus[] = ['active', 'scheduled', 'paused', 'completed', 'draft'];

/** Status chip dot colours (export: Campaign status filter chips). */
export const STATUS_DOT: Record<CampaignStatus, string> = {
  active: 'bg-status-active',
  scheduled: 'bg-tertiary',
  paused: 'bg-status-paused',
  completed: 'bg-status-completed',
  draft: 'bg-status-draft',
};

/** Selectable target regions for the wizard / edit form. */
export const REGION_OPTIONS = [
  'Uttar Pradesh',
  'Bihar',
  'Haryana',
  'Delhi',
  'Rajasthan',
  'Madhya Pradesh',
  'Maharashtra',
  'West Bengal',
  'Jharkhand',
  'Odisha',
  'Gujarat',
  'Punjab',
];

export const AGE_GROUP_OPTIONS = ['25–34 (Highest operator conversion)', '18–44 (Broad distribution)', '18–24 (Students / first job)', '35–44 (Established retailers)'];

/** Report detail export (rep-2024-884) covers the SBI CSP campaigns. */
export const SBI_CSP_REPORT_ID = 'rep-2024-884';
export const SBI_CSP_CAMPAIGN_IDS = ['sbi-csp-october', 'sbi-csp-mitra-recruitment'];

/** Percent change of current vs baseline, or undefined when either is missing / zero. */
export function pctDelta(current: number | undefined, baseline: number | undefined): number | undefined {
  if (current === undefined || baseline === undefined || baseline === 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}

export function campaignDurationLabel(c: Pick<Campaign, 'startDate' | 'endDate'>): string {
  if (!c.startDate && !c.endDate) return '—';
  if (c.startDate && c.endDate) return `${formatDate(c.startDate, { year: false })} – ${formatDate(c.endDate)}`;
  return c.startDate ? `From ${formatDate(c.startDate)}` : `Until ${formatDate(c.endDate)}`;
}

export function creativesLabel(c: Campaign): string {
  return c.creativesNote ?? `${c.creativesCount} Creative${c.creativesCount === 1 ? '' : 's'}`;
}

export const codeNumber = (c: Campaign) => Number(c.code.replace(/\D/g, '')) || 0;

export const metric = (c: Campaign, key: keyof CampaignMetrics) => c.metrics?.[key] ?? null;

/** Split comma/space separated hashtags and normalise to "#Tag". */
export function parseHashtags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter(Boolean)
        .map((t) => `#${t}`),
    ),
  );
}

/** Client-side CSV of the given campaigns (demo data only). */
export function downloadCampaignsCsv(rows: Campaign[], filename = 'instaboard-campaigns-demo.csv') {
  const header = ['Code', 'Name', 'Objective', 'Status', 'Start', 'End', 'Views', 'Reach', 'Engagement %', 'Leads', 'Conversion %', 'Budget INR', 'Regions', 'Hashtags'];
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((c) =>
    [
      c.code,
      c.name,
      c.objective,
      c.status,
      c.startDate,
      c.endDate,
      c.metrics?.views,
      c.metrics?.reach,
      c.metrics?.engagementRate,
      c.metrics?.leads,
      c.metrics?.conversionRate,
      c.budgetInr,
      c.targetRegions.join('; '),
      c.hashtags.join(' '),
    ]
      .map(esc)
      .join(','),
  );
  const csv = ['# Eko InstaBoard demo data - not retrieved from Instagram', header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------- Form validation ------------------------------ */

export interface CampaignFormValues {
  name: string;
  objective: CampaignObjective;
  startDate: string;
  endDate: string;
  accountId: string;
  targetRegions: string[];
  hashtags: string;
  budget: string;
  leadGoal: string;
  primaryAgeGroup: string;
}

export type CampaignFormErrors = Partial<Record<keyof CampaignFormValues, string>>;

export function emptyCampaignForm(accountId = ''): CampaignFormValues {
  return { name: '', objective: 'Lead Generation', startDate: '', endDate: '', accountId, targetRegions: [], hashtags: '', budget: '', leadGoal: '', primaryAgeGroup: AGE_GROUP_OPTIONS[0] };
}

export function formFromCampaign(c: Campaign): CampaignFormValues {
  return {
    name: c.name,
    objective: c.objective,
    startDate: c.startDate ?? '',
    endDate: c.endDate ?? '',
    accountId: c.accountId,
    targetRegions: [...c.targetRegions],
    hashtags: c.hashtags.join(' '),
    budget: c.budgetInr !== undefined ? String(c.budgetInr) : '',
    leadGoal: c.leadGoal !== undefined ? String(c.leadGoal) : '',
    primaryAgeGroup: c.primaryAgeGroup ?? '',
  };
}

const isNonNegativeNumber = (v: string) => v.trim() === '' || (/^\d+(\.\d+)?$/.test(v.trim()) && Number(v) >= 0);

/** Validates the basics; `requireDates` is set when scheduling (drafts may leave dates empty). */
export function validateCampaignForm(v: CampaignFormValues, opts: { requireDates?: boolean; requireAccount?: boolean } = {}): CampaignFormErrors {
  const e: CampaignFormErrors = {};
  if (!v.name.trim()) e.name = 'Campaign name is required.';
  else if (v.name.trim().length > 80) e.name = 'Keep the name under 80 characters.';
  if (opts.requireDates) {
    if (!v.startDate) e.startDate = 'Start date is required to schedule.';
    if (!v.endDate) e.endDate = 'End date is required to schedule.';
  }
  if (v.startDate && v.endDate && v.endDate < v.startDate) e.endDate = 'End date must be on or after the start date.';
  if (opts.requireAccount && !v.accountId) e.accountId = 'Select a connected Instagram account.';
  if (!isNonNegativeNumber(v.budget)) e.budget = 'Enter a positive amount in ₹ (numbers only).';
  if (!isNonNegativeNumber(v.leadGoal)) e.leadGoal = 'Enter a whole number.';
  return e;
}

export const optionalNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));
