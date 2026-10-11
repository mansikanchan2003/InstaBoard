/**
 * Phase 5 frontend (api mode, mocked fetch): live Instagram connections are shown separately from demo data,
 * unavailable metrics are never rendered as zero, the connect button only ever navigates to Instagram's
 * official authorization URL, and callback errors map to known messages.
 */
vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0 },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { routes } from '@/app/routes';
import { clearQueryCache } from '@/hooks/useQuery';
import { setCsrfToken } from '@/lib/api/client';
import { pollDelay } from '@/features/instagram/useSyncState';
import type { AccountHistory, IntegrationStatus, SyncJob, SyncStatus } from '@/types/instagram';

configure({ asyncUtilTimeout: 12000 }); // lazy route chunks load on first render

const ME = {
  user: { id: 'usr_1', name: 'Test Owner', email: 'owner@example.test', isPlatformAdmin: false },
  member: { id: 'usr-priya', name: 'Test Owner', email: 'owner@example.test', role: 'Head of Growth', access: 'Owner', status: 'active', lastActive: 'now' },
  workspace: { id: 'ws-1', name: 'Test Workspace' },
  role: 'Owner',
  permissions: ['read', 'notifications:read_state', 'write', 'settings:manage', 'team:manage', 'accounts:manage', 'admins:manage'],
  csrfToken: 'csrf-test-token',
  session: { id: 'ses_1', createdAt: '2026-10-11T00:00:00Z', lastSeenAt: '2026-10-11T00:00:00Z', idleExpiresAt: '2026-10-11T02:00:00Z', absoluteExpiresAt: '2026-10-12T00:00:00Z', current: true },
};

