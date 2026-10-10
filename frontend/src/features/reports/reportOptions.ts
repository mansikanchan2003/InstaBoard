import type { ReportConfig, ReportFormat, ReportMetricKey, ReportSchedule, ReportSectionKey, ReportStatus, ReportType } from '@/types/reports';

/** Static UI copy / option lists for the Reports screens (labels, not domain records). */

export const reportTypeOptions: Array<{ value: ReportType; label: string; short: string }> = [
  { value: 'campaign_performance', label: 'Campaign Performance', short: 'Campaign Performance' },
  { value: 'content_reel', label: 'Content & Reel', short: 'Content and Reel' },
  { value: 'audience', label: 'Audience Insights', short: 'Audience Insights' },
  { value: 'comments_sentiment', label: 'Comments & Sentiment', short: 'Comments and Sentiment' },
  { value: 'lead_generation', label: 'Lead Generation', short: 'Lead Generation' },
  { value: 'executive_summary', label: 'Executive Summary', short: 'Executive Summary' },
];

export const reportTypeLabel = (t: ReportType) => reportTypeOptions.find((o) => o.value === t)!.short;

export const reportStatusMeta: Record<ReportStatus, { label: string; filterLabel: string }> = {
  ready: { label: 'Ready', filterLabel: 'Ready' },
  ready_demo: { label: 'Ready (demo)', filterLabel: 'Ready (demo)' },
  generating: { label: 'Generating', filterLabel: 'Generating' },
  scheduled: { label: 'Scheduled', filterLabel: 'Scheduled' },
  failed: { label: 'Failed', filterLabel: 'Failed' },
  archived: { label: 'Archived', filterLabel: 'Archived' },
};

export const metricOptions: Array<{ value: ReportMetricKey; label: string }> = [
  { value: 'views', label: 'Views & Impressions' },
  { value: 'reach', label: 'Reach' },
  { value: 'engagement', label: 'Engagement Rate' },
  { value: 'watchTime', label: 'Watch Time' },
  { value: 'comments', label: 'Comments & Sentiment' },
  { value: 'leads', label: 'Leads & CPL' },
];

export const sectionOptions: Array<{ value: ReportSectionKey; label: string }> = [
  { value: 'summary', label: 'Executive summary (AI)' },
  { value: 'kpis', label: 'KPI overview' },
  { value: 'timeline', label: 'Timeline vs baseline' },
  { value: 'formats', label: 'Creative format efficiency' },
  { value: 'campaigns', label: 'Campaign breakdown table' },
  { value: 'creatives', label: 'Top creatives & retention' },
  { value: 'audience', label: 'Audience & geography' },
  { value: 'recommendations', label: 'AI recommendations' },
];

export const formatOptions: Array<{ value: ReportFormat; label: string }> = [
  { value: 'pdf', label: 'PDF Executive Deck' },
  { value: 'csv', label: 'CSV Raw Analytics Data' },
];

export const scheduleOptions: Array<{ value: ReportSchedule; label: string }> = [
  { value: 'none', label: 'One-time (generate now)' },
  { value: 'weekly', label: 'Weekly · Mondays 09:00 AM IST' },
  { value: 'monthly', label: 'Monthly · 1st, 09:00 AM IST' },
];

/** Demo reporting window: Oct 1–31, 2024. */
export const DEMO_WINDOW = { start: '2024-10-01', end: '2024-10-31' } as const;

export const datePresets: Array<{ value: string; label: string; period?: ReportConfig['period'] }> = [
  { value: 'oct', label: 'Oct 01 - Oct 31, 2024', period: { start: '2024-10-01', end: '2024-10-31' } },
  { value: 'last7', label: 'Last 7 Days (Oct 25 - Oct 31)', period: { start: '2024-10-25', end: '2024-10-31' } },
  { value: 'first-half', label: 'First Half (Oct 01 - Oct 15)', period: { start: '2024-10-01', end: '2024-10-15' } },
  { value: 'custom', label: 'Custom Date Window...' },
];

export const defaultSections: Record<ReportType, ReportSectionKey[]> = {
  campaign_performance: ['summary', 'kpis', 'timeline', 'formats', 'campaigns', 'creatives', 'recommendations'],
  content_reel: ['summary', 'kpis', 'formats', 'creatives', 'recommendations'],
  audience: ['summary', 'kpis', 'audience', 'campaigns'],
  comments_sentiment: ['summary', 'kpis', 'campaigns', 'creatives', 'recommendations'],
  lead_generation: ['summary', 'kpis', 'campaigns', 'creatives'],
  executive_summary: ['summary', 'kpis', 'timeline', 'formats', 'campaigns', 'audience', 'recommendations'],
};

/** Account-wide report types include organic content (scope "account"). */
export const accountScopedTypes: ReportType[] = ['executive_summary', 'audience', 'comments_sentiment'];

/** Strips a report (or list item) down to the fields the configuration form edits. */
export function pickConfig(r: ReportConfig): ReportConfig {
  return {
    title: r.title,
    type: r.type,
    scope: r.scope,
    accountId: r.accountId,
    campaignIds: [...r.campaignIds],
    contentIds: r.contentIds ? [...r.contentIds] : undefined,
    period: { ...r.period },
    metrics: [...r.metrics],
    sections: [...r.sections],
    compareBaseline: r.compareBaseline,
    formats: [...r.formats],
    schedule: r.schedule,
    recipients: [...r.recipients],
  };
}

export function blankConfig(overrides: Partial<ReportConfig> = {}): ReportConfig {
  return {
    title: 'SBI CSP Recruitment Campaign Report - Final Q3',
    type: 'campaign_performance',
    scope: 'campaigns',
    accountId: 'acc-ekoindia',
    campaignIds: ['sbi-csp-october', 'sbi-csp-mitra-recruitment'],
    period: { ...DEMO_WINDOW },
    metrics: ['views', 'reach', 'engagement', 'comments', 'leads'],
    sections: defaultSections.campaign_performance,
    compareBaseline: true,
    formats: ['pdf', 'csv'],
    schedule: 'none',
    recipients: [],
    ...overrides,
  };
}
