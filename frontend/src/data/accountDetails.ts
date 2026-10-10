import type {
  AccountTelemetry,
  AccountsSummaryMeta,
  CapabilityRow,
  ConnectCandidate,
  ConnectPrerequisite,
  RetentionPolicyRow,
  ScopeDefinition,
  SyncLogEntry,
} from '@/types/accounts';

/**
 * DEMO DATA — Instagram Accounts overview / detail / connect flow (from the Stitch exports).
 * No Instagram or Meta account is connected in this prototype: every status, token, quota and
 * sync-log value below is illustrative sample data.
 */

/* ------------------------------------ Scopes ------------------------------------ */

export const scopeCatalog: ScopeDefinition[] = [
  {
    scope: 'instagram_basic',
    mandatory: true,
    connectDescription: 'Read account profile name, handle, official profile picture, bio, and total follower counts.',
    detailDescription: 'Access standard Instagram User ID, handle, and public profile data points.',
  },
  {
    scope: 'instagram_manage_insights',
    mandatory: true,
    connectDescription: 'Retrieve reel/post view counts, reach impressions, engagement metrics, audience retention curves, and demographics.',
    detailDescription: 'Retrieve media views, retention metrics, demographic cohorts, and reach.',
  },
  {
    scope: 'instagram_manage_comments',
    mandatory: true,
    connectDescription: 'Ingest comments for automated NLP sentiment scoring, intent classification, and lead triage in Eko InstaBoard.',
    detailDescription: 'Stream comment webhooks, sentiment moderation, and engagement indexing.',
  },
  {
    scope: 'pages_show_list',
    mandatory: false,
    connectDescription: 'List the Facebook Pages you manage so you can pick the Page linked to your Instagram account.',
    detailDescription: 'Enumerate Facebook Pages tied to the verified Meta business entity.',
  },
];

/* ------------------------------- Overview summary ------------------------------- */

export const accountsSummaryMeta: AccountsSummaryMeta = {
  cadenceLabel: 'Every 6 hours',
  apiHealthPercent: 98.4,
  apiHealthLabel: 'Healthy',
  apiCallsUsed: 420,
  apiCallsLimit: 2000,
  graphApiVersion: 'v19.0',
};

export const rateLimitNotes: string[] = [
  'Reels metrics updated on a 6-hour sliding cadence',
  'Story metrics retained for 24-hours prior to archival',
  'Follower demographics require a minimum of 100 followers per account by Meta privacy protocol',
];

export const retentionPolicy: RetentionPolicyRow[] = [
  { label: 'Token Refresh Schedule:', value: 'Every 60 Days' },
  { label: 'Raw Payload Retention:', value: '90 Days Active' },
  { label: 'AI Sentiment Buffer:', value: 'Continuous Event Stream' },
];

/* ---------------------------------- Telemetry ---------------------------------- */

const ekoIndiaCapabilities: CapabilityRow[] = [
  {
    key: 'profile',
    category: 'Profile & Metadata',
    icon: 'badge',
    endpoints: 'Bio, follower count, business category',
    status: 'available',
    lastUpdated: 'Oct 31, 10:18 AM',
    note: 'Fetched via Graph API v19.0 on each sync',
  },
  {
    key: 'media',
    category: 'Published Media',
    icon: 'perm_media',
    endpoints: 'Feed posts, Reels, Carousel albums',
    status: 'available',
    lastUpdated: 'Oct 31, 10:18 AM',
    note: 'Up to 10,000 historic media objects',
  },
  {
    key: 'watch_time',
    category: 'Video Watch Time & Retention',
    icon: 'play_circle',
    endpoints: 'Total watch time, avg watch time, retention curve',
    status: 'available',
    lastUpdated: 'Oct 31, 10:18 AM',
    note: 'Exclusively available on Instagram Reels',
  },
  {
    key: 'demographics',
    category: 'Audience Demographics',
    icon: 'demography',
    endpoints: 'Age, gender, country, city breakdowns',
    status: 'available',
    lastUpdated: 'Oct 31, 04:00 AM',
    note: 'Aggregated daily; requires >= 100 followers',
  },
  {
    key: 'comments',
    category: 'Comments & Conversation NLP',
    icon: 'forum',
    iconClassName: 'text-ai-accent',
    endpoints: 'Comment text, timestamps, author IDs',
    status: 'available',
    lastUpdated: 'Oct 31, 10:18 AM',
    note: 'Webhook subscriptions planned once the backend is connected',
  },
  {
    key: 'stories',
    category: 'Story Telemetry',
    icon: 'history_toggle_off',
    iconClassName: 'text-status-paused',
    endpoints: 'Impressions, reach, exits, replies',
    status: 'partial',
    lastUpdated: 'Oct 31, 10:18 AM',
    note: '24-hour ephemeral window; historic stories archived',
  },
  {
    key: 'dms',
    category: 'Direct Messages (DMs)',
    icon: 'mark_chat_read',
    iconClassName: 'text-secondary',
    endpoints: 'Private message threads',
    status: 'permission_required',
    lastUpdated: null,
    note: 'Requires additional',
    noteScope: 'instagram_manage_messages',
  },
];

