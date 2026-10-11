/** Phase 7 AI intelligence (api mode). Never contains provider keys or prompts. */

export interface EvidenceFact {
  id: string;
  label: string;
  value: number | null;
  display: string;
  unit: 'count' | 'percent' | 'per_1000';
  kind: 'measured' | 'calculated' | 'comparison';
  definition: string;
  periodStart: string;
  periodEnd: string;
  sampleSize: number;
  missing: number;
  sufficient: boolean;
  source: 'demo_dataset' | 'workspace_data' | 'instagram_api';
  scope: { type: string; id?: string; name?: string };
  note: string | null;
}

/** `insight.ai` — present only on AI-generated insights. */
export interface InsightAI {
  generated: true;
  provider: string;
  model: string;
  promptVersion: string;
  evidenceQuality: 'high' | 'medium' | 'low';
  evidence: EvidenceFact[];
  summary: string;
  explanation: string;
  recommendedAction: string;
  period: { start: string; end: string };
  sources: string[];
  generatedAt: string;
  expiresAt: string;
}

export type AIJobStatus = 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'retrying' | 'failed' | 'cancelled';

export interface AIJob {
  id: string;
  kind: 'insights' | 'comment_classification' | 'lead_summary';
  status: AIJobStatus;
  terminal: boolean;
  trigger: string;
  params: Record<string, unknown>;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: number;
  progressStage: string | null;
  result: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  errorCategory: string | null;
  errorMessage: string | null;
}

export interface EnqueuedAIJob {
  job: AIJob;
  deduplicated: boolean;
}

export interface AIStatus {
  enabled: boolean;
  provider: string;
  model: string | null;
  capabilities: string[];
  usage: { tokensMonth: number; requestsToday: number; requestsMonth: number; failuresMonth: number; avgLatencyMs: number | null };
  limits: Record<string, number | null>;
  limitsNote: string;
  scheduledInsights: boolean;
}

export type CommentIntentLabel = 'product_inquiry' | 'pricing_inquiry' | 'contact_request' | 'interest' | 'complaint_support' | 'spam_irrelevant' | 'other';

export interface CommentLabels {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: CommentIntentLabel;
  leadSignal: boolean;
  priority?: 'high' | 'medium' | 'low';
  uncertainty?: 'low' | 'medium' | 'high';
  explanation?: string;
}

export interface CommentClassification {
  id: string;
  source: 'workspace' | 'instagram';
  commentId: string;
  classifierVersion: string;
  prediction: Required<CommentLabels>;
  injectionSuspected: boolean;
  reviewStatus: 'unreviewed' | 'confirmed' | 'corrected';
  reviewed: Partial<CommentLabels> | null;
  reviewedAt: string | null;
  effective: Required<CommentLabels>;
  createdAt: string;
}

export interface LeadAISummary {
  id: string;
  leadId: string;
  summary: string;
  followUpReason: string;
  suggestedNextAction: string;
  uncertainty: 'low' | 'medium' | 'high';
  injectionSuspected: boolean;
  version: string;
  createdAt: string;
}

export interface LeadPriorities {
  generatedAt: string;
  definition: string;
  dataNote: string | null;
  waitingForContact: Array<{ leadId: string; name: string; campaign: string | null; daysWaiting: number; recordedAt: string }>;
  newLeadsTotal: number;
  byCampaign: Array<{ campaignId: string; campaign: string; total: number; statuses: Record<string, number> }>;
  byContent: Array<{ contentId: string; title: string; leads: number }>;
  statusNote: string;
}

export interface CampaignAnalytics {
  periodStart: string;
  periodEnd: string;
  previousStart: string;
  previousEnd: string;
  facts: EvidenceFact[];
  campaigns: Array<Record<string, unknown> & { campaignId: string; name: string; posts: number; engagementRate: number | null; engagementRateSufficient: boolean; leads: number; leadYield: number | null }>;
  formats: Array<{ type: string; items: number; engagementRate: number | null; sufficient: boolean }>;
  comparisons: Array<Record<string, unknown>>;
  insufficient: string[];
  sources: string[];
  definitions: Record<string, string>;
  thresholds: { minItems: number; minLeads: number; notableChangePct: number };
  evidenceHash: string;
}
