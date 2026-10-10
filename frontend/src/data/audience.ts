import type { AudienceSummary } from '@/types/audience';

/**
 * DEMO DATA — canonical audience summary for @ekoindia, Oct 2024 (Audience Intelligence screen).
 * Dashboard and Campaign Detail snapshots read from this object so the three screens agree.
 * The Audience screen conversion may add further exports to this file; keep `audienceSummary` stable.
 */
export const audienceSummary: AudienceSummary = {
  followers: 86_400,
  followerGrowthPct: 4.2,
  netNewFollowers: 3_490,
  nonFollowerReachPct: 62,
  engagedAudience: 184_000,
  gender: { male: 50, female: 48, unknown: 2 },
  age: [
    { label: '13–17', share: 4, audience: 7_400, deltaPct: -0.4 },
    { label: '18–24', share: 22, audience: 40_500, deltaPct: 1.8, note: 'Students / first-time job' },
    { label: '25–34', share: 38, audience: 69_900, deltaPct: 3.4, note: 'Key operator demographic' },
    { label: '35–44', share: 24, audience: 44_200, deltaPct: 0.2, note: 'Established retailers' },
    { label: '45–54', share: 8, audience: 14_700, deltaPct: -0.5 },
    { label: '55+', share: 4, audience: 7_400, deltaPct: -0.1 },
  ],
  topStates: [
    { label: 'Uttar Pradesh', share: 34, reach: 482_000, engaged: 28_400, leads: 74 },
    { label: 'Haryana', share: 18, reach: 255_000, engaged: 14_100, leads: 38 },
    { label: 'Delhi NCR', share: 15, reach: 213_000, engaged: 11_200, leads: 31 },
    { label: 'Bihar', share: 11, reach: 156_000, engaged: 8_400, leads: 24 },
    { label: 'Rajasthan', share: 8, reach: 113_000, engaged: 6_100, leads: 14 },
    { label: 'Other Regions', share: 14, reach: 198_000, engaged: 8_200, leads: 5 },
  ],
};
