import { contentAnalytics } from '@/data/contentAnalytics';
import { fromSource } from '@/lib/api/source';
import type { ContentAnalytics } from '@/types/content';

export const contentAnalyticsService = {
  /** Detailed breakdowns for one content item, or null when the demo dataset has none. */
  get: (contentId: string) => fromSource<ContentAnalytics | null>(() => contentAnalytics[contentId] ?? null, `/content/${contentId}/analytics`),
};
