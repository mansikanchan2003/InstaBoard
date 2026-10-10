import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { dashboardService } from '@/services/dashboard';
import type { ExecutiveBriefTone } from '@/types/dashboard';

const toneStyles: Record<ExecutiveBriefTone, { box: string; label: string; text: string }> = {
  working: { box: 'bg-surface-canvas border-border-subtle', label: 'text-status-active', text: 'text-text-primary text-xs' },
  declining: { box: 'bg-surface-canvas border-border-subtle', label: 'text-status-paused', text: 'text-text-primary text-xs' },
  opportunity: { box: 'bg-surface-canvas border-border-subtle', label: 'text-tertiary', text: 'text-text-primary text-xs' },
  action: { box: 'bg-amber-50 border-amber-200', label: 'text-on-primary-container', text: 'text-text-primary text-xs font-medium' },
};

/** AI Executive Brief card (what is working / declining / opportunity / recommended action). */
export function ExecutiveBrief() {
  const brief = useQuery('dashboard:brief', dashboardService.executiveBrief);

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-5 flex flex-col justify-between" aria-labelledby="dash-brief-title">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Icon name="auto_awesome" className="text-ai-accent text-[20px]" />
            <h3 id="dash-brief-title" className="font-headline-sm text-headline-sm text-text-primary">
              AI Executive Brief
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-ai-subtle text-ai-accent border border-ai-border" title="Generated from demo data; verify before acting">
            [AI-INFERRED]
          </span>
        </div>
        <QueryState
          query={brief}
          loading={
            <div className="space-y-3.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          }
          empty={<p className="text-body-sm text-text-secondary py-6 text-center">No AI brief has been generated for this period yet.</p>}
        >
          {(data) => (
            <div className="space-y-3.5 text-body-sm">
              {data.items.map((item) => {
                const s = toneStyles[item.tone];
                return (
                  <div key={item.id} className={cn('p-2.5 rounded border', s.box)}>
                    <span className={cn('font-bold text-[11px] uppercase tracking-wide block mb-0.5', s.label)}>{item.label}</span>
                    <p className={s.text}>
                      {item.segments.map((seg, i) => (seg.strong ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
                    </p>
                  </div>
                );
              })}
              <p className="text-[11px] text-text-tertiary">Generated {data.generatedAt} from demo data.</p>
            </div>
          )}
        </QueryState>
      </div>
      <Link
        to="/ai-insights"
        className="mt-4 w-full py-2 bg-surface-canvas hover:bg-slate-100 border border-border-strong rounded text-label-md font-semibold text-text-primary text-center transition-colors block"
      >
        Read Deep AI Report →
      </Link>
    </section>
  );
}
