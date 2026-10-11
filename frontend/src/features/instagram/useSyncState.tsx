import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries, useQuery } from '@/hooks/useQuery';
import { ApiError } from '@/lib/api/client';
import { instagramService } from '@/services/instagram';
import type { SyncJob } from '@/types/instagram';

/** Poll every 3 s while a job is queued/running; while it waits for a retry, check again shortly after it is due. */
export const POLL_ACTIVE_MS = 3000;
const POLL_MAX_MS = 60_000;

export function pollDelay(job: SyncJob, now = Date.now()): number {
  if (job.status === 'retrying' && job.nextRetryAt) {
    const due = new Date(job.nextRetryAt).getTime() - now;
    return Math.min(POLL_MAX_MS, Math.max(POLL_ACTIVE_MS, due + 2000));
  }
  return POLL_ACTIVE_MS;
}

const STAGES: Record<string, string> = {
  token: 'Checking access token',
  media: 'Fetching media',
  media_insights: 'Fetching media insights',
  account_insights: 'Fetching account insights',
  comments: 'Fetching comments',
  finishing: 'Saving',
  done: 'Done',
};

export function stageLabel(job: SyncJob): string {
  if (job.status === 'queued') return 'Queued — waiting for a worker';
  if (job.status === 'retrying') return `Retrying (${job.retryCount}/${job.maxRetries})${job.nextRetryAt ? ` at ${new Date(job.nextRetryAt).toLocaleTimeString()}` : ''}`;
  return STAGES[job.progressStage ?? ''] ?? 'Syncing';
}

export function describeJob(job: SyncJob): { tone: 'success' | 'error' | 'warning' | 'info'; title: string; description: string } {
  const counts = `${job.mediaFetched} media, ${job.mediaInsightsFetched} media metrics, ${job.accountInsightsFetched} account metrics, ${job.commentsFetched} comments`;
  switch (job.status) {
    case 'succeeded':
      return { tone: 'success', title: 'Sync complete', description: `${counts} stored.` };
    case 'partially_succeeded':
      return { tone: 'warning', title: 'Sync finished with gaps', description: `${counts} stored. Some data was unavailable from Instagram.` };
    case 'cancelled':
      return { tone: 'info', title: 'Sync cancelled', description: job.errorMessage ?? 'The sync was cancelled.' };
    case 'retrying':
      return { tone: 'warning', title: job.errorCategory === 'rate_limited' ? 'Instagram rate limit — retrying later' : 'Temporary problem — retrying', description: job.errorMessage ?? '' };
    default: {
      const auth = ['token_invalid', 'token_expired', 'token_missing', 'token_unreadable', 'permission_denied', 'reauth_required'].includes(job.errorCategory ?? '');
      return {
        tone: 'error',
        title: auth ? 'Reauthorization needed' : job.errorCategory === 'rate_limited' ? 'Instagram rate limit reached' : 'Sync failed',
        description: job.errorMessage ?? 'The sync did not complete.',
      };
    }
  }
}

/**
 * Sync state of one live account: GET …/sync-status plus polling of the current job until it is terminal.
 * Polling stops when the component unmounts or the job finishes; affected queries are then refreshed.
 */
export function useSyncState(accountId: string, opts: { notify?: boolean } = {}) {
  const toast = useToast();
  const status = useQuery(`instagram:sync-status:${accountId}`, () => instagramService.syncStatus(accountId), { isEmpty: () => false });
  const [job, setJob] = useState<SyncJob | null>(null);
  const [starting, setStarting] = useState(false);
  const notify = opts.notify ?? true;
  // A job we already saw finish may still be listed as current by a not-yet-refreshed status response.
  const finishedLocally = job?.terminal && status.data?.currentJob?.id === job.id;
  const active = job && !job.terminal ? job : finishedLocally ? null : status.data?.currentJob ?? null;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!active || active.terminal) return undefined;
    let cancelled = false;
    timer.current = setTimeout(async () => {
      try {
        const next = await instagramService.job(active.id);
        if (cancelled) return;
        setJob(next);
        if (next.terminal) {
          if (notify) toast(describeJob(next));
          invalidateQueries('instagram');
          invalidateQueries('dashboard');
        }
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status === 404) setJob(null);
      }
    }, pollDelay(active));
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [active, notify, toast]);

  const start = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { job: queued, deduplicated } = await instagramService.sync(accountId);
      setJob(queued);
      if (notify) toast({ tone: 'info', title: deduplicated ? 'A sync is already in progress' : 'Sync queued', description: 'It runs in the background; this page updates when it finishes.' });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const title = e instanceof ApiError && e.status === 429 ? 'Please wait' : e instanceof ApiError && e.status === 503 ? 'Background sync unavailable'
        : e instanceof ApiError && e.status === 409 ? 'Not possible right now' : e instanceof ApiError && e.status === 403 ? 'Permission denied' : 'Could not queue the sync';
      toast({ tone: 'error', title, description: e.message });
    } finally {
      setStarting(false);
    }
  }, [accountId, notify, starting, toast]);

  const cancel = useCallback(async () => {
    if (!active) return;
    try {
      setJob(await instagramService.cancelJob(active.id));
    } catch (err) {
      toast({ tone: 'error', title: 'Could not cancel', description: err instanceof Error ? err.message : String(err) });
    }
  }, [active, toast]);

  return { status, active, lastJob: job?.terminal ? job : status.data?.lastJob ?? null, start, starting, cancel };
}
