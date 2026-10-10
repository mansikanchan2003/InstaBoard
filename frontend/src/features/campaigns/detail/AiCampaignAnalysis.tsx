import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { AiAnalysisItem, AiAnalysisKind } from '@/types/campaigns';
import { UnavailableNote } from './SectionCard';

const kinds: Record<AiAnalysisKind, { label: string; icon: string; box: string; head: string; text: string }> = {
  working: { label: 'What is working', icon: 'check_circle', box: 'bg-emerald-50/50 border-emerald-100', head: 'text-emerald-800', text: 'text-text-primary' },
  attention: { label: 'What needs attention', icon: 'warning', box: 'bg-amber-50/50 border-amber-200', head: 'text-amber-800', text: 'text-text-primary' },
  opportunity: { label: 'Lead opportunity', icon: 'lightbulb', box: 'bg-indigo-50/50 border-indigo-100', head: 'text-indigo-900', text: 'text-text-primary' },
  recommendation: { label: 'Recommendation', icon: 'psychology', box: 'bg-surface-canvas border-border-strong', head: 'text-text-primary', text: 'text-text-secondary' },
};

/** Export: "AI CAMPAIGN ANALYSIS (Executive Brief)". */
export function AiCampaignAnalysis({ analysis, hasMetrics }: { analysis: AiAnalysisItem[] | undefined; hasMetrics: boolean }) {
  return (
    <section className="bg-surface-card border-2 border-indigo-200 rounded p-5 relative overflow-hidden shadow-sm isolate">
      <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-50 to-transparent w-40 h-24 -z-10" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong">
        <div className="flex items-center gap-2">
          <Icon name="auto_awesome" filled className="text-ai-accent" />
          <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">AI Campaign Analysis</h2>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-ai-subtle border border-ai-border text-ai-accent font-label-code text-label-code uppercase tracking-wider font-bold">AI-Generated Insight</span>
      </div>
      {analysis && analysis.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {analysis.map((a) => {
            const k = kinds[a.kind];
            return (
              <div key={a.kind} className={cn('p-3 rounded border', k.box)}>
                <div className={cn('flex items-center gap-1.5 font-label-sm text-label-sm font-bold uppercase', k.head)}>
                  <Icon name={k.icon} className={cn('text-[15px]', a.kind === 'recommendation' && 'text-primary')} />
                  {k.label}
                </div>
                <p className={cn('mt-1 font-body-sm text-body-sm', k.text)}>{a.text}</p>
              </div>
            );
          })}
          <Link to="/ai-insights" className="font-label-md text-label-md text-ai-accent font-semibold hover:underline flex items-center gap-1 self-start">
            Explore all AI insights <Icon name="arrow_forward" className="text-[14px]" />
          </Link>
        </div>
      ) : (
        <UnavailableNote icon="auto_awesome">
          {hasMetrics ? 'An AI analysis for this campaign is not available in the demo dataset.' : 'AI analysis will be generated once the campaign starts collecting metrics.'}{' '}
          <Link to="/ai-insights" className="text-ai-accent font-semibold hover:underline">
            View account-level AI insights →
          </Link>
        </UnavailableNote>
      )}
    </section>
  );
}
