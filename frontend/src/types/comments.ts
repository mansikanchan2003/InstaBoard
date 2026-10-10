import type { ID, ISODate } from './domain';

/** Comments Intelligence entities (Instagram comments + AI triage). */

export type CommentSentiment = 'positive' | 'neutral' | 'negative';

export type CommentIntent = 'application' | 'eligibility' | 'product' | 'information' | 'feedback' | 'complaint' | 'other';

export type LeadPotential = 'high' | 'medium' | 'low';

/**
 * Local triage status. `needs_response` comments make up the "awaiting review" queue
 * (sidebar badge). Replies are never posted to Instagram from the prototype.
 */
export type CommentStatus = 'needs_response' | 'reviewed' | 'responded' | 'resolved' | 'lead_created' | 'archived';

export interface CommentAiAnalysis {
  summary: string;
  /** Commercial intent probability 0-100. */
  commercialIntent: number;
  /** Short qualifier shown next to commercial intent, e.g. "Space Qualified: Yes (>100 sq ft)". */
  qualifierLabel: string;
  qualifierValue: string;
  priorityTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
}

export interface InstagramComment {
  id: ID;
  /** Human readable reference, e.g. "#IG-CM-91823". */
  ref: string;
  authorName: string;
  /** Instagram handle without the @. Reuses lead handles where the commenter is already a lead. */
  handle: string;
  location?: string;
  verified?: boolean;
  text: string;
  /** Phrases inside `text` the AI highlighted as intent signals. */
  highlights: string[];
  contentId: ID;
  campaignId: ID | null;
  accountId: ID;
  /** ISO datetime (IST) the comment was received. */
  receivedAt: string;
  /** Relative label for the sample, e.g. "24 mins ago". */
  receivedLabel: string;
  surface: 'Reels Comment' | 'Post' | 'Carousel' | 'Instagram App' | 'Video Reel';
  language: string;
  sentiment: CommentSentiment;
  intent: CommentIntent;
  leadPotential: LeadPotential;
  /** AI intent score 0-100. */
  intentScore: number;
  status: CommentStatus;
  flagged: boolean;
  /** Set when the comment was converted (or linked) to a lead. */
  leadId?: ID;
  suggestedReply: string;
  ai: CommentAiAnalysis;
}

export interface SentimentTotals {
  positive: number;
  neutral: number;
  negative: number;
}

export interface IntentBucket {
  intent: CommentIntent;
  label: string;
  comments: number;
  /** AI-estimated potential leads within this intent. */
  potentialLeads: number;
  tag?: { label: string; tone: 'amber' | 'ai' };
}

export interface ResponseQueueBucket {
  label: string;
  sublabel: string;
  count: number;
  intent: CommentIntent | 'general';
  tone: 'primary' | 'ai' | 'neutral';
}

export interface StrategicIntelItem {
  label: string;
  tone: 'positive' | 'primary' | 'negative';
  text: string;
  emphasis: string;
}

/** Aggregate comment analytics for the reporting window (Oct 1–31 2024, @ekoindia). */
export interface CommentSummary {
  accountId: ID;
  period: { start: ISODate; end: ISODate };
  totalComments: number;
  totalDeltaPct: number;
  baselineComments: number;
  sentiment: SentimentTotals;
  potentialLeads: number;
  potentialLeadsDeltaLabel: string;
  /** Comments awaiting a staff reply/review (sidebar badge). */
  needsResponse: number;
  responded: number;
  resolved: number;
  avgSentimentScore: number;
  avgSentimentDeltaPts: number;
  classificationConfidence: number;
  intents: IntentBucket[];
  responseQueue: ResponseQueueBucket[];
  strategicIntel: StrategicIntelItem[];
  strategicIntelConfidence: number;
  peakNote: string;
}

export interface SentimentTrendPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  /** Average sentiment score 0-100 for the day. */
  score: number;
}

export interface CommentListResult {
  /** The sample rows available in demo data (not the full 6,410 comments). */
  items: InstagramComment[];
  sampleSize: number;
  totalComments: number;
}
