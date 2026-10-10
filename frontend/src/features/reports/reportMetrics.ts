import { formatCompact, formatDate, formatNumber } from '@/lib/format';
import type { Campaign, ContentItem, ContentType, TrendPoint } from '@/types/domain';
import type { ComputedReport, ReportConfig, ReportContext, ReportDeltas, ReportFormatRow, ReportListItem, Report, ReportTotals } from '@/types/reports';

/**
 * Pure, deterministic derivations: every number on the report screens is computed here from the
 * canonical demo data (campaigns, content, account overview, daily trends, audience), never retyped.
 * The demo reporting window is Oct 1–31, 2024; sub-month periods are prorated with the account's
 * daily trend curve (the share of the month's views / leads that fall inside the window).
 */

const dayIndex = (iso: string) => Number(iso.slice(8, 10)) - 1;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function windowPoints(series: TrendPoint[], period: ReportConfig['period']) {
  return series.slice(Math.max(0, dayIndex(period.start)), Math.min(series.length, dayIndex(period.end) + 1));
}

function isFullMonth(period: ReportConfig['period']) {
  return period.start === '2024-10-01' && period.end === '2024-10-31';
}

function periodShare(series: TrendPoint[], period: ReportConfig['period'], key: 'current' | 'previous' = 'current') {
  if (isFullMonth(period)) return 1;
  const total = sum(series.map((p) => p[key]));
  return total === 0 ? 0 : sum(windowPoints(series, period).map((p) => p[key])) / total;
}

export function formatPeriod(period: ReportConfig['period']) {
  return `${formatDate(period.start, { year: false })} – ${formatDate(period.end)}`;
}

const formatMeta: Record<ContentType, { label: string; icon: string }> = {
  reel: { label: 'Short-Form Reels', icon: 'movie' },
  carousel: { label: 'Carousels', icon: 'view_carousel' },
  post: { label: 'Static Posts & Infographics', icon: 'image' },
  story: { label: 'Stories', icon: 'amp_stories' },
};

const engagementOf = (c: ContentItem) => c.metrics.likes + c.metrics.comments + c.metrics.shares + c.metrics.saves;
const avgWatchOf = (c: ContentItem) => (c.durationSec && c.metrics.retention ? (c.durationSec * c.metrics.retention) / 100 : null);
const reachWeighted = (rows: Array<{ reach: number; rate: number }>) => {
  const reach = sum(rows.map((r) => r.reach));
  return reach === 0 ? 0 : sum(rows.map((r) => r.rate * r.reach)) / reach;
};

function scopedContent(config: ReportConfig, ctx: ReportContext): ContentItem[] {
  if (config.contentIds?.length) return ctx.content.filter((c) => config.contentIds!.includes(c.id));
  if (config.scope === 'account') return ctx.content;
  return ctx.content.filter((c) => c.campaignId !== null && config.campaignIds.includes(c.campaignId));
}

function buildFormats(items: ContentItem[], viewShare = 1, leadShare = 1): { formats: ReportFormatRow[]; efficiencyRatio: number | null } {
  const totalEngagement = sum(items.map(engagementOf));
  const groups = new Map<ContentType, ContentItem[]>();
  items.forEach((c) => groups.set(c.type, [...(groups.get(c.type) ?? []), c]));
  const formats = [...groups.entries()]
    .map<ReportFormatRow>(([type, list]) => ({
      type,
      ...formatMeta[type],
      count: list.length,
      views: Math.round(sum(list.map((c) => c.metrics.views)) * viewShare),
      engagement: Math.round(sum(list.map(engagementOf)) * viewShare),
      leads: Math.round(sum(list.map((c) => c.metrics.leads)) * leadShare),
      share: totalEngagement === 0 ? 0 : (sum(list.map(engagementOf)) / totalEngagement) * 100,
      avgEngagementRate: reachWeighted(list.map((c) => ({ reach: c.metrics.reach, rate: c.metrics.engagementRate }))),
    }))
    .sort((a, b) => b.engagement - a.engagement);
  const yields = formats.filter((f) => f.views > 0 && f.leads > 0).map((f) => f.leads / f.views).sort((a, b) => b - a);
  return { formats, efficiencyRatio: yields.length >= 2 ? yields[0] / yields[1] : null };
}

