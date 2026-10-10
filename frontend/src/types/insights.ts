import type { ID } from './domain';

/**
 * AI Insights entities. Text fields may contain light inline markup rendered by the UI:
 * `[[b:bold]]`, `[[pos:positive emphasis]]`, `[[neg:negative emphasis]]`.
 */

export type InsightCategory = 'campaign' | 'content' | 'audience' | 'comments' | 'leads';
export type InsightPriority = 'high' | 'medium' | 'low';
export type InsightStatus = 'new' | 'reviewed' | 'dismissed';

export interface InsightLink {
  label: string;
  to: string;
  primary?: boolean;
}

export interface TelemetryRow {
  label: string;
  primary: string;
  primaryNote?: string;
  comparison: string;
  comparisonNote?: string;
  delta: string;
  /** Visual emphasis for key rows (e.g. leads). */
  emphasis?: boolean;
  /** Colour of the delta. */
  deltaTone?: 'positive' | 'negative' | 'neutral';
}

export interface InsightTelemetry {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryIcon: string;
  comparisonLabel: string;
  comparisonIcon: string;
  rows: TelemetryRow[];
  retention?: {
    title: string;
    headline: string;
    segments: Array<{ width: number; tone: 'active' | 'primary' | 'muted'; title: string }>;
    notes: Array<{ range: string; text: string }>;
  };
}

export interface ReasoningFactor {
  title: string;
  icon: string;
  tone: 'amber' | 'blue' | 'emerald';
  text: string;
}

export interface InsightReasoning {
  factors: ReasoningFactor[];
  confidenceNote: string;
  errorMargin: string;
}

export interface ActionStep {
  id: ID;
  title: string;
  tag: string;
  tagTone: 'ai' | 'positive' | 'primary';
  description: string;
}

export interface InsightDetail {
  telemetry?: InsightTelemetry;
  reasoning?: InsightReasoning;
  steps?: ActionStep[];
  quickLinks?: InsightLink[];
  artifacts?: {
    campaignId?: ID;
    primaryContentId?: ID;
    primaryMediaUrl?: string;
    primaryMediaAlt?: string;
    comparisonContentId?: ID;
    /** Show the campaign's lead funnel (leadService.campaignFunnel). */
    funnelCampaignId?: ID;
  };
  /** Comment ids from the Comments Intelligence store. */
  evidenceCommentIds?: ID[];
  audit: { operator: string; trigger: string; modelVersion: string; lastCheck: string };
}

export interface Insight {
  id: ID;
  category: InsightCategory;
  priority: InsightPriority;
  /** Model confidence 0-100. */
  confidence: number;
  title: string;
  observed: string;
  interpretation: string;
  impact: { text: string; icon: string; tone: 'positive' | 'warning'; predictive?: boolean };
  primaryLink: InsightLink;
  generatedAt: string;
  status: InsightStatus;
  completedStepIds: ID[];
  detail?: InsightDetail;
}

export type ActionStatus = 'pending_review' | 'reviewed' | 'done' | 'dismissed';

export interface RecommendedAction {
  id: ID;
  priority: InsightPriority;
  title: string;
  rationale: string;
  metric: string;
  metricNote: string;
  metricNoteTone?: 'negative' | 'muted';
  impact: string;
  target: InsightLink;
  insightId: ID;
  status: ActionStatus;
  feedback?: string;
}

export interface InsightsOverview {
  engineVersion: string;
  generatedAt: string;
  periodLabel: string;
  executive: { overall: string; positive: string; concern: string; recommendation: string };
  kpis: {
    synthesizedCampaigns: number;
    peakCampaignLabel: string;
    baselineLiftLabel: string;
    leadSignals: number;
    leadSignalsDeltaLabel: string;
    avgCplLabel: string;
    modelConfidence: number;
    modelBasisLabel: string;
    attributionDriftLabel: string;
    resolutionPaceLabel: string;
  };
  disclaimer: string;
}