function expiredCapabilities(): CapabilityRow[] {
  return ekoIndiaCapabilities.map((c) =>
    c.key === 'dms'
      ? c
      : { ...c, status: 'unavailable', lastUpdated: 'Oct 12, 2024', note: 'Token expired — reconnect to resume data collection', noteScope: undefined },
  );
}

export const accountTelemetry: AccountTelemetry[] = [
  {
    accountId: 'acc-ekoindia',
    lastSync: { label: 'Oct 31, 2024 at 10:18 AM IST', detail: '(Duration 4.2s)' },
    cadence: { label: 'Every 6 hours', detail: '(Next: 04:18 PM IST)' },
    token: { label: 'Token expires in 56 days', detail: '(Auto-renew planned)', tone: 'active' },
    tiles: [
      {
        key: 'media',
        label: 'Media Telemetry',
        badge: { label: 'Complete', tone: 'active' },
        value: '100%',
        caption: '128 posts & Reels in the sample dataset',
        footLabel: 'Historical feed baseline',
        footValue: '10,000 max',
      },
      {
        key: 'audience',
        label: 'Audience Demographics',
        badge: { label: 'Met', tone: 'active' },
        value: '86.4K',
        caption: 'Followers > 100 threshold met',
        footLabel: 'Demographic cohort sync',
        footValue: 'Daily @ 04:00 IST',
        footTone: 'active',
      },
      {
        key: 'comments',
        label: 'Comments & NLP Stream',
        badge: { label: 'NLP Active', tone: 'ai', icon: 'auto_awesome' },
        value: '6,410',
        caption: 'Comments indexed Oct 1–31 (sample)',
        footLabel: 'Webhook latency (target)',
        footValue: '< 350ms',
      },
      {
        key: 'quota',
        label: 'API Quota Consumed',
        badge: { label: 'Normal', tone: 'info' },
        value: '21%',
        caption: '420 / 2,000 calls used today',
        progress: 21,
      },
    ],
    capabilities: ekoIndiaCapabilities,
    scopes: [
      { scope: 'instagram_basic', status: 'approved' },
      { scope: 'instagram_manage_insights', status: 'approved' },
      { scope: 'instagram_manage_comments', status: 'approved' },
      { scope: 'pages_show_list', status: 'approved' },
    ],
    tokenFooter: {
      title: 'Long-lived 60-day token (sample status)',
      body: 'Once the FastAPI backend is connected, tokens will be refreshed by a server background job. Next renewal shown here: in 56 days.',
      tone: 'active',
    },
    totalSyncRuns: 248,
  },
  {
    accountId: 'acc-ekomitracare',
    lastSync: { label: 'Oct 30, 2024 at 4:00 PM IST', detail: '(Duration 6.8s)' },
    cadence: { label: 'Every 6 hours', detail: '(Paused until token renewal)' },
    token: { label: 'Token expires in 4 days', detail: '(Re-authorization required)', tone: 'warning' },
    tiles: [
      {
        key: 'media',
        label: 'Media Telemetry',
        badge: { label: 'Complete', tone: 'active' },
        value: '100%',
        caption: '46 posts & Reels in the sample dataset',
        footLabel: 'Last media fetch',
        footValue: 'Oct 30, 4PM',
      },
      {
        key: 'audience',
        label: 'Audience Demographics',
        badge: { label: 'Partial', tone: 'warning' },
        value: '8,420',
        caption: 'City cohorts below Meta’s 100-follower minimum',
        footLabel: 'Demographic cohort sync',
        footValue: 'Partial',
        footTone: 'warning',
      },
      {
        key: 'comments',
        label: 'Comments & NLP Stream',
        badge: { label: 'NLP Active', tone: 'ai', icon: 'auto_awesome' },
        value: '1,126',
        caption: 'Comments indexed Oct 1–31 (sample)',
        footLabel: 'Webhook latency (target)',
        footValue: '< 350ms',
      },
      {
        key: 'quota',
        label: 'API Quota Consumed',
        badge: { label: 'Low', tone: 'info' },
        value: '6%',
        caption: '120 / 2,000 calls used today',
        progress: 6,
      },
    ],
    capabilities: ekoIndiaCapabilities.map((c) => {
      if (c.key === 'demographics') return { ...c, status: 'partial', lastUpdated: 'Oct 30, 04:00 AM', note: 'Some city cohorts fall below the 100-follower privacy threshold' };
      if (c.key === 'stories') return { ...c, status: 'unavailable', lastUpdated: 'Oct 30, 4:00 PM', note: 'No active stories in the last 24 hours' };
      if (c.key === 'dms') return c;
      return { ...c, lastUpdated: 'Oct 30, 4:00 PM' };
    }),
    scopes: [
      { scope: 'instagram_basic', status: 'approved' },
      { scope: 'instagram_manage_insights', status: 'approved' },
      { scope: 'instagram_manage_comments', status: 'approved' },
      { scope: 'pages_show_list', status: 'missing' },
    ],
    tokenFooter: {
      title: 'Long-lived token expiring in 4 days (sample status)',
      body: 'Creator tokens must be re-authorized through Facebook Login before they expire. In this prototype, reconnecting opens the demo connect walkthrough.',
      tone: 'warning',
    },
    totalSyncRuns: 112,
  },
  {
    accountId: 'acc-ekoregional',
    lastSync: { label: 'Oct 12, 2024 at 9:02 AM IST', detail: '(Last successful run)' },
    cadence: { label: 'Suspended', detail: '(Token expired)' },
    token: { label: 'Token expired', detail: '(Revoked during password change)', tone: 'error' },
    tiles: [
      {
        key: 'media',
        label: 'Media Telemetry',
        badge: { label: 'Unavailable', tone: 'error' },
        value: '—',
        caption: '31 posts captured before expiry',
        footLabel: 'Last media fetch',
        footValue: 'Oct 12, 2024',
        footTone: 'error',
      },
      {
        key: 'audience',
        label: 'Audience Demographics',
        badge: { label: 'Unavailable', tone: 'error' },
        value: '3,150',
        caption: 'Follower count as of last sync',
        footLabel: 'Demographic cohort sync',
        footValue: 'Suspended',
        footTone: 'error',
      },
      {
        key: 'comments',
        label: 'Comments & NLP Stream',
        badge: { label: 'Paused', tone: 'neutral' },
        value: '—',
        caption: 'No comments indexed since Oct 12',
        footLabel: 'Webhook',
        footValue: 'Unsubscribed',
      },
      {
        key: 'quota',
        label: 'API Quota Consumed',
        badge: { label: 'Idle', tone: 'neutral' },
        value: '0%',
        caption: '0 / 2,000 calls used today',
        progress: 0,
      },
    ],
    capabilities: expiredCapabilities(),
    scopes: [
      { scope: 'instagram_basic', status: 'revoked' },
      { scope: 'instagram_manage_insights', status: 'revoked' },
      { scope: 'instagram_manage_comments', status: 'revoked' },
      { scope: 'pages_show_list', status: 'not_requested' },
    ],
    tokenFooter: {
      title: 'Token revoked or expired (sample status)',
      body: 'Meta invalidates tokens when the account password changes. Reconnect the account to grant a new token.',
      tone: 'error',
    },
    totalSyncRuns: 64,
  },
];

