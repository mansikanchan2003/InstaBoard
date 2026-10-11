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
import type { IntegrationStatus } from '@/types/instagram';

configure({ asyncUtilTimeout: 5000 }); // lazy route chunks load on first render

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
    if (path.endsWith('/sync-runs')) return Promise.resolve(json(200, []));
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

  it('runs the first sync automatically after a successful connection', async () => {
    const fetchMock = stubApi({
      'POST /integrations/instagram/accounts/igc_abc123/sync': () => json(200, { id: 'igr_1', trigger: 'manual', status: 'success', startedAt: 'x', finishedAt: 'y', mediaFetched: 3, mediaInsightsFetched: 7, accountInsightsFetched: 8, commentsFetched: 0, warnings: [], errorCode: null, errorMessage: null, apiVersion: 'v26.0' }),
    });
    renderAt('/accounts?instagram=connected&account=igc_abc123');
    expect(await screen.findByText('Sync complete')).toBeInTheDocument();
    const syncCalls = fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/sync') && i.method === 'POST');
    expect(syncCalls).toHaveLength(1);
    expect((syncCalls[0][1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test-token');
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