export function computeReport(config: ReportConfig, ctx: ReportContext): ComputedReport {
  const { period } = config;
  const selected = ctx.campaigns.filter((c) => config.campaignIds.includes(c.id));
  const withData = selected.filter((c): c is Campaign & { metrics: NonNullable<Campaign['metrics']> } => c.metrics !== null);
  const viewShare = periodShare(ctx.trends.views, period);
  const leadShare = periodShare(ctx.trends.leads, period);
  const scale = (v: number, s: number) => Math.round(v * s);

  const campaignRows = withData.map((c) => {
    const spend = ctx.boostSpendInr[c.id];
    return {
      campaign: c,
      views: scale(c.metrics.views, viewShare),
      reach: scale(c.metrics.reach, viewShare),
      engagementRate: c.metrics.engagementRate,
      leads: scale(c.metrics.leads, leadShare),
      comments: scale(c.metrics.comments, viewShare),
      cpl: spend && c.metrics.leads ? spend / c.metrics.leads : null,
    };
  });

  const content = scopedContent(config, ctx);
  const reels = content.filter((c) => avgWatchOf(c) !== null);
  const reelWatchSec = sum(reels.map((c) => c.metrics.views * avgWatchOf(c)!));
  const reelViews = sum(reels.map((c) => c.metrics.views));
  const inquiries = sum(withData.map((c) => (c.metrics.conversionRate ? c.metrics.leads / (c.metrics.conversionRate / 100) : 0)));
  const campaignConversion = inquiries ? (sum(withData.map((c) => c.metrics.leads)) / inquiries) * 100 : null;

  let totals: ReportTotals;
  if (config.contentIds?.length) {
    totals = {
      views: sum(content.map((c) => c.metrics.views)),
      reach: sum(content.map((c) => c.metrics.reach)),
      engagementRate: reachWeighted(content.map((c) => ({ reach: c.metrics.reach, rate: c.metrics.engagementRate }))),
      likes: sum(content.map((c) => c.metrics.likes)),
      comments: sum(content.map((c) => c.metrics.comments)),
      shares: sum(content.map((c) => c.metrics.shares)),
      saves: sum(content.map((c) => c.metrics.saves)),
      leads: sum(content.map((c) => c.metrics.leads)),
      conversionRate: null,
      spendInr: 0,
      cpl: null,
      watchTimeHours: reelWatchSec / 3600,
      avgWatchSec: reelViews ? reelWatchSec / reelViews : null,
      reelCount: reels.length,
    };
  } else if (config.scope === 'account') {
    const o = ctx.overview;
    const spendInr = sum(Object.values(ctx.boostSpendInr)) * leadShare;
    const views = scale(o.views.value, viewShare);
    const leads = scale(o.leads.value, leadShare);
    const watchTimeHours = o.watchTimeHours.value * viewShare;
    totals = {
      views,
      reach: scale(o.reach.value, viewShare),
      engagementRate: o.engagementRate.value,
      likes: scale(o.likes.value, viewShare),
      comments: scale(o.comments.value, viewShare),
      shares: scale(o.shares.value, viewShare),
      saves: scale(o.saves.value, viewShare),
      leads,
      conversionRate: campaignConversion,
      spendInr,
      cpl: leads ? spendInr / leads : null,
      watchTimeHours,
      avgWatchSec: views ? (watchTimeHours * 3600) / views : null,
      reelCount: reels.length,
    };
  } else {
    const spendInr = sum(withData.map((c) => (ctx.boostSpendInr[c.id] ?? 0) * leadShare));
    const leads = sum(campaignRows.map((r) => r.leads));
    totals = {
      views: sum(campaignRows.map((r) => r.views)),
      reach: sum(campaignRows.map((r) => r.reach)),
      engagementRate: reachWeighted(campaignRows.map((r) => ({ reach: r.reach, rate: r.engagementRate }))),
      likes: sum(withData.map((c) => scale(c.metrics.likes, viewShare))),
      comments: sum(campaignRows.map((r) => r.comments)),
      shares: sum(withData.map((c) => scale(c.metrics.shares, viewShare))),
      saves: sum(withData.map((c) => scale(c.metrics.saves, viewShare))),
      leads,
      conversionRate: campaignConversion,
      spendInr,
      cpl: leads ? spendInr / leads : null,
      watchTimeHours: (reelWatchSec * viewShare) / 3600,
      avgWatchSec: reelViews ? reelWatchSec / reelViews : null,
      reelCount: reels.length,
    };
  }

  /* ------------------------------ baseline deltas ----------------------------- */
  let deltas: ReportDeltas = { note: null };
  let baselineViews = 0;
  if (!config.compareBaseline) {
    deltas = { note: 'Baseline comparison off' };
  } else if (config.contentIds?.length) {
    deltas = { note: 'Sep baseline is not tracked per creative' };
  } else if (config.scope === 'account') {
    const o = ctx.overview;
    baselineViews = o.views.baseline ?? 0;
    deltas = {
      views: o.views.delta,
      reach: o.reach.delta,
      engagement: o.engagementRate.baseline !== undefined ? o.engagementRate.value - o.engagementRate.baseline : undefined,
      leads: o.leads.delta,
      note: null,
    };
  } else {
    const comparable = withData.filter((c) => c.baseline);
    if (comparable.length === 0) {
      deltas = { note: 'No Sep baseline for the selected campaigns' };
    } else {
      const cur = (k: 'views' | 'reach' | 'leads') => sum(comparable.map((c) => c.metrics[k]));
      const base = (k: 'views' | 'reach' | 'leads') => sum(comparable.map((c) => c.baseline![k]));
      const pct = (k: 'views' | 'reach' | 'leads') => ((cur(k) - base(k)) / base(k)) * 100;
      baselineViews = base('views');
      deltas = {
        views: pct('views'),
        reach: pct('reach'),
        engagement:
          reachWeighted(comparable.map((c) => ({ reach: c.metrics.reach, rate: c.metrics.engagementRate }))) -
          reachWeighted(comparable.map((c) => ({ reach: c.baseline!.reach, rate: c.baseline!.engagementRate }))),
        leads: pct('leads'),
        note: comparable.length < withData.length ? `${comparable.length} of ${withData.length} campaigns have a Sep baseline` : null,
      };
    }
  }

  /* --------------------------------- timeline --------------------------------- */
  const points = windowPoints(ctx.trends.views, period);
  const curWindow = sum(points.map((p) => p.current)) || 1;
  const prevWindow = sum(points.map((p) => p.previous)) || 1;
  const baselineTotal = baselineViews * periodShare(ctx.trends.views, period, 'previous');
  let cumCurrent = 0;
  let cumPrevious = 0;
  const timeline = points.map<TrendPoint>((p) => {
    cumCurrent += (p.current / curWindow) * totals.views;
    cumPrevious += (p.previous / prevWindow) * baselineTotal;
    return { date: p.date, current: Math.round(cumCurrent), previous: Math.round(cumPrevious) };
  });
  const peakPoint = points.reduce<TrendPoint | null>((best, p) => (!best || p.current > best.current ? p : best), null);
  const peakViews = peakPoint ? Math.round((peakPoint.current / curWindow) * totals.views) : 0;

  const { formats, efficiencyRatio } = config.contentIds?.length ? buildFormats(content) : buildFormats(content, viewShare, leadShare);
  const creatives = [...content]
    .sort((a, b) => b.metrics.leads - a.metrics.leads || b.metrics.views - a.metrics.views)
    .slice(0, 5)
    .map((c) => ({ content: c, avgWatchSec: avgWatchOf(c) }));

  return {
    campaigns: withData,
    campaignsWithoutData: selected.filter((c) => c.metrics === null),
    periodLabel: formatPeriod(period),
    periodShare: viewShare,
    totals,
    deltas,
    campaignRows,
    creatives,
    formats,
    efficiencyRatio,
    timeline,
    peak: peakPoint && totals.views ? { date: peakPoint.date, views: peakViews, share: (peakViews / totals.views) * 100 } : null,
    baselineGap: baselineTotal > 0 ? Math.round(cumCurrent - cumPrevious) : null,
    topStates: [...ctx.audience.topStates].sort((a, b) => b.share - a.share).map((s) => ({ label: s.label, share: s.share, leads: s.leads })),
  };
}

