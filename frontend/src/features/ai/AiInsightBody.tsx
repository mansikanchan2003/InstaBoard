import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import type { Insight, InsightStatus } from '@/types/insights';
import { AiGeneratedBadge, EvidenceTable, QualityPill, qualityMeta } from './AiWidgets';

/** Detail view for an AI-generated insight: claim → evidence (with definitions/periods) → suggestion → provenance. */
export function AiInsightBody({ insight, onStatus, busy }: { insight: Insight; onStatus: (s: InsightStatus) => void; busy: boolean }) {
  const ai = insight.ai!;
  const expired = new Date(ai.expiresAt).getTime() < Date.now();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-5 min-w-0">
        <section className="bg-surface-card border border-border-strong rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <AiGeneratedBadge ai={ai} />
            <QualityPill quality={ai.evidenceQuality} />
            {expired && <span className="text-[11px] text-text-tertiary">Review window ended {new Date(ai.expiresAt).toLocaleDateString()}</span>}
          </div>
          <p className="text-body-md text-text-primary">{ai.summary}</p>
          <div>
            <h3 className="text-label-sm font-bold text-text-secondary uppercase tracking-wide mb-1">Observation</h3>
            <p className="text-body-sm text-text-primary">{insight.observed}</p>
          </div>
          <div>
            <h3 className="text-label-sm font-bold text-text-secondary uppercase tracking-wide mb-1">Why it may matter</h3>
            <p className="text-body-sm text-text-primary">{ai.explanation}</p>
            <p className="text-[11px] text-text-tertiary mt-1">Associations in the data are not proof of cause and effect.</p>
          </div>
        </section>

        <section className="bg-surface-card border border-border-strong rounded-lg p-5">
          <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary mb-1">Evidence</h2>
          <p className="text-[12px] text-text-tertiary mb-3">
            Every number in this insight was checked against these database figures before it was saved ({ai.period.start} → {ai.period.end}).
          </p>
          <EvidenceTable evidence={ai.evidence} />
          <p className="text-[11px] text-text-tertiary mt-2">{qualityMeta[ai.evidenceQuality].help} Evidence quality describes the data, not a probability that the suggestion is right.</p>
        </section>
      </div>

      <aside className="lg:col-span-4 space-y-4">
        <section className="bg-ai-subtle border border-ai-border rounded-lg p-4">
          <h2 className="text-label-sm font-bold text-ai-accent uppercase tracking-wide flex items-center gap-1 mb-2">
            <Icon name="lightbulb" className="text-[16px]" /> Suggested next action
          </h2>
          <p className="text-body-sm text-text-primary">{ai.recommendedAction}</p>
          <p className="text-[11px] text-text-tertiary mt-2">An AI suggestion for a person to review — nothing has been changed in your campaigns or on Instagram.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" icon="bookmark" onClick={() => onStatus('saved')} disabled={busy || insight.status === 'saved'}>Save</Button>
            <Button size="sm" variant="primary" icon="task_alt" onClick={() => onStatus('completed')} disabled={busy || insight.status === 'completed'}>Mark action completed</Button>
            <Button size="sm" variant="ghost" icon="visibility_off" onClick={() => onStatus('dismissed')} disabled={busy || insight.status === 'dismissed'}>Dismiss</Button>
          </div>
          {insight.primaryLink && (
            <Link to={insight.primaryLink.to} className="inline-block mt-3 text-label-sm text-primary font-semibold hover:underline">{insight.primaryLink.label} →</Link>
          )}
        </section>
        <section className="bg-surface-card border border-border-strong rounded-lg p-4 text-[12px] space-y-1">
          <h2 className="text-label-sm font-bold text-text-secondary uppercase tracking-wide mb-1">Provenance</h2>
          <p>Generated {new Date(ai.generatedAt).toLocaleString()} by {ai.provider} · {ai.model}</p>
          <p>Prompt version {ai.promptVersion}</p>
          <p>Data sources: {ai.sources.join(', ')}</p>
          <p>Review by {new Date(ai.expiresAt).toLocaleDateString()}</p>
        </section>
        {ai.sources.includes('demo_dataset') && (
          <Notice tone="demo" title="Based on the demo dataset">The cited figures come from the bundled demonstration records stored in the database, not from live Instagram data.</Notice>
        )}
      </aside>
    </div>
  );
}
