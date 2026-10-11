import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries, useQuery } from '@/hooks/useQuery';
import { aiService } from '@/services/ai';
import type { CommentIntentLabel, CommentLabels } from '@/types/ai';
import { AiJobProgress } from './AiWidgets';
import { describeAiError, useAiJob } from './useAiJob';

export const intentLabels: Record<CommentIntentLabel, string> = {
  product_inquiry: 'Product / service inquiry',
  pricing_inquiry: 'Pricing inquiry',
  contact_request: 'Contact request',
  interest: 'Expressed interest',
  complaint_support: 'Complaint / support',
  spam_irrelevant: 'Spam / irrelevant',
  other: 'Other',
};
const SENTIMENTS: CommentLabels['sentiment'][] = ['positive', 'neutral', 'negative'];

/** Toolbar (api mode): queue AI classification for comments without a current label and follow the job. */
export function CommentAiToolbar() {
  const job = useAiJob({ invalidate: ['ai:cls'] });
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-ai-subtle border border-ai-border rounded p-3 mb-4">
      <div className="flex-1 text-body-sm text-text-primary">
        <span className="font-semibold">AI comment classification</span>
        <span className="text-text-secondary"> — sentiment, intent and lead signal as suggestions for review. Comment text is treated as data; nothing is posted or converted automatically.</span>
        {job.active && <div className="mt-2 max-w-md"><AiJobProgress job={job.active} /></div>}
      </div>
      <Button icon="auto_awesome" variant="primary" onClick={() => void job.start(() => aiService.classifyComments())} loading={job.starting} disabled={!!job.active}>
        {job.active ? 'Classifying…' : 'Classify unlabelled comments'}
      </Button>
    </div>
  );
}

/** AI prediction for one comment + human review (confirm / correct). The prediction is never overwritten. */
export function CommentAiPanel({ commentId }: { commentId: string }) {
  const toast = useToast();
  const q = useQuery(`ai:cls:${commentId}`, () => aiService.classifications([commentId]), { isEmpty: () => false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<CommentLabels>>({});
  const [saving, setSaving] = useState(false);
  const row = q.data?.[0];

  const save = async (reviewStatus: 'confirmed' | 'corrected') => {
    if (!row) return;
    setSaving(true);
    try {
      await aiService.reviewClassification(row.id, reviewStatus === 'confirmed' ? { reviewStatus } : { reviewStatus, ...draft });
      toast({ title: reviewStatus === 'confirmed' ? 'AI label confirmed' : 'Correction saved', description: 'Stored as a human review next to the AI prediction.' });
      setEditing(false);
      invalidateQueries('ai:cls');
    } catch (err) {
      toast({ tone: 'error', ...describeAiError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (q.status === 'loading') return <Skeleton className="h-20" />;
  if (q.error) return <p className="text-[12px] text-error">AI labels could not be loaded: {q.error.message}</p>;
  if (!row) return <p className="text-[12px] text-text-tertiary">No AI label yet. Use “Classify unlabelled comments” above.</p>;
  const eff = row.effective;
  return (
    <div className="rounded border border-ai-border bg-ai-subtle/60 p-3 space-y-2" aria-label="AI classification">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-label-code font-label-code text-ai-accent font-bold"><Icon name="auto_awesome" className="text-[13px]" /> AI SUGGESTION</span>
        <Badge tone={row.reviewStatus === 'unreviewed' ? 'amber' : 'active'}>{row.reviewStatus === 'unreviewed' ? 'Not reviewed' : row.reviewStatus === 'confirmed' ? 'Confirmed by a person' : 'Corrected by a person'}</Badge>
        <span className="text-[11px] text-text-tertiary">Uncertainty: {row.prediction.uncertainty}</span>
      </div>
      {row.injectionSuspected && (
        <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">This comment contains text that looks like instructions to an AI system. It was treated as plain text; please review the label.</p>
      )}
      <dl className="grid grid-cols-3 gap-2 text-[12px]">
        <div><dt className="text-text-tertiary">Sentiment</dt><dd className="font-semibold text-text-primary capitalize">{eff.sentiment}</dd></div>
        <div><dt className="text-text-tertiary">Intent</dt><dd className="font-semibold text-text-primary">{intentLabels[eff.intent]}</dd></div>
        <div><dt className="text-text-tertiary">Lead signal</dt><dd className="font-semibold text-text-primary">{eff.leadSignal ? 'Yes' : 'No'}</dd></div>
      </dl>
      <p className="text-[12px] text-text-secondary">“{row.prediction.explanation}”</p>
      {row.reviewStatus === 'corrected' && <p className="text-[11px] text-text-tertiary">Original AI prediction: {row.prediction.sentiment} · {intentLabels[row.prediction.intent]} · lead signal {row.prediction.leadSignal ? 'yes' : 'no'}</p>}
      {editing ? (
        <div className="space-y-2 text-[12px]">
          <div className="flex flex-wrap gap-2">
            <select aria-label="Corrected sentiment" className="h-8 border border-border-strong rounded px-2" value={draft.sentiment ?? eff.sentiment} onChange={(e) => setDraft((d) => ({ ...d, sentiment: e.target.value as CommentLabels['sentiment'] }))}>
              {SENTIMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Corrected intent" className="h-8 border border-border-strong rounded px-2" value={draft.intent ?? eff.intent} onChange={(e) => setDraft((d) => ({ ...d, intent: e.target.value as CommentIntentLabel }))}>
              {Object.entries(intentLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="flex items-center gap-1"><input type="checkbox" checked={draft.leadSignal ?? eff.leadSignal} onChange={(e) => setDraft((d) => ({ ...d, leadSignal: e.target.checked }))} /> Lead signal</label>
          </div>
          <div className="flex gap-2">
            <Button size="xs" variant="primary" onClick={() => void save('corrected')} loading={saving} disabled={Object.keys(draft).length === 0}>Save correction</Button>
            <Button size="xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="xs" icon="check" onClick={() => void save('confirmed')} loading={saving} disabled={row.reviewStatus === 'confirmed'}>Confirm</Button>
          <Button size="xs" icon="edit" onClick={() => { setDraft({}); setEditing(true); }}>Correct</Button>
        </div>
      )}
    </div>
  );
}