const shortName = (c: Campaign) => c.name.replace(/ Campaign$/, '').replace(/^SBI CSP (Mitra)/, '$1');

/** Library-table "Campaigns Included" column, derived from the same computation as the detail page. */
export function summarizeReport(report: Report, computed: ComputedReport, ctx: ReportContext): ReportListItem['summary'] {
  const t = computed.totals;
  if (report.status === 'scheduled' && report.nextRunLabel) {
    return { primary: report.scope === 'account' ? 'All campaigns + organic' : `${computed.campaigns.length} Campaigns`, secondary: `Next run: ${report.nextRunLabel}`, tone: 'muted' };
  }
  if (report.contentIds?.length) {
    const items = ctx.content.filter((c) => report.contentIds!.includes(c.id));
    return { primary: items.map((c) => c.title).join(', '), secondary: `${formatCompact(t.views)} views · ${t.engagementRate.toFixed(1)}% ER`, tone: 'positive' };
  }
  if (report.type === 'audience') {
    const state = computed.topStates[0];
    const age = [...ctx.audience.age].sort((a, b) => b.share - a.share)[0];
    return { primary: `${formatCompact(t.reach)} Reach`, secondary: `${state.label} ${state.share}% (${age.label} Age Primary)` };
  }
  if (report.type === 'comments_sentiment') {
    return { primary: `${formatNumber(t.comments)} Comments`, secondary: `${formatNumber(t.leads)} Leads from conversations` };
  }
  if (report.scope === 'account') {
    return { primary: `All ${computed.campaigns.length} Campaigns + Organic`, secondary: `${formatCompact(t.views)} Total Views` };
  }
  if (computed.campaigns.length <= 2) {
    return {
      primary: computed.campaigns.map((c, i) => (i === 0 ? c.name.replace(/ Campaign$/, '') : shortName(c))).join(', ') || 'No campaign data',
      secondary: `${computed.campaigns.length} Campaign${computed.campaigns.length === 1 ? '' : 's'} · ${formatCompact(t.views)} views · ${formatNumber(t.leads)} leads`,
    };
  }
  return { primary: `${computed.campaigns.length} Campaigns`, secondary: `${formatCompact(t.views)} views · ${formatNumber(t.leads)} leads` };
}
