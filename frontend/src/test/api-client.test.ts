import { ApiError, apiClient } from '@/lib/api/client';
import { ApiNotFoundError, NotFoundError } from '@/lib/api/errors';

/** API-mode transport: errors from FastAPI surface as typed errors (never a silent demo fallback). */
function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(body === undefined ? '' : JSON.stringify(body), { status }));
}

describe('apiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed JSON and sends credentials + JSON headers', async () => {
    const fetchMock = respond(200, [{ id: 'sbi-csp-october' }]);
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiClient.get('/campaigns')).resolves.toEqual([{ id: 'sbi-csp-october' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8100/api/v1/campaigns');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('serialises request bodies for writes', async () => {
    const fetchMock = respond(200, { id: 'lead-1' });
    vi.stubGlobal('fetch', fetchMock);
    await apiClient.patch('/leads/lead-1', { status: 'contacted' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ status: 'contacted' }) });
  });

  it('maps 404 to NotFoundError so screens show their not-found state', async () => {
    vi.stubGlobal('fetch', respond(404, { error: { code: 'not_found', message: "Campaign 'x' was not found", details: null } }));
    const error = await apiClient.get('/campaigns/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(ApiNotFoundError);
    expect((error as Error).message).toBe("Campaign 'x' was not found");
  });

  it('keeps the backend message and code for other errors (e.g. 501 not_available)', async () => {
    vi.stubGlobal('fetch', respond(501, { error: { code: 'not_available', message: 'Instagram sync is not available', details: null } }));
    const error = (await apiClient.post('/accounts/acc-ekoindia/sync').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(501);
    expect(error.code).toBe('not_available');
    expect(error.message).toBe('Instagram sync is not available');
  });

  it('reports an unreachable backend clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = (await apiClient.get('/campaigns').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('network_error');
    expect(error.message).toMatch(/Cannot reach the InstaBoard API/);
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 })));
    const error = (await apiClient.get('/campaigns').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.message).toBe('Request failed: GET /campaigns (502)');
  });
});
