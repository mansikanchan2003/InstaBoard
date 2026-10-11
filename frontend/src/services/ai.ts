import { apiClient } from '@/lib/api/client';
import type { AIJob, AIStatus, CampaignAnalytics, CommentClassification, CommentLabels, EnqueuedAIJob, LeadAISummary, LeadPriorities } from '@/types/ai';

/**
 * AI intelligence (api mode only). Expensive work is queued as background jobs; the UI polls ``job()``.
 * Deterministic analytics and lead priorities work even when AI is disabled.
 */
export const aiService = {
  status: () => apiClient.get<AIStatus>('/ai/status'),
  job: (id: string) => apiClient.get<AIJob>(`/ai/jobs/${encodeURIComponent(id)}`),
  jobs: (kind?: AIJob['kind']) => apiClient.get<AIJob[]>(`/ai/jobs${kind ? `?kind=${kind}` : ''}`),
  generateInsights: (period?: { start: string; end: string }) => apiClient.post<EnqueuedAIJob>('/insights/regenerate', period),
  campaignAnalytics: (period?: { start: string; end: string }) =>
    apiClient.get<CampaignAnalytics>(`/analytics/campaigns${period ? `?start=${period.start}&end=${period.end}` : ''}`),
  classifyComments: (commentIds?: string[]) => apiClient.post<EnqueuedAIJob>('/ai/comments/classify', { source: 'workspace', ...(commentIds ? { commentIds } : {}) }),
  classifications: (commentIds?: string[]) =>
    apiClient.get<CommentClassification[]>(`/ai/comments/classifications?source=workspace${commentIds?.length ? `&commentIds=${commentIds.map(encodeURIComponent).join(',')}` : ''}`),
  reviewClassification: (id: string, body: { reviewStatus: 'confirmed' | 'corrected' } & Partial<Pick<CommentLabels, 'sentiment' | 'intent' | 'leadSignal'>>) =>
    apiClient.patch<CommentClassification>(`/ai/comments/classifications/${encodeURIComponent(id)}`, body),
  leadPriorities: () => apiClient.get<LeadPriorities>('/ai/leads/priorities'),
  requestLeadSummary: (leadId: string) => apiClient.post<EnqueuedAIJob>(`/ai/leads/${encodeURIComponent(leadId)}/summary`),
  leadSummary: (leadId: string) => apiClient.get<LeadAISummary | null>(`/ai/leads/${encodeURIComponent(leadId)}/summary`),
};
