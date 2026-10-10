import { Icon } from '@/components/ui/Icon';
import { cn, formatNumber } from '@/lib/format';
import type { CommentIntent, CommentSummary } from '@/types/comments';
import { intentMeta, pct } from './commentMeta';

/** Section 3 (right) of the export: AI intent classification matrix. Rows filter the triage table. */
export function IntentMatrix({ summary, activeIntent, onSelect }: { summary: CommentSummary; activeIntent: CommentIntent | 'all'; onSelect: (intent: CommentIntent) => void }) {
  const total = summary.totalComments;
  const rows = summary.intents.filter((i) => i.intent !== 'other');
  const spam = summary.intents.find((i) => i.intent === 'other');
  const max = Math.max(...rows.map((r) => r.comments));

  return (
    <div className="lg:col-span-7 bg-surface-card border border-border-strong rounded p-4 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-headline-sm font-headline-sm text-text-primary">AI Intent Classification Matrix</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-label-code font-label-code bg-ai-subtle border border-ai-border text-ai-accent">AI-GENERATED CLASSIFICATION</span>
            </div>
            <p className="text-body-sm font-body-sm text-text-secondary mt-0.5">Automated detection of user commercial propensity and inquiry typology</p>
          </div>
          <span className="text-label-sm font-label-sm text-text-tertiary">{formatNumber(total)} total comments analyzed</span>
        </div>
        <ul className="space-y-2.5">
          {rows.map((r, idx) => {
            const meta = intentMeta[r.intent];
            const major = idx < 3;
            const active = activeIntent === r.intent;
            return (
              <li key={r.intent}>
                <button
                  type="button"
                  onClick={() => onSelect(r.intent)}
                  aria-pressed={active}
                  className={cn(
                    'w-full text-left rounded border transition-colors',
                    major ? 'p-2.5 bg-surface-canvas' : 'p-2 bg-surface-card',
                    active ? 'border-primary-container ring-1 ring-primary-container/40' : 'border-border-strong hover:border-primary-container',
                  )}
                >
                  <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 text-body-sm font-body-sm', major ? 'mb-1.5' : 'mb-1')}>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {major && <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />}
                      <span className={cn(major ? 'text-text-primary' : r.intent === 'complaint' ? 'text-error font-medium' : 'text-text-secondary font-medium', idx === 0 ? 'font-bold' : idx === 1 ? 'font-semibold' : 'font-medium')}>
                        {r.label}
                      </span>
                      {r.tag && (
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-label-code font-label-code',
                            r.tag.tone === 'amber' ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-ai-subtle text-ai-accent border border-ai-border',
                          )}
                        >
                          {r.tag.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn('text-label-sm font-label-sm', major ? 'font-medium text-text-secondary' : 'text-text-tertiary')}>
                        {formatNumber(r.potentialLeads)} {idx === 0 || !major ? 'leads' : 'potential leads'}
                      </span>
                      <span className={cn('text-label-code font-label-code', r.intent === 'complaint' ? 'text-error' : 'text-text-secondary')}>
                        {pct(r.comments, total)}
                        {major ? ' share' : ''}
                      </span>
                      <span className={cn('text-text-primary tnum', major ? 'font-bold' : 'font-semibold')}>{formatNumber(r.comments)}</span>
                    </div>
                  </div>
                  <div className={cn('w-full rounded-full overflow-hidden', major ? 'bg-surface-card h-2 border border-border-strong' : 'bg-surface-canvas h-1.5')}>
                    <div className={cn('h-full rounded-full', meta.dot)} style={{ width: `${(r.comments / max) * 85}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="pt-3 border-t border-border-strong mt-3 flex items-start gap-2 text-label-sm font-label-sm text-text-secondary">
        <Icon name="auto_awesome" className="text-ai-accent text-[14px] mt-0.5" />
        <span>
          <strong>Intent analysis is AI-inferred</strong> using LLM classification of comment text (demo classifications in this prototype). Classification confidence threshold:{' '}
          {summary.classificationConfidence}%.{spam && ` ${formatNumber(spam.comments)} spam / off-topic comments (${pct(spam.comments, total)}) are excluded from the matrix.`} Click a row to filter the queue.
        </span>
      </div>
    </div>
  );
}
