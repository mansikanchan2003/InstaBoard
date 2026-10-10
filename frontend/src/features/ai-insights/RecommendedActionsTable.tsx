import { modeText } from '@/lib/config';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TableShell } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { cn } from '@/lib/format';
import { insightsService } from '@/services/insights';
import type { RecommendedAction } from '@/types/insights';
import { actionStatusMeta, PriorityPill } from './insightMeta';

const reasons = ['Not relevant to current goals', 'Already in progress', 'Data looks incorrect', 'Needs more evidence', 'Other'];
const th = 'py-2.5 px-4 font-semibold whitespace-nowrap';

/** "Prioritized Recommended Actions" — mark done / dismiss (with feedback) / mark all reviewed, stored locally. */
export function RecommendedActionsTable({ actions }: { actions: RecommendedAction[] }) {
  const toast = useToast();
  const [dismissing, setDismissing] = useState<RecommendedAction>();
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState('');

  const setStatus = useMutation(insightsService.setActionStatus, { invalidate: ['insights'] });
  const reviewAll = useMutation(insightsService.markAllActionsReviewed, {
    invalidate: ['insights'],
    onSuccess: (r) => toast({ tone: 'success', title: r.updated ? `${r.updated} action${r.updated === 1 ? '' : 's'} marked reviewed` : 'All actions already reviewed' }),
  });

  const active = actions.filter((a) => a.status !== 'dismissed' && a.status !== 'done').length;

  const markDone = async (a: RecommendedAction) => {
    const next = a.status === 'done' ? 'reviewed' : 'done';
    const res = await setStatus.mutate(a.id, next);
    if (res)
      toast({
        tone: 'success',
        title: next === 'done' ? 'Action marked as done' : 'Action reopened',
        description: next === 'done' ? modeText('Tracked locally only — InstaBoard does not change Instagram campaigns automatically.', 'Saved in InstaBoard only — InstaBoard does not change Instagram campaigns automatically.') : undefined,
      });
  };

  const confirmDismiss = async () => {
    if (!dismissing) return;
    const feedback = note.trim() ? `${reason}: ${note.trim()}` : reason;
    const res = await setStatus.mutate(dismissing.id, 'dismissed', feedback);
    if (res) {
      toast({ tone: 'success', title: 'Recommendation dismissed', description: `Feedback recorded${modeText(' locally', '')}: "${feedback}".` });
      setDismissing(undefined);
      setNote('');
      setReason(reasons[0]);
    }
  };

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-headline-sm font-headline-sm text-text-primary font-bold">Prioritized Recommended Actions</h2>
            <span className="px-2 py-0.5 rounded text-label-code font-label-code bg-surface-canvas border border-border-strong text-text-secondary">{active} ACTIVE</span>
          </div>
          <p className="text-body-sm font-body-sm text-text-secondary mt-0.5">Prescriptive next steps ranked by model confidence and projected lead return.</p>
        </div>
        <Button size="sm" onClick={() => reviewAll.mutate()} loading={reviewAll.isPending} className="rounded">
          Mark All Reviewed
        </Button>
      </div>
      <TableShell>
        <thead>
          <tr className="bg-surface-canvas text-text-secondary font-label-sm text-label-sm uppercase tracking-wider border-b border-border-strong text-left">
            <th className={cn(th, 'w-24')}>Priority</th>
            <th className={th}>Action &amp; Operational Rationale</th>
            <th className={th}>Supporting Metric</th>
            <th className={th}>Expected Impact</th>
            <th className={th}>Target Module</th>
            <th className={cn(th, 'w-36')}>Status</th>
            <th className={cn(th, 'text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-strong text-body-md font-body-md">
          {actions.map((a) => (
            <tr key={a.id} className={cn('hover:bg-surface-canvas transition-colors', a.status === 'dismissed' && 'opacity-60')}>
              <td className="py-3 px-4">
                <PriorityPill priority={a.priority} short />
              </td>
              <td className="py-3 px-4 max-w-sm whitespace-normal">
                <Link to={`/ai-insights/${a.insightId}`} className="font-semibold text-text-primary hover:underline">
                  {a.title}
                </Link>
                <div className="text-body-sm font-body-sm text-text-secondary truncate" title={a.rationale}>
                  {a.rationale}
                </div>
                {a.feedback && <div className="text-label-code font-label-code text-text-tertiary mt-0.5">Feedback: {a.feedback}</div>}
              </td>
              <td className="py-3 px-4 text-body-sm font-body-sm">
                <div className="font-medium text-text-primary">{a.metric}</div>
                <div className={a.metricNoteTone === 'negative' ? 'text-error' : 'text-text-tertiary'}>{a.metricNote}</div>
              </td>
              <td className="py-3 px-4">
                <div className="text-status-active font-semibold text-body-sm font-body-sm">{a.impact}</div>
                <div className="text-label-code font-label-code text-text-tertiary uppercase">[ESTIMATED]</div>
              </td>
              <td className="py-3 px-4">
                <Link to={a.target.to} className="inline-flex items-center gap-1 text-label-md font-label-md text-primary hover:underline font-medium">
                  <span>{a.target.label}</span>
                  <Icon name="open_in_new" className="text-[14px]" />
                </Link>
              </td>
              <td className="py-3 px-4">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label-sm font-semibold whitespace-nowrap', actionStatusMeta[a.status].pill)}>
                  {actionStatusMeta[a.status].label}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => markDone(a)}
                    disabled={a.status === 'dismissed' || setStatus.isPending}
                    aria-label={a.status === 'done' ? `Reopen: ${a.title}` : `Mark done: ${a.title}`}
                    title={a.status === 'done' ? 'Reopen recommendation' : 'Accept / mark done'}
                    className={cn('p-1 rounded hover:bg-status-active-subtle disabled:opacity-40', a.status === 'done' ? 'text-white bg-status-active hover:bg-status-active' : 'text-status-active')}
                  >
                    <Icon name="check" />
                  </button>
                  {a.status === 'dismissed' ? (
                    <button
                      type="button"
                      onClick={() => setStatus.mutate(a.id, 'pending_review')}
                      aria-label={`Restore: ${a.title}`}
                      title="Restore recommendation"
                      className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-canvas"
                    >
                      <Icon name="undo" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDismissing(a)}
                      aria-label={`Dismiss: ${a.title}`}
                      title="Dismiss recommendation"
                      className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-container/20"
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <div className="px-4 py-2.5 bg-surface-canvas border-t border-border-strong flex flex-wrap items-center justify-between gap-2 text-label-sm font-label-sm text-text-secondary">
        <span>
          Showing {actions.length} of {actions.length} prioritized actions for October 2024
        </span>
        <div className="flex items-center gap-1">
          <span className="text-text-tertiary mr-2">Evaluation period: 30 days</span>
          <button
            type="button"
            onClick={() => toast({ tone: 'demo', title: 'Rule configuration needs the backend', description: 'Recommendation rules and thresholds can be configured once the FastAPI service is connected.' })}
            className="px-2 py-1 rounded bg-surface-card border border-border-strong font-medium text-text-primary hover:bg-surface-canvas"
          >
            Configure Rules
          </button>
        </div>
      </div>

      <Modal
        open={!!dismissing}
        onClose={() => setDismissing(undefined)}
        title="Dismiss recommendation"
        subtitle={dismissing?.title}
        icon="feedback"
        size="sm"
        footer={
          <>
            <Button onClick={() => setDismissing(undefined)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDismiss} loading={setStatus.isPending}>
              Dismiss
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Why are you dismissing this?" htmlFor="dismiss-reason">
            <select
              id="dismiss-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 px-3 bg-surface-card border border-slate-300 rounded-lg text-label-md text-text-primary focus:outline-none focus:border-border-focused"
            >
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Additional feedback (optional)" htmlFor="dismiss-note" hint={modeText('Feedback is stored locally in this prototype and would be used to tune the model.', 'Feedback is saved in InstaBoard; no model is trained on it in this phase.')}>
            <textarea
              id="dismiss-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={280}
              className="w-full px-3 py-2 bg-surface-card border border-slate-300 rounded-lg text-label-md text-text-primary focus:outline-none focus:border-border-focused"
            />
          </Field>
        </div>
      </Modal>
    </section>
  );
}
