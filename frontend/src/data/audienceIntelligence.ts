import type { AudienceIntelligence, FollowerGrowthPoint } from '@/types/audience';
import { audienceSummary } from './audience';

/**
 * DEMO DATA — Audience Intelligence breakdowns for @ekoindia, Oct 2024 (vs Sep baseline).
 * Headline figures (followers, gender, age, states) come from `audienceSummary`; account totals
 * (views 2.84M, reach 1.42M, engagement 4.82%) from src/data/overview.ts. This file only holds the
 * extra breakdowns shown on the Audience screen.
 *
 * Lead attribution: 186 of the period's 482 leads carry audience attributes (follower status,
 * age bracket, location). Every breakdown on this screen sums to that attributed total, matching
 * the canonical `audienceSummary.topStates` lead counts.
 */

const ATTRIBUTED_LEADS = audienceSummary.topStates.reduce((sum, s) => sum + s.leads, 0); // 186

/**
 * Daily follower totals. Generated deterministically: October net adds (+3,490) are weighted
 * towards the Oct 24 surge; September (+2,690) grows smoothly. Ends at the canonical 86.4K.
 */
function buildFollowerGrowth(): FollowerGrowthPoint[] {
  const days = 31;
  const octNet = audienceSummary.netNewFollowers;
  const octStart = audienceSummary.followers - octNet;
  const sepNet = 2_690;
  const sepStart = octStart - sepNet;
  const weights = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    return 1 + 0.025 * i + 0.18 * Math.sin(i / 1.7) + 2.4 * Math.exp(-((day - 24) ** 2) / 3.5);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let running = octStart;
  return weights.map((w, i) => {
    running += (w / total) * octNet;
    const sepDay = Math.min(i + 1, 30);
    const sepProgress = sepDay / 30;
    return {
      date: `Oct ${i + 1}`,
      current: i === days - 1 ? audienceSummary.followers : Math.round(running),
      previous: Math.round(sepStart + sepNet * (0.85 * sepProgress + 0.15 * sepProgress ** 2)),
    };
  });
}

