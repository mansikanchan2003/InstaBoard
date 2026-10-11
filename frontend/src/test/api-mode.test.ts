/**
 * API mode (VITE_DATA_SOURCE=api): service methods call the real FastAPI contract and surface
 * backend errors — they never fall back to demo data.
 */
vi.mock('@/lib/config', () => ({
  config: { dataSource: 'api', apiBaseUrl: 'http://api.test/api/v1', demoLatencyMs: 0 },
  isDemoMode: false,
  modeText: (_demo: string, api: string) => api,
}));

import { ApiError } from '@/lib/api/client';
import { campaignService } from '@/services/campaigns';
import { commentsService } from '@/services/comments';
import { leadService } from '@/services/leads';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('services in api mode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves lead notes with PATCH /leads/{id}', async () => {
    const fetchMock = mockFetch(200, { id: 'lead-1', notes: 'Called' });
    await expect(leadService.updateDetails('lead-1', { notes: 'Called' })).resolves.toMatchObject({ notes: 'Called' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/leads/lead-1');
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ notes: 'Called' }) });
  });

  it('converts a comment with one POST (server does lead + comment atomically)', async () => {
    const fetchMock = mockFetch(201, { lead: { id: 'lead-9' }, comment: { id: 'cmt-1', status: 'lead_created' }, created: true });
    const result = await commentsService.convertToLead('cmt-1');
    expect(result.created).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/v1/comments/cmt-1/convert-to-lead');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('returns created=false from POST /leads for an existing handle', async () => {
    mockFetch(200, { lead: { id: 'lead-ramesh-maurya' }, created: false });
    await expect(
      leadService.createFromComment({ name: 'R', handle: 'ramesh_m_up', location: 'X', campaignId: 'c', contentId: null, score: 50, source: 'comment', firstMessage: 'hi' }),
    ).resolves.toEqual({ lead: { id: 'lead-ramesh-maurya' }, created: false });
  });

  it('surfaces a 409 transition conflict with the server message', async () => {
    mockFetch(409, { error: { code: 'conflict', message: 'A completed campaign cannot be moved to active.', details: {} } });
    const error = (await campaignService.setStatus('digital-banking-awareness', 'active').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('A completed campaign cannot be moved to active.');
  });

  it('does not fall back to demo data when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(leadService.list()).rejects.toThrow(/Cannot reach the InstaBoard API/);
  });
});
