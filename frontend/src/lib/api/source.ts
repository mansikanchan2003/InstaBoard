import { config } from '@/lib/config';
import { apiClient } from './client';

/**
 * Every service method goes through `fromSource`: in demo mode it resolves the typed
 * demo data (deep-cloned, after a short simulated latency); in api mode it calls the
 * FastAPI endpoint. Pages never import demo data directly.
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

export async function fromSource<T>(demo: () => T, apiPath: string): Promise<T> {
  if (config.dataSource === 'api') {
    return apiClient.get<T>(apiPath);
  }
  if (config.demoLatencyMs > 0) await wait(config.demoLatencyMs);
  return clone(demo());
}

/** Mutations: in demo mode apply the change to the in-memory demo store. */
export async function mutateSource<T>(
  demo: () => T,
  api: { method: 'post' | 'put' | 'patch' | 'delete'; path: string; body?: unknown },
): Promise<T> {
  if (config.dataSource === 'api') {
    return api.method === 'delete' ? apiClient.delete<T>(api.path) : apiClient[api.method]<T>(api.path, api.body);
  }
  if (config.demoLatencyMs > 0) await wait(Math.round(config.demoLatencyMs * 1.5));
  return clone(demo());
}

export { ApiNotFoundError, NotFoundError } from './errors';
