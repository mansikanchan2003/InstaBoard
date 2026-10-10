import type { ID } from './domain';

/**
 * Per-content deep analytics (Reel / Content Analytics screen). Canonical totals (views, reach,
 * likes, leads…) always come from `ContentItem.metrics`; these types only hold the breakdowns
 * that the content list does not carry. Every section is optional — a missing section renders a
 * "not available in the demo dataset" notice.
 */

export interface RetentionPoint {
  /** Seconds from the start of the video. */
  second: number;
  /** Share of viewers still watching, percent 0-100. */
  retention: number;
  /** Fintech benchmark retention at the same second, percent. */
  benchmark: number;
}

export type TimelineSegmentTone = 'neutral' | 'drop' | 'cta';

/** A labelled stretch of the video timeline ("7s - 10s: Eligibility Criteria Text"). */
export interface TimelineSegment {
  start: number;
  end: number;
  label: string;
  tone: TimelineSegmentTone;
}

export type InsightTone = 'positive' | 'warning' | 'info';

export interface AnalyticsCallout {
  tone: InsightTone;
  title: string;
  body: string;
  tag: string;
}

export interface WatchAnalytics {
  /** Average watch time per view, seconds. Total watch time is derived (views × avg). */
  avgWatchSec: number;
  avgWatchNote: string;
  completionNote: string;
  lengthNote: string;
  /** Retention curve; the last point's retention is the completion rate. */
  retention: RetentionPoint[];
  /** Largest drop-off window highlighted on the chart. */
  dropZone?: { start: number; end: number; label: string };
  /** Hook marker shown on the chart (second at which the hook ends). */
  hookSecond?: number;
  segments: TimelineSegment[];
  insights: AnalyticsCallout[];
  confidencePct: number;
}

export interface DiscoveryAnalytics {
  /** Share of reached accounts that already follow the account, percent. */
  followerSharePct: number;
  traffic: Array<{ label: string; share: number }>;
  profileVisits: number;
  newFollows: number;
}

export interface ContentAudienceSnapshot {
  gender: { male: number; female: number; unknown: number };
  age: Array<{ label: string; share: number; note?: string }>;
  states: Array<{ label: string; share: number }>;
  ruralShareLabel: string;
  alignmentPct: number;
}

export interface ClassifiedComment {
  id: ID;
  handle: string;
  name: string;
  location: string;
  ago: string;
  text: string;
  score: number;
  classification: 'AI-CLASSIFIED' | 'AI-INFERRED';
  sentiment: string;
  intent: string;
  potential: string;
  /** Existing lead in the pipeline, if this commenter was already converted. */
  leadId?: ID;
}

export interface LeadAttribution {
  channels: Array<{ label: string; leads: number; dotClassName: string }>;
  /** Viewers who watched past the engagement threshold (stage 2 of the funnel). */
  engagedViewers: number;
  engagedThresholdLabel: string;
}

export interface PerformanceAudit {
  benchmarkNote: string;
  confidencePct: number;
  scores: Array<{
    label: string;
    value: string;
    detail?: string;
    footnote: string;
    tone: 'positive' | 'neutral' | 'primary';
    /** Detail derived from canonical metrics at render time instead of a stored string. */
    derive?: 'engagementRate' | 'leadsRank';
  }>;
  recommendation: { title: string; body: string; highlights: string[] };
}

export interface ContentAnalytics {
  contentId: ID;
  /** Larger preview frame for the player panel (falls back to the content thumbnail). */
  previewImage?: { url: string; alt: string };
  /** Export resolution label, e.g. "1080×1920". */
  resolution?: string;
  audioLabel?: string;
  /** Percent change of views vs the account's average for this format. */
  viewsDeltaPct?: number;
  /** Percentage-point change of engagement rate vs format average. */
  engagementDeltaPct?: number;
  verdict: { title: string; body: string };
  watch?: WatchAnalytics;
  discovery?: DiscoveryAnalytics;
  audience?: ContentAudienceSnapshot;
  comments?: ClassifiedComment[];
  leadAttribution?: LeadAttribution;
  audit?: PerformanceAudit;
}
