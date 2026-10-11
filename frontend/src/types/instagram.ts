/** Live Instagram integration (backend /integrations/instagram/*). Never contains tokens or secrets. */

export interface IntegrationStatus {
  provider: 'instagram_login';
  enabled: boolean;
  missingConfig: string[];
  apiVersion: string | null;
  requestedScopes: string[];
  canManage: boolean;
  connectedAccounts: number;
}

export type LiveConnectionStatus = 'connected' | 'needs_reauth' | 'error' | 'disconnected';

export interface InstagramConnection {
  id: string;
  source: 'instagram_api';
  igUserId: string;
  username: string;
  name: string | null;
  accountType: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  status: LiveConnectionStatus;
  grantedScopes: string[];
  connectedAt: string;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastSyncAttemptAt: string | null;
  lastSyncStatus: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  insightsAvailable: boolean;
  commentsAvailable: boolean;
}

export interface MetricValue {
  metric: string;
  /** null = Instagram did not return this metric (unavailable), never a zero. */
  value: number | null;
  status: 'ok' | 'unavailable';
  period: string;
  capturedAt: string;
}

export interface InstagramMedia {
  id: string;
  igMediaId: string;
  mediaType: string | null;
  mediaProductType: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  postedAt: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  removed: boolean;
  insights: MetricValue[];
  insightsCapturedAt: string | null;
}

export interface AccountMetric {
  metric: string;
  value: number | null;
  status: 'ok' | 'unavailable';
  rangeStart: string;
  rangeEnd: string;
  capturedAt: string;
}

export interface AccountInsights {
  source: 'instagram_api';
  totals: AccountMetric[];
  reachDaily: Array<{ date: string; value: number | null }>;
  unavailableMetrics: string[];
  note: string;
}

export interface InstagramComment {
  id: string;
  igCommentId: string;
  mediaId: string;
  parentIgCommentId: string | null;
  text: string | null;
  username: string | null;
  likeCount: number | null;
  hidden: boolean | null;
  commentedAt: string | null;
}

export interface SyncRun {
  id: string;
  trigger: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  mediaFetched: number;
  mediaInsightsFetched: number;
  accountInsightsFetched: number;
  commentsFetched: number;
  warnings: Array<{ code: string; message: string }>;
  errorCode: string | null;
  errorMessage: string | null;
  apiVersion: string;
}
