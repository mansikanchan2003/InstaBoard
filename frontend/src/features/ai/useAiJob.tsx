import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries } from '@/hooks/useQuery';
import { ApiError } from '@/lib/api/client';
import { aiService } from '@/services/ai';
import type { AIJob, EnqueuedAIJob } from '@/types/ai';

const POLL_MS = 3000;
const POLL_MAX_MS = 60_000;

export function aiPollDelay(job: AIJob, now = Date.now()): number {
  if (job.status === 'retrying' && job.nextRetryAt) return Math.min(POLL_MAX_MS, Math.max(POLL_MS, new Date(job.nextRetryAt).getTime() - now + 2000));
  return POLL_MS;
}

const STAGES: Record<string, string> = {
  analytics: 'Computing metrics',
  model: 'Asking the AI model',
  verify: 'Verifying claims against evidence',
  classifying: 'Classifying comments',
  summarising: 'Summarising lead context',
};

export function aiStageLabel(job: AIJob): string {
  if (job.status === 'queued') return 'Queued — waiting for the worker';
  if (job.status === 'retrying') return `Retrying (${job.retryCount}/${job.maxRetries})${job.errorCategory === 'rate_limited' ? ' — provider rate limit' : ''}`;
  return STAGES[job.progressStage ?? ''] ?? 'Working';
}

export function describeAiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiError) {
    if (err.code === 'ai_disabled') return { title: 'AI is not configured', description: err.message };
    if (err.code === 'ai_budget_exceeded') return { title: 'AI usage limit reached', description: err.message };
    if (err.code === 'background_sync_unavailable') return { title: 'Background worker not configured', description: err.message };
    if (err.status === 403) return { title: 'Permission denied', description: err.message };
    if (err.status === 422) return { title: 'Invalid request', description: err.message };
  }
  return { title: 'AI request failed', description: err instanceof Error ? err.message : String(err) };
}

function describeJob(job: AIJob): { tone: 'success' | 'warning' | 'error' | 'info'; title: string; description: string } {
  const r = job.result as Record<string, number | boolean | string | null>;
  if (job.status === 'failed') {
    const title = job.errorCategory === 'rate_limited' ? 'AI provider rate limit' : job.errorCategory === 'provider_auth' ? 'AI provider configuration problem'
      : job.errorCategory === 'budget_exceeded' ? 'AI usage limit reached' : 'AI job failed';
    return { tone: 'error', title, description: job.errorMessage ?? 'The job did not complete.' };
  }
  if (job.status === 'cancelled') return { tone: 'info', title: 'AI job cancelled', description: job.errorMessage ?? '' };
  if (job.kind === 'insights') {
    if (r.insufficientData) return { tone: 'info', title: 'Not enough data for insights', description: String(r.note ?? 'Widen the period or wait for more data.') };
    if (r.cached) return { tone: 'success', title: 'Insights are up to date', description: 'The evidence has not changed since the last analysis, so no new model call was made.' };
    return {
      tone: job.status === 'partially_succeeded' ? 'warning' : 'success',
      title: 'Insights generated',
      description: `${r.generated ?? 0} new, ${r.refreshed ?? 0} refreshed${r.rejected ? `, ${r.rejected} discarded because their claims did not match the evidence` : ''}.`,
    };
  }
  if (job.kind === 'comment_classification') {
    return { tone: job.status === 'partially_succeeded' ? 'warning' : 'success', title: 'Comments classified',
      description: `${r.classified ?? 0} classified${r.unlabelled ? `, ${r.unlabelled} returned without a label` : ''}. AI labels are suggestions until reviewed.` };
  }
  return { tone: 'success', title: 'Lead summary ready', description: 'Review the AI suggestion before acting on it.' };
}

/** Start an AI job and poll it until terminal; affected queries are refreshed when it finishes. */
export function useAiJob(opts: { invalidate: string[] }) {
  const toast = useToast();
  const [job, setJob] = useState<AIJob | null>(null);
  const [starting, setStarting] = useState(false);
  const active = job && !job.terminal ? job : null;

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const next = await aiService.job(active.id);
        if (cancelled) return;
        setJob(next);
        if (next.terminal) {
          toast(describeJob(next));
          opts.invalidate.forEach(invalidateQueries);
        }
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status === 404) setJob(null);
      }
    }, aiPollDelay(active));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, opts.invalidate, toast]);

  const start = useCallback(async (request: () => Promise<EnqueuedAIJob>) => {
    if (starting || active) return;
    setStarting(true);
    try {
      const { job: queued, deduplicated } = await request();
      setJob(queued);
      if (deduplicated) toast({ tone: 'info', title: 'Already in progress', description: 'An identical AI job is already queued or running.' });
    } catch (err) {
      toast({ tone: 'error', ...describeAiError(err) });
    } finally {
      setStarting(false);
    }
  }, [active, starting, toast]);

  return { job, active, start, starting };
}
