import { accountService } from '@/services/accounts';
import { audienceService } from '@/services/audience';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import type { AudienceIntelligence, AudienceSummary } from '@/types/audience';
import type { AccountOverview, Campaign, ContentItem } from '@/types/domain';

export interface AudiencePageData {
  summary: AudienceSummary;
  intel: AudienceIntelligence;
  overview: AccountOverview;
  campaigns: Campaign[];
  content: ContentItem[];
}

export interface AudienceFilters {
  campaignId: string;
  contentId: string;
  compare: boolean;
}

export const initialAudienceFilters: AudienceFilters = { campaignId: 'all', contentId: 'all', compare: true };

export async function loadAudiencePage(): Promise<AudiencePageData> {
  const [summary, intel, overview, campaigns, content] = await Promise.all([
    audienceService.summary(),
    audienceService.intelligence(),
    accountService.overview(),
    campaignService.list(),
    contentService.list(),
  ]);
  return { summary, intel, overview, campaigns, content };
}

/** "+14.2%" / "−0.4%" with the true minus sign. */
export const signedPct = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}%`;
