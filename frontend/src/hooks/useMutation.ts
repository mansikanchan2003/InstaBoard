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

/** Wraps a service mutation with pending/error state and cache invalidation. */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TResult> = {},
) {
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const latest = useRef({ fn, options, toast });
  latest.current = { fn, options, toast };

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    const { fn: run, options: opts, toast: notify } = latest.current;
    setIsPending(true);
    setError(undefined);
    try {
      const result = await run(...args);
      opts.invalidate?.forEach(invalidateQueries);
      opts.onSuccess?.(result);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      if (opts.onError) opts.onError(e);
      else notify({ tone: 'error', title: 'Action failed', description: e.message });
      return undefined;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { mutate, isPending, error };
}