const STATUS_ON: IntegrationStatus = { provider: 'instagram_login', enabled: true, missingConfig: [], apiVersion: 'v26.0', requestedScopes: ['instagram_business_basic', 'instagram_business_manage_insights'], canManage: true, connectedAccounts: 1 };
const STATUS_OFF: IntegrationStatus = { ...STATUS_ON, enabled: false, missingConfig: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'], apiVersion: null, connectedAccounts: 0 };

const CONNECTION = {
  id: 'igc_abc123', source: 'instagram_api', igUserId: '1784', username: 'eko_live_test', name: 'Eko Live', accountType: 'BUSINESS',
  profilePictureUrl: null, followersCount: null, followsCount: 10, mediaCount: 3, status: 'connected',
  grantedScopes: ['instagram_business_basic', 'instagram_business_manage_insights'], connectedAt: '2026-10-11T08:00:00Z',
  tokenExpiresAt: '2026-12-10T08:00:00Z', lastSyncedAt: '2026-10-11T09:00:00Z', lastSyncAttemptAt: '2026-10-11T09:00:00Z',
  lastSyncStatus: 'success', lastErrorCode: null, lastErrorMessage: null, insightsAvailable: true, commentsAvailable: false,
};

const MEDIA = [{
  id: 'igm_1', igMediaId: 'm1', mediaType: 'IMAGE', mediaProductType: null, caption: null, permalink: 'https://instagram.com/p/m1',
  thumbnailUrl: null, mediaUrl: null, postedAt: '2026-10-05T10:00:00Z', likeCount: 12, commentsCount: 0, removed: false,
  insights: [
    { metric: 'views', value: 90, status: 'ok', period: 'lifetime', capturedAt: '2026-10-11T09:00:00Z' },
    { metric: 'saved', value: null, status: 'unavailable', period: 'lifetime', capturedAt: '2026-10-11T09:00:00Z' },
  ],
  insightsCapturedAt: '2026-10-11T09:00:00Z',
}];

const INSIGHTS = {
  source: 'instagram_api',
  totals: [
    { metric: 'reach', value: 900, status: 'ok', rangeStart: '2026-09-13T09:00:00Z', rangeEnd: '2026-10-11T09:00:00Z', capturedAt: '2026-10-11T09:00:00Z' },
    { metric: 'accounts_engaged', value: null, status: 'unavailable', rangeStart: '2026-09-13T09:00:00Z', rangeEnd: '2026-10-11T09:00:00Z', capturedAt: '2026-10-11T09:00:00Z' },
  ],
  reachDaily: [], unavailableMetrics: ['accounts_engaged'], note: 'Live data.',
};

function makeJob(over: Partial<SyncJob> = {}): SyncJob {
  return {
    id: 'igr_aa11', accountId: 'igc_abc123', trigger: 'manual', status: 'running', terminal: false, queuedAt: '2026-10-11T09:00:00Z',
    startedAt: '2026-10-11T09:00:01Z', finishedAt: null, progress: 40, progressStage: 'media_insights', recordsProcessed: 12, mediaFetched: 3,
    mediaInsightsFetched: 7, accountInsightsFetched: 0, commentsFetched: 0, retryCount: 0, maxRetries: 3, nextRetryAt: null,
    cancelRequested: false, warnings: [], errorCategory: null, errorMessage: null, apiVersion: 'v26.0', ...over,
  };
}
const DONE_JOB = makeJob({ status: 'succeeded', terminal: true, progress: 100, progressStage: 'done', finishedAt: '2026-10-11T09:00:09Z', accountInsightsFetched: 8 });

function syncStatus(over: Partial<SyncStatus> = {}): SyncStatus {
  return {
    accountId: 'igc_abc123', connectionStatus: 'connected', lastSuccessAt: '2026-10-11T09:00:00Z', lastSyncStatus: 'succeeded', currentJob: null,
    lastJob: null, nextScheduledAt: '2026-10-11T15:00:00Z', schedulingEnabled: true, intervalMinutes: 360, backgroundAvailable: true, ...over,
  };
}

const EMPTY_HISTORY: AccountHistory = { source: 'instagram_api', days: 90, firstObservationAt: null, series: [], note: '' };

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const err = (status: number, code: string, message: string) => json(status, { error: { code, message, details: {} } });

function stubApi(overrides: Record<string, () => Response> = {}, status = STATUS_ON) {
  const fn = vi.fn((url: string, init: RequestInit) => {
    const path = url.replace('http://api.test/api/v1', '').split('?')[0];
    const key = `${init.method ?? 'GET'} ${path}`;
    if (overrides[key]) return Promise.resolve(overrides[key]());
    if (path === '/auth/me') return Promise.resolve(json(200, ME));
    if (path === '/integrations/instagram/status') return Promise.resolve(json(200, status));
    if (path === '/integrations/instagram/accounts') return Promise.resolve(json(200, status.enabled ? [CONNECTION] : []));
    if (path === `/integrations/instagram/accounts/${CONNECTION.id}`) return Promise.resolve(json(200, CONNECTION));
    if (path.endsWith('/media')) return Promise.resolve(json(200, MEDIA));
    if (path.endsWith('/insights')) return Promise.resolve(json(200, INSIGHTS));
    if (path.endsWith('/sync-history')) return Promise.resolve(json(200, []));
    if (path.endsWith('/sync-status')) return Promise.resolve(json(200, syncStatus()));
    if (path.endsWith('/history')) return Promise.resolve(json(200, EMPTY_HISTORY));
    return Promise.resolve(err(503, 'unavailable', 'not under test'));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderAt(path: string) {
  const router = createMemoryRouter(withProviders(routes), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('live Instagram integration (api mode)', () => {
  beforeEach(() => {
    clearQueryCache();
    setCsrfToken(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('explains a disabled integration by listing missing setting names', async () => {
    stubApi({}, STATUS_OFF);
    renderAt('/accounts');
    expect(await screen.findByText(/live instagram connection is not configured/i)).toBeInTheDocument();
    expect(screen.getByText('INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect with instagram/i })).not.toBeInTheDocument();
  });

  it('lists live accounts apart from the demo sample accounts, with unavailable counts not shown as 0', async () => {
    stubApi();
    renderAt('/accounts');
    const section = (await screen.findByRole('heading', { name: /live instagram connections/i })).closest('section')!;
    expect(await within(section).findByText('@eko_live_test')).toBeInTheDocument();
    expect(within(section).getByText(/followers: not returned/i)).toBeInTheDocument();
    expect(within(section).getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/sample accounts below are demo data/i)).toBeInTheDocument();
  });

  it('shows a known message for a callback error and ignores unknown reasons', async () => {
    stubApi();
    const router = renderAt('/accounts?instagram=error&reason=access_denied');
    expect(await screen.findByText('Authorization cancelled')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));  // query cleaned up
    clearQueryCache();
  });

  it('maps an unrecognised reason to a generic message (no reflected text)', async () => {
    stubApi();
    renderAt('/accounts?instagram=error&reason=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(await screen.findByText('Instagram returned an error')).toBeInTheDocument();
    expect(screen.queryByText(/script/)).not.toBeInTheDocument();
  });

  it('follows the server-queued first sync after connecting, then stops polling', async () => {
    const connectJob = makeJob({ trigger: 'connect', status: 'queued', progress: 0, progressStage: null, startedAt: null });
    const fetchMock = stubApi({
      'GET /integrations/instagram/accounts/igc_abc123/sync-status': () => json(200, syncStatus({ currentJob: connectJob, lastSuccessAt: null })),
      'GET /sync-jobs/igr_aa11': () => json(200, DONE_JOB),
    });
    renderAt('/accounts?instagram=connected&account=igc_abc123');
    expect(await screen.findByText(/queued — waiting for a worker/i)).toBeInTheDocument();
    expect(await screen.findByText('Sync complete', undefined, { timeout: 8000 })).toBeInTheDocument();
    // The UI never POSTs a sync itself here: the server queued it with the connection.
    expect(fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/sync') && i.method === 'POST')).toHaveLength(0);
    const polls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/sync-jobs/igr_aa11')).length;
    const after = polls();
    await new Promise((r) => setTimeout(r, 3500));
    expect(polls()).toBe(after); // terminal → polling stopped
  }, 20000);

  it('Sync now queues a background job, shows progress and the result', async () => {
    const fetchMock = stubApi({
      'POST /integrations/instagram/accounts/igc_abc123/sync': () => json(202, { job: makeJob({ status: 'queued', progress: 0, progressStage: null }), deduplicated: false }),
      'GET /sync-jobs/igr_aa11': () => json(200, DONE_JOB),
    });
    renderAt('/accounts');
    const section = (await screen.findByRole('heading', { name: /live instagram connections/i })).closest('section')!;
    fireEvent.click(await within(section).findByRole('button', { name: /sync now/i }));
    expect(await screen.findByText('Sync queued')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: /syncing/i })).toBeDisabled();
    expect(await screen.findByText('Sync complete', undefined, { timeout: 8000 })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/sync') && i.method === 'POST')!;
    expect((post[1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test-token');
  }, 20000);

  it('explains authorization failures from a finished job', async () => {
    stubApi({
      'POST /integrations/instagram/accounts/igc_abc123/sync': () => json(202, { job: makeJob(), deduplicated: false }),
      'GET /sync-jobs/igr_aa11': () => json(200, makeJob({ status: 'failed', terminal: true, errorCategory: 'token_invalid', errorMessage: 'Instagram rejected the access token. Reconnect the account.' })),
    });
    renderAt('/accounts');
    const section = (await screen.findByRole('heading', { name: /live instagram connections/i })).closest('section')!;
    fireEvent.click(await within(section).findByRole('button', { name: /sync now/i }));
    expect(await screen.findByText('Reauthorization needed', undefined, { timeout: 8000 })).toBeInTheDocument();
  }, 20000);

  it('polls quickly while running and slowly while waiting for a distant retry', () => {
    const now = Date.parse('2026-10-11T09:00:00Z');
    expect(pollDelay(makeJob(), now)).toBe(3000);
    expect(pollDelay(makeJob({ status: 'retrying', nextRetryAt: '2026-10-11T09:30:00Z' }), now)).toBe(60_000);
    expect(pollDelay(makeJob({ status: 'retrying', nextRetryAt: '2026-10-11T09:00:05Z' }), now)).toBe(7000);
  });

  function withAssign(run: (assign: ReturnType<typeof vi.fn>) => Promise<void>) {
    return async () => {
      const assign = vi.fn();
      const original = window.location;
      Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
      try {
        await run(assign);
      } finally {
        Object.defineProperty(window, 'location', { configurable: true, value: original });
      }
    };
  }

  it('navigates to the official Instagram authorization URL from Connect', withAssign(async (assign) => {
    stubApi({ 'POST /integrations/instagram/connect': () => json(200, { authorizationUrl: 'https://www.instagram.com/oauth/authorize?client_id=1&state=s', expiresInSeconds: 600 }) });
    renderAt('/accounts');
    fireEvent.click(await screen.findByRole('button', { name: /connect with instagram/i }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.instagram.com/oauth/authorize?client_id=1&state=s'));
    expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();
  }));

  it('refuses to navigate anywhere but Instagram', withAssign(async (assign) => {
    stubApi({ 'POST /integrations/instagram/connect': () => json(200, { authorizationUrl: 'https://evil.example/phish', expiresInSeconds: 600 }) });
    renderAt('/accounts');
    fireEvent.click(await screen.findByRole('button', { name: /connect with instagram/i }));
    expect(await screen.findByText(/unexpected authorization url/i)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  }));

  it('shows a rate-limit message when Sync now is throttled', async () => {
    stubApi({ 'POST /integrations/instagram/accounts/igc_abc123/sync': () => err(429, 'rate_limited', 'Too many attempts. Please wait and try again.') });
    renderAt('/accounts');
    const section = (await screen.findByRole('heading', { name: /live instagram connections/i })).closest('section')!;
    fireEvent.click(await within(section).findByRole('button', { name: /sync now/i }));
    expect(await screen.findByText('Please wait')).toBeInTheDocument();
  });

  it('history charts show an honest empty state, then observed days with gaps', async () => {
    stubApi();
    renderAt(`/accounts/live/${CONNECTION.id}`);
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
    clearQueryCache();
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    const history: AccountHistory = {
      ...EMPTY_HISTORY, days: 7, firstObservationAt: '2026-10-08T09:00:00Z',
      series: [{ metric: 'followers_count', kind: 'daily_snapshot', unit: 'count', observedDays: 2,
        points: days.map((d, i) => ({ date: `${d}T00:00:00Z`, value: i === 3 ? 1190 : i === 6 ? 1200 : null })) }],
    };
    stubApi({ 'GET /integrations/instagram/accounts/igc_abc123/history': () => json(200, history) });
    renderAt(`/accounts/live/${CONNECTION.id}`);
    expect(await screen.findByText('Followers (observed at each sync)')).toBeInTheDocument();
    expect(screen.getByText('2 of 7 days observed')).toBeInTheDocument();
  });

  it('shows last success and the next scheduled sync', async () => {
    stubApi();
    renderAt(`/accounts/live/${CONNECTION.id}`);
    const panel = await screen.findByRole('region', { name: /sync status/i });
    expect(within(panel).getByText(/next scheduled sync/i)).toBeInTheDocument();
    expect(within(panel).getByText(/every 6 h/i)).toBeInTheDocument();
  });

  it('live account detail renders unavailable metrics as unavailable, never 0', async () => {
    stubApi();
    renderAt(`/accounts/live/${CONNECTION.id}`);
    expect(await screen.findByRole('heading', { name: '@eko_live_test' })).toBeInTheDocument();
    expect(await screen.findByText('900')).toBeInTheDocument();
    const engaged = screen.getByText('Accounts engaged').parentElement!;
    expect(within(engaged).getByText('Unavailable')).toBeInTheDocument();
    const row = (await screen.findByText('Open on Instagram')).closest('tr')!;
    expect(within(row).getByText('90')).toBeInTheDocument();
    expect(within(row).queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('Not returned').length).toBeGreaterThan(0); // followers null
  });

  it('disconnect asks for confirmation, then posts and returns to accounts', async () => {
    const fetchMock = stubApi({ 'POST /integrations/instagram/accounts/igc_abc123/disconnect': () => json(200, { ...CONNECTION, status: 'disconnected' }) });
    const router = renderAt(`/accounts/live/${CONNECTION.id}`);
    fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));
    expect(await screen.findByText(/will delete the encrypted access token/i)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /disconnect account/i }));
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts'));
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/disconnect') && i.method === 'POST')).toBe(true);
  });
});
