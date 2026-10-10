import { audienceSummary } from '@/data/audience';
import { audienceIntelligence } from '@/data/audienceIntelligence';
import { fromSource } from '@/lib/api/source';

/** The Audience screen conversion may add methods here; keep `summary` stable (used by Dashboard / Campaign Detail). */
export const audienceService = {
  summary: () => fromSource(() => audienceSummary, '/audience/summary'),

  /** Extra breakdowns for the Audience Intelligence screen (segments, cities, growth series, AI analysis). */
  intelligence: () => fromSource(() => audienceIntelligence, '/audience/intelligence'),
};
