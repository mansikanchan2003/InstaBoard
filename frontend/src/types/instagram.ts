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

export type SyncJobStatus = 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'retrying' | 'failed' | 'cancelled';

/** Durable background sync job (GET /sync-jobs/{id}). */
export interface SyncJob {
  id: string;
  accountId: string;
  trigger: 'connect' | 'manual' | 'scheduled';
  status: SyncJobStatus;
  terminal: boolean;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: number;
  progressStage: string | null;
  recordsProcessed: number;
  mediaFetched: number;
  mediaInsightsFetched: number;
  accountInsightsFetched: number;
  commentsFetched: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  cancelRequested: boolean;
  warnings: Array<{ code: string; message: string }>;
  errorCategory: string | null;
  errorMessage: string | null;
  apiVersion: string;
}

export interface EnqueuedJob {
  job: SyncJob;
  /** An identical job was already queued/running; no new job was created. */
  deduplicated: boolean;
}

export interface SyncStatus {
  accountId: string;
  connectionStatus: LiveConnectionStatus;
  lastSuccessAt: string | null;
  lastSyncStatus: string | null;
  currentJob: SyncJob | null;
  lastJob: SyncJob | null;
  nextScheduledAt: string | null;
  schedulingEnabled: boolean;
  intervalMinutes: number;
  backgroundAvailable: boolean;
}

export interface HistorySeries {
  metric: string;
  kind: 'daily_snapshot' | 'daily' | 'rolling_28d';
  unit: string;
  /** value null = no observation that day (a gap — never interpolated). */
  points: Array<{ date: string; value: number | null }>;
  observedDays: number;
}

export interface AccountHistory {
  source: 'instagram_api';
  days: number;
  firstObservationAt: string | null;
  series: HistorySeries[];
  note: string;
}

export interface MediaHistory {
  mediaId: string;
  igMediaId: string;
  unsupportedMetrics: string[];
  series: Array<{ metric: string; unit: string; points: Array<{ observedAt: string; value: number | null }> }>;
}
