import { apiClient } from '@/lib/api/client';
import type { AccountInsights, InstagramComment, InstagramConnection, InstagramMedia, IntegrationStatus, SyncRun } from '@/types/instagram';

const base = '/integrations/instagram';
const acc = (id: string) => `${base}/accounts/${encodeURIComponent(id)}`;

/**
 * Live Instagram integration (api mode only). The OAuth flow, tokens and Meta calls all live on the server:
 * `connect()` only returns the official authorization URL to navigate to.
 */
export const instagramService = {
  status: () => apiClient.get<IntegrationStatus>(`${base}/status`),
  connect: () => apiClient.post<{ authorizationUrl: string; expiresInSeconds: number }>(`${base}/connect`),
  accounts: () => apiClient.get<InstagramConnection[]>(`${base}/accounts`),
  account: (id: string) => apiClient.get<InstagramConnection>(acc(id)),
  media: (id: string) => apiClient.get<InstagramMedia[]>(`${acc(id)}/media?limit=50`),
  insights: (id: string) => apiClient.get<AccountInsights>(`${acc(id)}/insights`),
  comments: (id: string) => apiClient.get<InstagramComment[]>(`${acc(id)}/comments?limit=50`),
  syncRuns: (id: string) => apiClient.get<SyncRun[]>(`${acc(id)}/sync-runs`),
  sync: (id: string) => apiClient.post<SyncRun>(`${acc(id)}/sync`),
  disconnect: (id: string) => apiClient.post<InstagramConnection>(`${acc(id)}/disconnect`),
};