/* ---------------------------------- Sync log ----------------------------------- */

const triggerLabels: Record<SyncLogEntry['trigger'], string> = {
  scheduled: 'Scheduled Cron',
  manual: 'Manual Trigger by Admin',
  webhook: 'Comment Webhook',
  token_refresh: 'Token Refresh',
};

const cronPayload = (accountId: string, media: number, comments: number, ms: number) => ({
  sample: true,
  account_id: accountId,
  endpoint: 'GET /v19.0/{ig-user-id}/media?fields=id,media_type,like_count,comments_count,insights',
  http_status: 200,
  media_objects: media,
  comments_ingested: comments,
  duration_ms: ms,
});

export const syncLogs: SyncLogEntry[] = [
  // @ekoindia
  ...[
    ['2024-10-31T10:18:14+05:30', 'Oct 31, 2024, 10:18:14 IST', 'scheduled', 4.2, 3214, 'success'],
    ['2024-10-31T04:18:10+05:30', 'Oct 31, 2024, 04:18:10 IST', 'scheduled', 3.9, 1840, 'success'],
    ['2024-10-30T22:18:05+05:30', 'Oct 30, 2024, 22:18:05 IST', 'manual', 4.5, 2100, 'success'],
    ['2024-10-30T16:18:12+05:30', 'Oct 30, 2024, 16:18:12 IST', 'scheduled', 12.1, 0, 'partial'],
    ['2024-10-30T10:18:09+05:30', 'Oct 30, 2024, 10:18:09 IST', 'scheduled', 4.0, 2486, 'success'],
    ['2024-10-30T04:18:11+05:30', 'Oct 30, 2024, 04:18:11 IST', 'scheduled', 3.7, 1312, 'success'],
    ['2024-10-29T22:18:07+05:30', 'Oct 29, 2024, 22:18:07 IST', 'webhook', 1.2, 64, 'success'],
    ['2024-10-29T16:18:15+05:30', 'Oct 29, 2024, 16:18:15 IST', 'scheduled', 30.0, 0, 'failed'],
    ['2024-10-29T10:18:06+05:30', 'Oct 29, 2024, 10:18:06 IST', 'scheduled', 4.3, 2954, 'success'],
    ['2024-10-29T04:18:13+05:30', 'Oct 29, 2024, 04:18:13 IST', 'token_refresh', 0.8, 0, 'success'],
  ].map(([at, label, trigger, duration, comments, status], i): SyncLogEntry => {
    const t = trigger as SyncLogEntry['trigger'];
    const s = status as SyncLogEntry['status'];
    const media = t === 'webhook' || t === 'token_refresh' ? 0 : 128;
    return {
      id: `sync-ekoindia-${i + 1}`,
      accountId: 'acc-ekoindia',
      executedAt: at as string,
      executedLabel: label as string,
      trigger: t,
      triggerLabel: triggerLabels[t],
      durationSec: duration as number,
      media: s === 'failed' ? 0 : media,
      comments: (comments as number) || undefined,
      status: s,
      statusLabel: s === 'partial' ? 'Partial (Rate limit resolved)' : s === 'failed' ? 'Failed (Timeout)' : 'Success',
      raw:
        s === 'failed'
          ? { sample: true, account_id: 'acc-ekoindia', http_status: 504, error: { type: 'GatewayTimeout', message: 'Upstream request timed out after 30s' }, retry_scheduled: true }
          : s === 'partial'
            ? { sample: true, account_id: 'acc-ekoindia', http_status: 429, error: { code: 4, message: 'Application request limit reached' }, retried_after_ms: 8000, media_objects: 128 }
            : cronPayload('acc-ekoindia', media, comments as number, Math.round((duration as number) * 1000)),
    };
  }),
  // @ekomitracare
  {
    id: 'sync-ekomitracare-1',
    accountId: 'acc-ekomitracare',
    executedAt: '2024-10-31T10:00:02+05:30',
    executedLabel: 'Oct 31, 2024, 10:00:02 IST',
    trigger: 'token_refresh',
    triggerLabel: 'Token Refresh',
    durationSec: 0.6,
    media: 0,
    status: 'failed',
    statusLabel: 'Failed (Re-auth required)',
    raw: { sample: true, account_id: 'acc-ekomitracare', http_status: 400, error: { type: 'OAuthException', code: 190, message: 'Token cannot be extended — user must re-authorize' } },
  },
  {
    id: 'sync-ekomitracare-2',
    accountId: 'acc-ekomitracare',
    executedAt: '2024-10-30T16:00:04+05:30',
    executedLabel: 'Oct 30, 2024, 16:00:04 IST',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Cron',
    durationSec: 6.8,
    media: 46,
    comments: 212,
    status: 'success',
    statusLabel: 'Success',
    raw: cronPayload('acc-ekomitracare', 46, 212, 6800),
  },
  {
    id: 'sync-ekomitracare-3',
    accountId: 'acc-ekomitracare',
    executedAt: '2024-10-30T10:00:03+05:30',
    executedLabel: 'Oct 30, 2024, 10:00:03 IST',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Cron',
    durationSec: 7.4,
    media: 46,
    comments: 0,
    status: 'partial',
    statusLabel: 'Partial (Demographics withheld)',
    raw: { sample: true, account_id: 'acc-ekomitracare', http_status: 200, warnings: ['audience_city: below 100-follower threshold'], media_objects: 46 },
  },
  {
    id: 'sync-ekomitracare-4',
    accountId: 'acc-ekomitracare',
    executedAt: '2024-10-30T04:00:05+05:30',
    executedLabel: 'Oct 30, 2024, 04:00:05 IST',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Cron',
    durationSec: 5.9,
    media: 46,
    comments: 148,
    status: 'success',
    statusLabel: 'Success',
    raw: cronPayload('acc-ekomitracare', 46, 148, 5900),
  },
  {
    id: 'sync-ekomitracare-5',
    accountId: 'acc-ekomitracare',
    executedAt: '2024-10-29T22:12:40+05:30',
    executedLabel: 'Oct 29, 2024, 22:12:40 IST',
    trigger: 'manual',
    triggerLabel: 'Manual Trigger by Admin',
    durationSec: 6.1,
    media: 45,
    comments: 96,
    status: 'success',
    statusLabel: 'Success',
    raw: cronPayload('acc-ekomitracare', 45, 96, 6100),
  },
  // @ekoregional_archive
  {
    id: 'sync-ekoregional-1',
    accountId: 'acc-ekoregional',
    executedAt: '2024-10-12T15:02:11+05:30',
    executedLabel: 'Oct 12, 2024, 15:02:11 IST',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Cron',
    durationSec: 0.4,
    media: 0,
    status: 'failed',
    statusLabel: 'Failed (Token expired)',
    raw: { sample: true, account_id: 'acc-ekoregional', http_status: 400, error: { type: 'OAuthException', code: 190, error_subcode: 460, message: 'Session invalidated because the user changed their password' } },
  },
  {
    id: 'sync-ekoregional-2',
    accountId: 'acc-ekoregional',
    executedAt: '2024-10-12T09:02:08+05:30',
    executedLabel: 'Oct 12, 2024, 09:02:08 IST',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Cron',
    durationSec: 3.1,
    media: 31,
    comments: 54,
    status: 'success',
    statusLabel: 'Success',
    raw: cronPayload('acc-ekoregional', 31, 54, 3100),
  },
  {
    id: 'sync-ekoregional-3',
    accountId: 'acc-ekoregional',
    executedAt: '2024-10-12T03:02:06+05:30',
    executedLabel: 'Oct 12, 2024, 03:02:06 IST',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Cron',
    durationSec: 2.9,
    media: 31,
    comments: 22,
    status: 'success',
    statusLabel: 'Success',
    raw: cronPayload('acc-ekoregional', 31, 22, 2900),
  },
];