export const audienceIntelligence: AudienceIntelligence = {
  kpis: {
    engagedAudienceBaseline: 164_000,
    engagedAudienceDeltaPct: 11.8,
    nonFollowerDeltaPct: 8.4,
    newFollowersGross: 8_412,
    newFollowersDeltaPct: 18.5,
  },
  attributedLeads: ATTRIBUTED_LEADS,
  followerSplit: [
    {
      metric: 'views',
      label: 'Video Views',
      icon: 'play_circle',
      followers: 1_080_000,
      nonFollowers: 1_760_000,
      total: 2_840_000,
      context: '62% non-follower view proportion fueled by short-form recruitment tutorials',
    },
    {
      metric: 'reach',
      label: 'Unique Reach',
      icon: 'person_search',
      followers: 540_000,
      nonFollowers: 880_000,
      total: 1_420_000,
      context: 'Non-follower reach expanded +8.4% month-over-month',
    },
    {
      metric: 'engagementRate',
      label: 'Engagement Rate',
      icon: 'percent',
      followers: 6.12,
      nonFollowers: 4.02,
      total: 4.82,
      context: 'Existing followers exhibit significantly higher brand loyalty and repeat comments',
    },
    {
      metric: 'leads',
      label: 'Attributed Leads',
      icon: 'badge',
      followers: 74,
      nonFollowers: 112,
      total: ATTRIBUTED_LEADS,
      context: 'Non-followers convert at high absolute volumes via CSP Mitra recruitment Reels',
    },
  ],
  discoveryNote: { nonFollowerInquiryPct: 58 },
  cities: [
    { city: 'Lucknow (UP)', reach: 142_000, leads: 28, conversionPct: 10.4 },
    { city: 'Delhi Central', reach: 128_000, leads: 19, conversionPct: 8.1 },
    { city: 'Kanpur (UP)', reach: 88_000, leads: 16, conversionPct: 9.8 },
    { city: 'Bareilly (UP)', reach: 84_000, leads: 18, conversionPct: 11.2 },
    { city: 'Noida (UP)', reach: 76_000, leads: 12, conversionPct: 7.9 },
    { city: 'Gurugram (HR)', reach: 64_000, leads: 9, conversionPct: 6.5 },
    { city: 'Jaipur (RJ)', reach: 62_000, leads: 8, conversionPct: 5.8 },
  ],
  primaryMarket: 'North & Central India',
  segments: [
    { id: 'age-25-34', label: '25–34 Years Old', reach: 541_000, engagedUsers: 31_800, engagementRate: 5.88, leads: 94, conversionRate: 9.4, impact: 'top' },
    { id: 'age-18-24', label: '18–24 Years Old', reach: 312_000, engagedUsers: 14_200, engagementRate: 4.55, leads: 42, conversionRate: 8.2, impact: 'high' },
    { id: 'age-35-44', label: '35–44 Years Old', reach: 341_000, engagedUsers: 18_100, engagementRate: 5.31, leads: 37, conversionRate: 7.8, impact: 'stable' },
    { id: 'age-45-54', label: '45–54 Years Old', reach: 126_000, engagedUsers: 5_400, engagementRate: 4.29, leads: 9, conversionRate: 5.1, impact: 'moderate' },
    { id: 'age-55-plus', label: '55+ Years Old', reach: 57_000, engagedUsers: 2_300, engagementRate: 4.04, leads: 4, conversionRate: 4.3, impact: 'low' },
    { id: 'age-13-17', label: '13–17 Years Old', reach: 43_000, engagedUsers: 1_900, engagementRate: 4.42, leads: 0, conversionRate: 0, impact: 'not_targeted' },
  ],
  followerGrowth: buildFollowerGrowth(),
  growthPeak: { date: 'Oct 24', label: 'Oct 24 (CSP Reel Surge)' },
  aiAnalysis: [
    {
      icon: 'trending_up',
      iconClassName: 'text-amber-500',
      title: 'Audience Trend',
      body: '25–34 year-old viewers are currently the strongest engagement segment, with +3.4% cohort growth driven by entrepreneurial career narratives.',
    },
    {
      icon: 'map',
      iconClassName: 'text-status-completed',
      title: 'Geographic Trend',
      body: 'Uttar Pradesh is contributing the highest audience volume and lead count (74 leads), particularly from Tier 2/3 clusters like Bareilly and Lucknow.',
    },
    {
      icon: 'rocket_launch',
      iconClassName: 'text-primary',
      title: 'Growth Opportunity',
      body: 'Non-followers account for 62% of reach, proving that short-form educational Reels are driving substantial top-of-funnel acquisition.',
    },
    {
      icon: 'psychology',
      iconClassName: 'text-ai-accent',
      title: 'Actionable Recommendation',
      body: 'Prioritize content themes focused on SBI CSP eligibility and commission breakdown tailored for Uttar Pradesh and Bihar audiences to maximize lead conversion.',
      recommendation: true,
    },
  ],
  personas: [
    { name: 'Aspiring CSP Entrepreneur', score: 92, sharePct: 31, potential: 'High Lead Potential', interest: 'SBI CSP Mitra Recruitment Reel' },
    { name: 'Small Business Owner', score: 85, sharePct: 24, potential: 'High Lead Potential', interest: 'Kiosk banking commission structures' },
    { name: 'Salaried Professional', sharePct: 18, potential: 'Moderate Lead Potential', interest: 'Financial literacy & digital savings' },
    { name: 'Rural Digital Services User', sharePct: 15, potential: 'Moderate Lead Potential', interest: 'AePS & domestic remittance services' },
    { name: 'Student / Young Adult', sharePct: 12, potential: 'Awareness Phase', interest: 'Career opportunities & fintech tutorials' },
  ],
  contentPreferences: [
    {
      segmentId: 'age-25-34',
      title: '25–34 Segment (Core)',
      tone: 'amber',
      intent: 'Business Creation',
      topFormat: 'SBI CSP Recruitment Reels (Vertical 9:16)',
      runnerUp: 'Business Commission Breakdown (Carousel Guides)',
      topic: 'Eligibility Criteria & Daily Earning Estimates',
      topContentId: 'sbi-csp-mitra-reel',
    },
    {
      segmentId: 'age-18-24',
      title: '18–24 Segment (Growth)',
      tone: 'blue',
      intent: 'Digital Literacy',
      topFormat: 'Short Educational Reels (<30s Explainer)',
      runnerUp: 'Digital Banking Awareness Carousel (Infographics)',
      topic: 'Fintech 101, AePS Safety & UPI Scam Awareness',
      topContentId: 'digital-banking-rural-india',
    },
  ],
  campaignProfiles: [
    {
      campaignId: 'sbi-csp-october',
      flightLabel: 'Campaign Flight A',
      nonFollowerPct: 62,
      coreAge: { label: '25-34', share: 38 },
      dominantState: { label: 'UP', share: 34 },
    },
    {
      campaignId: 'digital-banking-awareness',
      flightLabel: 'Campaign Flight B',
      nonFollowerPct: 45,
      coreAge: { label: '18-24', share: 28 },
      dominantState: { label: 'Delhi', share: 22 },
    },
  ],
};
