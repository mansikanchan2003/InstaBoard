/**
 * Phase 7 frontend (api mode, mocked fetch): real AI generation jobs instead of the demo animation, evidence
 * and provenance on AI insights, human review of comment labels, honest disabled states, deterministic priorities.
 */
vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0 },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { PreviewStateProvider } from '@/app/PreviewStateContext';
import { routes } from '@/app/routes';
import { ToastProvider } from '@/components/ui/Toast';
import { CommentAiPanel } from '@/features/ai/CommentAiPanel';
import { LeadPrioritiesPanel } from '@/features/ai/LeadAiPanels';
import { aiPollDelay } from '@/features/ai/useAiJob';
import { insights as demoInsights, insightsOverview, recommendedActions } from '@/data/insights';
import { clearQueryCache } from '@/hooks/useQuery';
import { setCsrfToken } from '@/lib/api/client';
import type { AIJob, AIStatus, CommentClassification, EvidenceFact } from '@/types/ai';

configure({ asyncUtilTimeout: 12000 });

const ME = {
  user: { id: 'usr_1', name: 'Test Owner', email: 'owner@example.test', isPlatformAdmin: false },
  member: { id: 'usr-priya', name: 'Test Owner', email: 'owner@example.test', role: 'Head of Growth', access: 'Owner', status: 'active', lastActive: 'now' },
  workspace: { id: 'ws-1', name: 'Test Workspace' },
  role: 'Owner',
  permissions: ['read', 'notifications:read_state', 'write', 'settings:manage', 'team:manage', 'accounts:manage', 'admins:manage'],
  csrfToken: 'csrf-test-token',
  session: { id: 'ses_1', createdAt: '2026-10-11T00:00:00Z', lastSeenAt: '2026-10-11T00:00:00Z', idleExpiresAt: '2026-10-11T02:00:00Z', absoluteExpiresAt: '2026-10-12T00:00:00Z', current: true },
};

const STATUS_ON: AIStatus = {
  enabled: true, provider: 'anthropic', model: 'test-model-1', capabilities: ['insights'],
  usage: { tokensMonth: 1200, requestsToday: 2, requestsMonth: 4, failuresMonth: 0, avgLatencyMs: 900 },
  limits: { monthlyTokens: 500000 }, limitsNote: 'Limits are enforced by InstaBoard…', scheduledInsights: false,
};
const STATUS_OFF: AIStatus = { ...STATUS_ON, enabled: false, model: null, capabilities: [] };

const FACT: EvidenceFact = {
  id: 'E4', label: 'Engagement rate (by reach)', value: 7.42, display: '7.4%', unit: 'percent', kind: 'calculated',
  definition: 'Σ(likes + comments + shares + saves) ÷ Σ reach × 100', periodStart: '2024-10-01', periodEnd: '2024-10-31',
  sampleSize: 9, missing: 0, sufficient: true, source: 'demo_dataset', scope: { type: 'workspace' }, note: null,
};

const AI_INSIGHT = {
  ...demoInsights[0], id: 'ai-abc123', title: 'Engagement rate across published content', status: 'new' as const, detail: undefined,
  observed: 'Engagement rate (by reach) was 7.4%.',
  ai: {
    generated: true as const, provider: 'anthropic', model: 'test-model-1', promptVersion: 'insights-v1', evidenceQuality: 'medium' as const,
    evidence: [FACT], summary: 'Across the period the engagement rate was 7.4% over 9 items.', explanation: 'A baseline for comparing campaigns.',
    recommendedAction: 'Review the items above the baseline.', period: { start: '2024-10-01', end: '2024-10-31' }, sources: ['demo_dataset'],
    generatedAt: '2026-10-11T10:00:00Z', expiresAt: '2026-10-25T10:00:00Z',
  },
};

function job(over: Partial<AIJob> = {}): AIJob {
  return { id: 'aij_aa11', kind: 'insights', status: 'queued', terminal: false, trigger: 'manual', params: {}, queuedAt: '2026-10-11T10:00:00Z',
    startedAt: null, finishedAt: null, progress: 0, progressStage: null, result: {}, retryCount: 0, maxRetries: 2, nextRetryAt: null,
    errorCategory: null, errorMessage: null, ...over };
}

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const err = (status: number, code: string, message: string) => json(status, { error: { code, message, details: {} } });

