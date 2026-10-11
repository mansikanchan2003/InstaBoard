import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { routes } from '@/app/routes';
import { clearQueryCache } from '@/hooks/useQuery';

/**
 * Smoke test: every implemented route renders inside the app shell without throwing,
 * finishes loading its demo data, and is not a placeholder.
 */
const ROUTES = [
  '/dashboard',
  '/campaigns',
  '/campaigns/sbi-csp-october',
  '/campaigns/eko-kiosk-festival-drive',
  '/content',
  '/content/sbi-csp-mitra-reel',
  '/content/digital-banking-rural-india',
  '/audience',
  '/comments',
  '/leads',
  '/leads?lead=lead-ramesh-maurya',
  '/ai-insights',
  '/ai-insights/ins-hindi-reels-vs-carousels',
  '/reports',
  '/reports/rep-2024-884',
  '/accounts',
  '/accounts/connect',
  '/accounts/acc-ekoindia',
  '/accounts/acc-ekoregional',
  '/notifications',
  '/activity',
  '/settings',
];

function renderAt(path: string) {
  const router = createMemoryRouter(withProviders(routes), { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('routes', () => {
  beforeEach(() => clearQueryCache());

  it('redirects / to the dashboard', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Eko India Campaign Overview' }, { timeout: 25000 })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Dashboard - Eko InstaBoard')); // title is set by an effect right after the heading renders
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it.each(ROUTES)('renders %s', async (path) => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));
    renderAt(path);
    const main = await screen.findByRole('main');
    await waitFor(
      () => {
        expect(main.querySelector('[role="status"][aria-label="Loading"]')).toBeNull();
        expect(main.textContent ?? '').not.toMatch(/migration in progress/i);
        expect(main.querySelector('h1')).not.toBeNull();
      },
      { timeout: 10000 },
    );
    expect(main.textContent).not.toMatch(/Page not found/);
    spy.mockRestore();
    const real = errors.filter((e) => !String((e as unknown[])[0]).includes('ReactDOMTestUtils.act'));
    expect(real).toEqual([]);
  });

  it('shows the Not Found page for unknown routes', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
