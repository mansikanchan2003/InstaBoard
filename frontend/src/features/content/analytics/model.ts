import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import { contentAnalyticsService } from '@/services/contentAnalytics';
import type { ContentAnalytics } from '@/types/content';
import type { AccountOverview, Campaign, ContentItem, InstagramAccount } from '@/types/domain';
import { contentTypeMeta, formatDuration } from '../contentMeta';
import type { CsvCell } from '../csv';

export interface AnalyticsPageData {
  item: ContentItem;
  analytics: ContentAnalytics | null;
  campaign: Campaign | null;
  account: InstagramAccount | null;
  allContent: ContentItem[];
  overview: AccountOverview;
}

/** Loads everything the Content Analytics page needs. Rejects with NotFoundError for unknown ids. */
export async function loadAnalyticsPage(contentId: string): Promise<AnalyticsPageData> {
  const [item, analytics, allContent, campaigns, accounts, overview] = await Promise.all([
    contentService.get(contentId),
    contentAnalyticsService.get(contentId),
    contentService.list(),
    campaignService.list(),
    accountService.list(),
    accountService.overview(),
  ]);
  return {
    item,
    analytics,
    allContent,
    campaign: campaigns.find((c) => c.id === item.campaignId) ?? null,
    account: accounts.find((a) => a.id === item.accountId) ?? null,
    overview,
  };
}

/** 1-based rank of an item within all content for a metric (descending). */
export function rankOf(item: ContentItem, all: ContentItem[], metric: 'views' | 'leads'): number {
  return [...all].sort((a, b) => b.metrics[metric] - a.metrics[metric]).findIndex((c) => c.id === item.id) + 1;
}

/** Total watch hours derived from canonical views × average watch seconds. */
export const watchHours = (views: number, avgWatchSec: number) => (views * avgWatchSec) / 3600;

export function metricsCsvRows({ item, analytics, campaign }: AnalyticsPageData): CsvCell[][] {
  const m = item.metrics;
  const rows: CsvCell[][] = [
    ['# Eko InstaBoard — content metrics export (DEMO DATA, not retrieved from Instagram)'],
    ['Field', 'Value'],
    ['Content ID', item.id],
    ['Title', item.title],
    ['Format', contentTypeMeta[item.type].label],
    ['Campaign', campaign?.name ?? 'Organic (no campaign)'],
    ['Published', item.publishedAt],
    ['Duration', item.durationSec !== undefined ? formatDuration(item.durationSec) : ''],
    ['Slides', item.slides ?? ''],
    ['Views', m.views],
    ['Reach', m.reach],
    ['Likes', m.likes],
    ['Comments', m.comments],
    ['Shares', m.shares],
    ['Saves', m.saves],
    ['Engagement rate (%)', m.engagementRate],
    ['Leads', m.leads],
    ['Completion rate (%)', m.retention ?? ''],
  ];
  if (analytics?.watch) {
    rows.push(['Average watch time (s)', analytics.watch.avgWatchSec]);
    rows.push(['Total watch time (hrs)', Number(watchHours(m.views, analytics.watch.avgWatchSec).toFixed(1))]);
    rows.push([]);
    rows.push(['Second', 'Retention (%)', 'Benchmark (%)']);
    analytics.watch.retention.forEach((p) => rows.push([p.second, p.retention, p.benchmark]));
  }
  return rows;
}
