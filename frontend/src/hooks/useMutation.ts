import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries } from './useQuery';

interface MutationOptions<TResult> {
  /** Query-key prefixes to refetch after success. */
  invalidate?: string[];
  onSuccess?: (result: TResult) => void;
  /** Custom error handling. When omitted, the error is shown in a toast so failures are never silent. */
  onError?: (err: Error) => void;
}

/** Stable key for "the same submission" (same arguments). */
function submissionKey(args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    return String(Math.random()); // unserialisable args: never treat as duplicates
  }
}

/**
 * Wraps a service mutation with pending/error state and cache invalidation.
 *
 * - The UI updates only after the service (demo store or API) succeeds — no optimistic writes.
 * - Duplicate submissions are ignored: calling `mutate` again with the same arguments while that call
 *   is still in flight returns `undefined` without sending a second request (e.g. double clicks).
 * - After any successful write the activity log is refreshed too, because the backend records an
 *   audit entry for user-triggered changes.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TResult> = {},
) {
  const toast = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<Error | undefined>();
  const inFlight = useRef(new Set<string>());
  const latest = useRef({ fn, options, toast });
  latest.current = { fn, options, toast };

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    const { fn: run, options: opts, toast: notify } = latest.current;
    const key = submissionKey(args);
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    setPendingCount((n) => n + 1);
    setError(undefined);
    try {
      const result = await run(...args);
      opts.invalidate?.forEach(invalidateQueries);
      invalidateQueries('activity');
      opts.onSuccess?.(result);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      if (opts.onError) opts.onError(e);
      else notify({ tone: 'error', title: 'Action failed', description: e.message });
      return undefined;
    } finally {
      inFlight.current.delete(key);
      setPendingCount((n) => n - 1);
    }
  }, []);

  return { mutate, isPending: pendingCount > 0, error };
}
