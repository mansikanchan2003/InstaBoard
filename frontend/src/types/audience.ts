/** Audience entities (Audience Intelligence + snapshots on Dashboard / Campaign Detail). */
export interface ShareItem {
  label: string;
  /** Percent share 0-100. */
  share: number;
}

export interface AudienceSummary {
  followers: number;
  followerGrowthPct: number;
  netNewFollowers: number;
  nonFollowerReachPct: number;
  engagedAudience: number;
  gender: { male: number; female: number; unknown: number };
  age: Array<ShareItem & { audience: number; deltaPct: number; note?: string }>;
  topStates: Array<ShareItem & { reach: number; engaged: number; leads: number }>;
}

/* ------------------------- Audience Intelligence extras ------------------------- */

export interface AudienceKpiExtras {
  engagedAudienceBaseline: number;
  engagedAudienceDeltaPct: number;
  /** Percentage-point change of the non-follower reach share vs September. */
  nonFollowerDeltaPct: number;
  /** Gross followers acquired in the period (net growth is in AudienceSummary). */
  newFollowersGross: number;
  newFollowersDeltaPct: number;
}

export type FollowerSplitMetric = 'views' | 'reach' | 'engagementRate' | 'leads';

export interface FollowerSplitRow {
  metric: FollowerSplitMetric;
  label: string;
  icon: string;
  followers: number;
  nonFollowers: number;
  total: number;
  context: string;
}

export interface CityRow {
  city: string;
  reach: number;
  leads: number;
  conversionPct: number;
}

export type SegmentImpact = 'top' | 'high' | 'stable' | 'moderate' | 'low' | 'not_targeted';

export interface AudienceSegmentRow {
  id: string;
  label: string;
  reach: number;
  engagedUsers: number;
  engagementRate: number;
  leads: number;
  conversionRate: number;
  impact: SegmentImpact;
}

export interface FollowerGrowthPoint {
  date: string;
  /** Total followers at end of day (October). */
  current: number;
  /** Total followers on the matching September day (baseline). */
  previous: number;
}

export interface AudienceAiItem {
  icon: string;
  iconClassName: string;
  title: string;
  body: string;
  recommendation?: boolean;
}

export interface AudiencePersona {
  name: string;
  score?: number;
  sharePct: number;
  potential: string;
  interest: string;
}

export interface ContentPreference {
  segmentId: string;
  title: string;
  tone: 'amber' | 'blue';
  intent: string;
  topFormat: string;
  runnerUp: string;
  topic: string;
  topContentId: string;
}

/** Per-campaign audience profile (only for campaigns the export compares). */
export interface CampaignAudienceProfile {
  campaignId: string;
  flightLabel: string;
  nonFollowerPct: number;
  coreAge: { label: string; share: number };
  dominantState: { label: string; share: number };
}

export interface AudienceIntelligence {
  kpis: AudienceKpiExtras;
  /** Leads with resolvable audience attributes (follower status / age / location). */
  attributedLeads: number;
  followerSplit: FollowerSplitRow[];
  discoveryNote: { nonFollowerInquiryPct: number };
  cities: CityRow[];
  primaryMarket: string;
  segments: AudienceSegmentRow[];
  followerGrowth: FollowerGrowthPoint[];
  growthPeak: { date: string; label: string };
  aiAnalysis: AudienceAiItem[];
  personas: AudiencePersona[];
  contentPreferences: ContentPreference[];
  campaignProfiles: CampaignAudienceProfile[];
}