/* --------------------------------- Connect flow -------------------------------- */

export const connectPrerequisites: ConnectPrerequisite[] = [
  { id: 'linked-page', label: 'Business / Creator profile linked to a Facebook Page' },
  { id: 'admin-rights', label: 'Admin rights in Meta Business Suite / Managing Page' },
  { id: 'two-factor', label: 'Two-Factor Authentication enabled on Meta account' },
];

/** Sample accounts shown in the demo walkthrough instead of a real Meta account picker. */
export const connectCandidates: ConnectCandidate[] = [
  {
    id: 'cand-ekopayments',
    displayName: 'Eko Payments (Sample)',
    handle: 'ekopayments_in',
    type: 'business',
    facebookPage: 'Eko Payments Sample Page',
    followers: 48_200,
    outcome: 'ready',
    outcomeNote: 'Professional account with all mandatory scopes — would be ready to sync once a real connection exists.',
  },
  {
    id: 'cand-ekoindia',
    displayName: 'Eko India Financial Services',
    handle: 'ekoindia',
    type: 'business',
    facebookPage: 'Eko Financial Technologies Ltd.',
    followers: 86_400,
    outcome: 'already_linked',
    outcomeNote: 'Already in this workspace’s sample account list.',
  },
  {
    id: 'cand-ekofieldops',
    displayName: 'Eko Field Ops (Sample)',
    handle: 'ekofieldops',
    type: 'creator',
    facebookPage: 'Eko Field Operations Sample Page',
    followers: 2_310,
    outcome: 'insufficient_permissions',
    outcomeNote: "Insufficient Permissions: Missing 'instagram_manage_insights'. The authenticated user is an Editor rather than an Admin on the managing Facebook Page.",
  },
  {
    id: 'cand-personal',
    displayName: 'Eko Personal Sandbox (Sample)',
    handle: 'eko_personal_sandbox',
    type: 'personal',
    facebookPage: null,
    followers: 640,
    outcome: 'personal',
    outcomeNote: 'Registered as a Personal profile. Meta Graph API requires a Professional Business or Creator account (Instagram app › Settings › Account type).',
  },
];