function stubApi(overrides: Record<string, (init: RequestInit) => Response> = {}, status: AIStatus = STATUS_ON) {
  const fn = vi.fn((url: string, init: RequestInit) => {
    const path = url.replace('http://api.test/api/v1', '').split('?')[0];
    const key = `${init.method ?? 'GET'} ${path}`;
    if (overrides[key]) return Promise.resolve(overrides[key](init));
    if (path === '/auth/me') return Promise.resolve(json(200, ME));
    if (path === '/ai/status') return Promise.resolve(json(200, status));
    if (path === '/insights/overview') return Promise.resolve(json(200, insightsOverview));
    if (path === '/insights') return Promise.resolve(json(200, [AI_INSIGHT, ...demoInsights]));
    if (path === '/insights/actions') return Promise.resolve(json(200, recommendedActions));
    if (path === `/insights/${AI_INSIGHT.id}`) return Promise.resolve(json(200, AI_INSIGHT));
    if (path === '/analytics/campaigns') return Promise.resolve(json(200, {
      periodStart: '2024-10-01', periodEnd: '2024-10-31', previousStart: '2024-08-31', previousEnd: '2024-09-30', facts: [FACT],
      campaigns: [{ campaignId: 'c1', name: 'SBI CSP October', posts: 4, reach: 1000, engagementRate: 7.4, engagementRateSufficient: true, leads: 3, leadYield: 3 }],
      formats: [{ type: 'reel', items: 2, engagementRate: 9.1, sufficient: false }], comparisons: [], insufficient: ['period_comparison'],
      sources: ['demo_dataset'], definitions: { engagement_rate: FACT.definition }, thresholds: { minItems: 3, minLeads: 10, notableChangePct: 20 }, evidenceHash: 'x',
    }));
    return Promise.resolve(json(200, []));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderAt(path: string) {
  const router = createMemoryRouter(withProviders(routes), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function Shell({ children }: { children: ReactNode }) {
  return <MemoryRouter><PreviewStateProvider><ToastProvider>{children}</ToastProvider></PreviewStateProvider></MemoryRouter>;
}

describe('AI intelligence (api mode)', () => {
  beforeEach(() => {
    clearQueryCache();
    setCsrfToken('csrf-test-token');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('queues a real generation job, follows it and shows the result (no demo animation)', async () => {
    const fetchMock = stubApi({
      'POST /insights/regenerate': () => json(202, { job: job(), deduplicated: false }),
      'GET /ai/jobs/aij_aa11': () => json(200, job({ status: 'succeeded', terminal: true, progress: 100, result: { generated: 2, refreshed: 0, rejected: 1 } })),
    });
    renderAt('/ai-insights');
    fireEvent.click(await screen.findByRole('button', { name: /generate insights/i }));
    expect(await screen.findByText(/queued — waiting for the worker/i)).toBeInTheDocument();
    expect(await screen.findByText('Insights generated', undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/1 discarded because their claims did not match the evidence/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/insights/regenerate') && i.method === 'POST')!;
    expect((post[1].headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test-token');
    expect(screen.queryByText(/demo/i, { selector: '[role="status"] *' })).toBeNull();
  }, 20000);

  it('labels AI insights with model and evidence quality, and shows deterministic metrics with definitions', async () => {
    stubApi();
    renderAt('/ai-insights');
    const card = (await screen.findByRole('link', { name: AI_INSIGHT.title })).closest('article')!;
    expect(within(card).getByText(/AI-generated · test-model-1/)).toBeInTheDocument();
    expect(within(card).getByText('Evidence: Medium')).toBeInTheDocument();
    expect(await screen.findByText(/campaign metrics \(calculated, no AI\)/i)).toBeInTheDocument();
    expect(screen.getByText(/not enough data for: period comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/reel: 9.10% \(2 items\) — too few to compare/)).toBeInTheDocument();
  });

  it('explains a disabled AI provider and surfaces the server error on generate', async () => {
    stubApi({ 'POST /insights/regenerate': () => err(503, 'ai_disabled', 'AI features are not configured on this server (AI_PROVIDER=none).') }, STATUS_OFF);
    renderAt('/ai-insights');
    expect(await screen.findByText(/ai analysis is not configured on this server/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /generate insights/i }));
    expect(await screen.findByText('AI is not configured')).toBeInTheDocument();
  });

  it('insight detail shows evidence, definitions, periods, provenance and review controls', async () => {
    const fetchMock = stubApi({ [`PATCH /insights/${AI_INSIGHT.id}`]: () => json(200, { ...AI_INSIGHT, status: 'completed' }) });
    renderAt(`/ai-insights/${AI_INSIGHT.id}`);
    expect(await screen.findByText('Engagement rate (by reach)')).toBeInTheDocument();
    expect(screen.getByText(/Σ\(likes \+ comments \+ shares \+ saves\)/)).toBeInTheDocument();
    expect(screen.getByText('2024-10-01 → 2024-10-31')).toBeInTheDocument();
    expect(screen.getByText(/prompt version insights-v1/i)).toBeInTheDocument();
    expect(screen.getByText(/based on the demo dataset/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been changed in your campaigns/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark action completed/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith(`/insights/${AI_INSIGHT.id}`) && i.method === 'PATCH'
      && JSON.parse(String(i.body)).status === 'completed')).toBe(true));
  });

  it('comment labels are suggestions with human confirm/correct', async () => {
    const row: CommentClassification = {
      id: 'cls_aa', source: 'workspace', commentId: 'cmt-1', classifierVersion: 'comments-v1|anthropic:test-model-1',
      prediction: { sentiment: 'positive', intent: 'interest', leadSignal: true, priority: 'medium', uncertainty: 'high', explanation: 'Asks how to join.' },
      injectionSuspected: true, reviewStatus: 'unreviewed', reviewed: null, reviewedAt: null,
      effective: { sentiment: 'positive', intent: 'interest', leadSignal: true, priority: 'medium', uncertainty: 'high', explanation: 'Asks how to join.' },
      createdAt: '2026-10-11T10:00:00Z',
    };
    const fetchMock = stubApi({
      'GET /ai/comments/classifications': () => json(200, [row]),
      'PATCH /ai/comments/classifications/cls_aa': (init) => json(200, { ...row, reviewStatus: 'corrected', ...JSON.parse(String(init.body)) }),
    });
    render(<Shell><CommentAiPanel commentId="cmt-1" /></Shell>);
    expect(await screen.findByText('AI SUGGESTION')).toBeInTheDocument();
    expect(screen.getByText('Not reviewed')).toBeInTheDocument();
    expect(screen.getByText(/looks like instructions to an AI system/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /correct/i }));
    fireEvent.change(screen.getByLabelText('Corrected intent'), { target: { value: 'complaint_support' } });
    fireEvent.click(screen.getByRole('button', { name: /save correction/i }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/cls_aa') && i.method === 'PATCH');
      expect(patch && JSON.parse(String(patch[1].body))).toEqual({ reviewStatus: 'corrected', intent: 'complaint_support' });
    });
  });

  it('follow-up priorities are deterministic and say what they are not', async () => {
    stubApi({ 'GET /ai/leads/priorities': () => json(200, {
      generatedAt: 'x', definition: "Waiting for contact = status 'new' and recorded at least 2 days ago.", dataNote: null,
      waitingForContact: [{ leadId: 'l1', name: 'Sunita Devi', campaign: 'SBI CSP October', daysWaiting: 5, recordedAt: 'x' }],
      newLeadsTotal: 3, byCampaign: [{ campaignId: 'c1', campaign: 'SBI CSP October', total: 4, statuses: { new: 2 } }], byContent: [],
      statusNote: 'Counts are each lead\'s current status, not a historical funnel; stage drop-off rates are not computed.',
    }) });
    render(<Shell><LeadPrioritiesPanel /></Shell>);
    expect(await screen.findByText('waiting 5 days')).toBeInTheDocument();
    expect(screen.getByText(/not a historical funnel/)).toBeInTheDocument();
  });

  it('polls quickly while running and backs off for distant retries', () => {
    const now = Date.parse('2026-10-11T10:00:00Z');
    expect(aiPollDelay(job({ status: 'running' }), now)).toBe(3000);
    expect(aiPollDelay(job({ status: 'retrying', nextRetryAt: '2026-10-11T10:30:00Z' }), now)).toBe(60000);
  });
});
