import { apiClient } from '@/lib/api/client';
import type {
  AccountHistory, AccountInsights, EnqueuedJob, InstagramComment, InstagramConnection, InstagramMedia, IntegrationStatus, MediaHistory, SyncJob, SyncStatus,
} from '@/types/instagram';

const base = '/integrations/instagram';
const acc = (id: string) => `${base}/accounts/${encodeURIComponent(id)}`;

/**
 * Live Instagram integration (api mode only). The OAuth flow, tokens and Meta calls all live on the server:
 * `connect()` only returns the official authorization URL to navigate to. Syncs run in a background worker:
 * `sync()` queues a job and the UI polls `job()` until it reaches a terminal state.
 */
export const instagramService = {
  status: () => apiClient.get<IntegrationStatus>(`${base}/status`),
  connect: () => apiClient.post<{ authorizationUrl: string; expiresInSeconds: number }>(`${base}/connect`),
  accounts: () => apiClient.get<InstagramConnection[]>(`${base}/accounts`),
  account: (id: string) => apiClient.get<InstagramConnection>(acc(id)),
  media: (id: string) => apiClient.get<InstagramMedia[]>(`${acc(id)}/media?limit=50`),
  insights: (id: string) => apiClient.get<AccountInsights>(`${acc(id)}/insights`),
  comments: (id: string) => apiClient.get<InstagramComment[]>(`${acc(id)}/comments?limit=50`),
  syncHistory: (id: string) => apiClient.get<SyncJob[]>(`${acc(id)}/sync-history`),
  syncStatus: (id: string) => apiClient.get<SyncStatus>(`${acc(id)}/sync-status`),
  history: (id: string, days = 90) => apiClient.get<AccountHistory>(`${acc(id)}/history?days=${days}`),
  mediaHistory: (id: string, mediaId: string) => apiClient.get<MediaHistory>(`${acc(id)}/media/${encodeURIComponent(mediaId)}/history`),
  /** Queues a background sync and returns at once (or returns the job already queued/running). */
  sync: (id: string) => apiClient.post<EnqueuedJob>(`${acc(id)}/sync`),
  job: (jobId: string) => apiClient.get<SyncJob>(`/sync-jobs/${encodeURIComponent(jobId)}`),
  cancelJob: (jobId: string) => apiClient.post<SyncJob>(`/sync-jobs/${encodeURIComponent(jobId)}/cancel`),
  disconnect: (id: string) => apiClient.post<InstagramConnection>(`${acc(id)}/disconnect`),
};
