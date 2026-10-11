import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { aiService } from '@/services/ai';
import type { LeadPriorities } from '@/types/ai';
import { AiJobProgress } from './AiWidgets';
import { useAiJob } from './useAiJob';

/** AI follow-up summary for one lead (api mode). Clearly a suggestion; nothing is sent to the lead. */
export function LeadAiSummaryPanel({ leadId }: { leadId: string }) {
  const summary = useQuery(`ai:lead-summary:${leadId}`, () => aiService.leadSummary(leadId), { isEmpty: () => false });
  const job = useAiJob({ invalidate: [`ai:lead-summary:${leadId}`] });
  const data = summary.data;
  return (
    <section className="rounded-lg border border-ai-border bg-ai-subtle/60 p-3 space-y-2" aria-label="AI follow-up summary">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-label-code font-label-code text-ai-accent font-bold"><Icon name="auto_awesome" className="text-[13px]" /> AI FOLLOW-UP SUGGESTION</span>
        <Button size="xs" onClick={() => void job.start(() => aiService.requestLeadSummary(leadId))} loading={job.starting} disabled={!!job.active}>
          {data ? 'Refresh' : 'Summarise'}
        </Button>
      </div>
      {job.active && <AiJobProgress job={job.active} />}
      {summary.status === 'loading' ? <Skeleton className="h-12" /> : summary.error ? (
        <p className="text-[12px] text-error">{summary.error.message}</p>
      ) : data ? (
        <div className="text-[12px] space-y-1.5">
          <p className="text-text-primary">{data.summary}</p>
          <p><span className="text-text-tertiary">Why follow up: </span>{data.followUpReason}</p>
          <p><span className="text-text-tertiary">Suggested next action: </span><span className="font-semibold">{data.suggestedNextAction}</span></p>
          <p className="text-[11px] text-text-tertiary">
            Uncertainty: {data.uncertainty} · {new Date(data.createdAt).toLocaleString()} · uses only status, campaign, source, age and the first message — no conversion probability is estimated.
          </p>
          {data.injectionSuspected && <Badge tone="amber">First message contained instruction-like text — review carefully</Badge>}
        </div>
      ) : (
        <p className="text-[12px] text-text-tertiary">No summary yet. A summary is a suggestion for review; it does not contact the lead.</p>
      )}
    </section>
  );
}

/** Deterministic follow-up priorities (works without AI). */
export function LeadPrioritiesPanel() {
  const q = useQuery('ai:lead-priorities', aiService.leadPriorities, { isEmpty: () => false });
  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4" aria-labelledby="lead-priorities">
      <h2 id="lead-priorities" className="font-headline-sm text-headline-sm font-bold text-text-primary">Follow-up priorities</h2>
      <QueryState query={q} loading={<Skeleton className="h-16" />}>
        {(p: LeadPriorities) => (
          <div className="mt-2 space-y-2 text-body-sm">
            <p className="text-[12px] text-text-tertiary">{p.definition}{p.dataNote ? ` ${p.dataNote}` : ''}</p>
            {p.waitingForContact.length === 0 ? (
              <p className="text-text-secondary">No new leads have been waiting long enough to flag ({p.newLeadsTotal} new in total).</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {p.waitingForContact.slice(0, 8).map((w) => (
                  <li key={w.leadId} className="py-1.5 flex justify-between gap-2">
                    <span><span className="font-semibold">{w.name}</span>{w.campaign ? ` · ${w.campaign}` : ''}</span>
                    <span className="text-[12px] text-amber-800">waiting {w.daysWaiting} days</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 text-[12px]">
              {p.byCampaign.slice(0, 6).map((c) => (
                <span key={c.campaignId} className="px-2 py-1 rounded border border-border-strong bg-surface-canvas">{c.campaign}: {c.total} lead{c.total === 1 ? '' : 's'}</span>
              ))}
            </div>
            <p className="text-[11px] text-text-tertiary">{p.statusNote}</p>
          </div>
        )}
      </QueryState>
    </section>
  );
}
