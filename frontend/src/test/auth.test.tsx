/**
 * Phase 4 auth in api mode: protected routes wait for GET /auth/me, unauthenticated users go to /login,
 * sign-in restores the requested page, CSRF is attached to mutations and a mid-session 401 ends the session.
 */
vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0 },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { routes } from '@/app/routes';
import { safeNext } from '@/features/auth/AuthLayout';
import { clearQueryCache } from '@/hooks/useQuery';
import { apiClient, setCsrfToken } from '@/lib/api/client';

configure({ asyncUtilTimeout: 12000 }); // lazy route chunks load on first render (slow under a parallel full run)

const ME = {
  user: { id: 'usr_1', name: 'Test Owner', email: 'owner@example.test', isPlatformAdmin: false },
  member: { id: 'usr-priya', name: 'Test Owner', email: 'owner@example.test', role: 'Head of Growth', access: 'Owner', status: 'active', lastActive: 'now' },
  workspace: { id: 'ws-1', name: 'Test Workspace' },
  role: 'Owner',
  permissions: ['read', 'notifications:read_state', 'write', 'settings:manage', 'team:manage', 'accounts:manage', 'admins:manage'],
  csrfToken: 'csrf-test-token',
  session: { id: 'ses_1', createdAt: '2026-10-11T00:00:00Z', lastSeenAt: '2026-10-11T00:00:00Z', idleExpiresAt: '2026-10-11T02:00:00Z', absoluteExpiresAt: '2026-10-12T00:00:00Z', current: true },
};

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const err = (status: number, code: string, message: string) => json(status, { error: { code, message, details: {} } });

type Handler = (path: string, init: RequestInit) => Response | Promise<Response>;
function stubApi(handler: Handler) {
  const fn = vi.fn((url: string, init: RequestInit) => handler(url.replace('http://api.test/api/v1', ''), init));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const paths = (fn: ReturnType<typeof stubApi>) => fn.mock.calls.map(([url]) => String(url).replace('http://api.test/api/v1', ''));

function renderAt(path: string) {
  const router = createMemoryRouter(withProviders(routes), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('safeNext', () => {
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/login', '', null])('rejects %s', (raw) => {
    expect(safeNext(raw as string | null)).toBe('/dashboard');
  });
  it('keeps internal paths', () => {
    expect(safeNext('/leads?lead=lead-1')).toBe('/leads?lead=lead-1');
  });
});

describe('auth in api mode', () => {
  beforeEach(() => {
    clearQueryCache();
    setCsrfToken(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches nothing protected until the session is verified, then redirects anonymous users to /login', async () => {
    let resolveMe!: (r: Response) => void;
    const fetchMock = stubApi((path) => (path === '/auth/me' ? new Promise<Response>((r) => (resolveMe = r)) : err(500, 'unexpected', 'should not be called')));
    const router = renderAt('/leads');

    expect(await screen.findByRole('status', { name: /checking your session/i })).toBeInTheDocument();
    expect(paths(fetchMock)).toEqual(['/auth/me']);
    expect(screen.queryByText(/leads/i)).not.toBeInTheDocument();

    resolveMe(err(401, 'not_authenticated', 'Sign in to continue.'));
    expect(await screen.findByRole('heading', { name: /sign in to instaboard/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toContain('next=%2Fleads');
    expect(paths(fetchMock)).toEqual(['/auth/me']);
  });

  it('signs in, returns to the requested page and sends the CSRF token on mutations', async () => {
    const fetchMock = stubApi((path, init) => {
      if (path === '/auth/me') return err(401, 'not_authenticated', 'Sign in to continue.');
      if (path === '/auth/login') {
        const body = JSON.parse(String(init.body));
        return body.password === 'right-password-123' ? json(200, ME) : err(401, 'invalid_credentials', 'Invalid email or password.');
      }
      return err(503, 'unavailable', 'not under test');
    });
    const router = renderAt('/settings');
    await screen.findByRole('heading', { name: /sign in to instaboard/i });

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'owner@example.test' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByLabelText(/^password/i)).toHaveValue(''); // password is cleared after a failure

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'right-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(await screen.findAllByText('Test Owner')).not.toHaveLength(0);

    await act(() => apiClient.post('/leads/lead-1/notes', { text: 'x' }).catch(() => undefined));
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test-token');
    expect(init.credentials).toBe('include');
  });

  it('restores an existing session on refresh without showing the login page', async () => {
    stubApi((path) => (path === '/auth/me' ? json(200, ME) : err(503, 'unavailable', 'not under test')));
    const router = renderAt('/dashboard');
    expect(await screen.findAllByText('Test Owner')).not.toHaveLength(0);
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.queryByRole('heading', { name: /sign in to instaboard/i })).not.toBeInTheDocument();
  });

  it('shows the expired-session screen when the API answers 401 mid-session', async () => {
    let expired = false;
    stubApi((path) => {
      if (path === '/auth/me') return expired ? err(401, 'session_expired', 'Your session has expired. Please sign in again.') : json(200, ME);
      return expired ? err(401, 'session_expired', 'Your session has expired. Please sign in again.') : err(503, 'unavailable', 'not under test');
    });
    const router = renderAt('/dashboard');
    await screen.findAllByText('Test Owner');

    expired = true;
    await act(() => apiClient.get('/campaigns').catch(() => undefined));

    expect(await screen.findByText(/your session ended/i)).toBeInTheDocument();
    expect(screen.getByText(/your session has expired/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toContain('reason=expired');
    expect(screen.queryByText('Test Owner')).not.toBeInTheDocument();
  });

  it('does not fall back to demo data when the session check cannot reach the API', async () => {
    stubApi(() => {
      throw new TypeError('Failed to fetch');
    });
    renderAt('/campaigns');
    expect(await screen.findByRole('heading', { name: /sign in to instaboard/i })).toBeInTheDocument();
    expect(screen.queryByText(/SBI CSP/i)).not.toBeInTheDocument();
  });
});
