import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreviewState } from '@/app/PreviewStateContext';

/**
 * Minimal data-fetching hook over the services layer (swap for TanStack Query when the
 * FastAPI backend lands). Results are cached per key for the session; mutations call
 * `invalidateQueries(prefix)` to refetch subscribers.
 */
export type QueryStatus = 'loading' | 'success' | 'empty' | 'error';

export interface QueryResult<T> {
  data: T | undefined;
  status: QueryStatus;
  error: Error | undefined;
  isFetching: boolean;
  refetch: () => void;
}

export class DemoPreviewError extends Error {
  constructor() {
    super('Instagram Graph API rate limit reached (demo error state). Cached metrics are unavailable.');
    this.name = 'DemoPreviewError';
  }
}

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

export function invalidateQueries(prefix: string) {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
  for (const [key, set] of listeners) if (key.startsWith(prefix)) set.forEach((fn) => fn());
}

/** Test helper. */
export function clearQueryCache() {
  cache.clear();
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean; isEmpty?: (data: T) => boolean } = {},
): QueryResult<T> {
  const { enabled = true, isEmpty } = options;
  const { state: preview } = usePreviewState();
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const [error, setError] = useState<Error | undefined>();
  const [isFetching, setIsFetching] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);

  const run = useCallback(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    setIsFetching(true);
    setError(undefined);
    fetcherRef
      .current()
      .then((result) => {
        if (id !== requestId.current) return;
        cache.set(key, result);
        setData(result);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (id === requestId.current) setIsFetching(false);
      });
  }, [key, enabled]);

  useEffect(() => {
    const cached = cache.get(key) as T | undefined;
    setData(cached);
    if (cached === undefined) run();
    const set = listeners.get(key) ?? new Set();
    set.add(run);
    listeners.set(key, set);
    return () => {
      set.delete(run);
    };
  }, [key, run]);

  let status: QueryStatus;
  if (preview === 'loading') status = 'loading';
  else if (preview === 'error') status = 'error';
  else if (preview === 'empty') status = 'empty';
  else if (error) status = 'error';
  else if (data === undefined) status = 'loading';
  else if (isEmpty?.(data) || (Array.isArray(data) && data.length === 0)) status = 'empty';
  else status = 'success';

  return {
    data: preview === 'normal' ? data : undefined,
    status,
    error: preview === 'error' ? new DemoPreviewError() : error,
    isFetching,
    refetch: run,
  };
}
