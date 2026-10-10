import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { AudiencePageData } from './model';

/** AI Audience Analysis (6 cols) + AI-Estimated Personas (6 cols). */
export function AiAudienceSection({ data }: { data: AudiencePageData }) {
  const { aiAnalysis, personas } = data.intel;
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6 bg-surface-card border border-ai-border/80 rounded-lg p-4 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/60 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-4">
          <div className="flex items-center gap-2">
            <Icon name="auto_awesome" className="text-ai-accent text-[22px]" />
            <h3 className="font-headline-md text-headline-md text-text-primary font-bold">AI Audience Analysis</h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ai-subtle border border-ai-border text-ai-accent uppercase tracking-wider">
            AI-GENERATED INSIGHT
          </span>
        </div>
        <div className="relative flex flex-col gap-3 font-body-sm text-body-sm">
          {aiAnalysis.map((a) => (
            <div
              key={a.title}
              className={cn('p-3 border rounded flex items-start gap-2.5', a.recommendation ? 'bg-indigo-50/50 border-indigo-200/60' : 'bg-surface-canvas border-border-strong')}
            >
              <Icon name={a.icon} className={cn('text-[18px] flex-shrink-0 mt-0.5', a.iconClassName)} />
              <div>
                <strong className={cn('font-semibold block mb-0.5', a.recommendation ? 'text-ai-accent' : 'text-text-primary')}>{a.title}</strong>
                <p className={a.recommendation ? 'text-text-primary font-medium' : 'text-text-secondary'}>{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-6 bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-3">
            <div>
              <h3 className="font-headline-md text-headline-md text-text-primary font-bold">AI-Estimated Personas</h3>
              <span className="font-body-sm text-body-sm text-text-secondary">Behavioral clustering from engagement signals</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-ai-subtle border border-ai-border text-ai-accent tracking-wider font-bold">AI-ESTIMATED</span>
          </div>
          <div className="flex flex-col gap-2 font-body-sm text-body-sm">
            {personas.map((p, i) => (
              <div key={p.name} className="p-2.5 bg-surface-canvas border border-border-strong rounded hover:border-slate-400 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <strong className="font-semibold text-text-primary truncate">{p.name}</strong>
                    {p.score !== undefined && (
                      <span className={cn('text-[10px] px-1.5 rounded font-bold shrink-0', i === 0 ? 'bg-primary-container text-text-primary' : 'bg-amber-100 text-primary')}>Score: {p.score}</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-text-primary tnum shrink-0">{p.sharePct}% share</span>
                </div>
                <div className="text-xs text-text-secondary flex flex-wrap items-center justify-between gap-1">
                  <span>{p.potential}</span>
                  <span className="text-text-primary font-medium">Interest: {p.interest}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-text-secondary italic mt-3 pt-2 border-t border-border-strong">
          [AI-ESTIMATED]: Derived from content interactions, comments intent, and viewing patterns; not direct Instagram API profile attributes.
        </p>
      </div>
    </section>
  );
}
