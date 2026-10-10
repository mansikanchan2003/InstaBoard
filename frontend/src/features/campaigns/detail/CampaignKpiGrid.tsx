import { cn, formatCompact, formatDelta, formatPercent } from '@/lib/format';
import type { Campaign, CampaignMetrics } from '@/types/domain';
import { pctDelta } from '../campaignUtils';

interface KpiDef {
  key: keyof CampaignMetrics;
  label: string;
  format: (v: number) => string;
  highlight?: boolean;
}

const KPIS: KpiDef[] = [
  { key: 'views', label: 'Views', format: (v) => formatCompact(v) },
  { key: 'reach', label: 'Reach', format: (v) => formatCompact(v) },
  { key: 'engagementRate', label: 'Eng. Rate', format: (v) => formatPercent(v) },
  { key: 'likes', label: 'Likes', format: (v) => formatCompact(v) },
  { key: 'comments', label: 'Comments', format: (v) => formatCompact(v) },
  { key: 'shares', label: 'Shares', format: (v) => formatCompact(v) },
  { key: 'saves', label: 'Saves', format: (v) => formatCompact(v) },
  { key: 'leads', label: 'Leads', format: (v) => formatCompact(v), highlight: true },
];

/** Export: "8-METRIC KPI SUMMARY GRID" with deltas vs the Sep baseline (`campaign.baseline`). */
export function CampaignKpiGrid({ metrics, baseline }: { metrics: CampaignMetrics; baseline: Campaign['baseline'] }) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 min-[1400px]:grid-cols-8 gap-3" aria-label="Campaign KPIs">
      {KPIS.map((k) => {
        const value = metrics[k.key];
        const base = baseline?.[k.key];
        // Engagement rate is already a percentage: show the point change instead of a relative %.
        const delta = k.key === 'engagementRate' ? (base !== undefined ? value - base : undefined) : pctDelta(value, base);
        const deltaText = delta === undefined ? null : k.key === 'engagementRate' ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts` : formatDelta(delta);
        return (
          <div
            key={k.key}
            className={cn(
              'rounded p-3 flex flex-col justify-between transition-colors min-w-0',
              k.highlight ? 'bg-amber-50/20 border-2 border-primary-container' : 'bg-surface-card border border-border-strong hover:border-slate-400',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-1 text-text-secondary">
              <span className={cn('font-label-sm text-label-sm uppercase tracking-wider', k.highlight ? 'text-primary font-bold' : 'text-text-secondary font-semibold')}>{k.label}</span>
              {deltaText && <span className={cn('font-label-sm text-label-sm font-semibold flex items-center tnum shrink-0', delta! >= 0 ? 'text-status-active' : 'text-error')}>{deltaText}</span>}
            </div>
            <div className="my-1">
              <span className="font-metric-stat-lg text-metric-stat-lg font-bold text-text-primary tnum">{k.format(value)}</span>
            </div>
            <div className={cn('font-label-sm text-label-sm truncate', k.highlight ? 'text-primary font-medium' : 'text-text-tertiary')}>
              {base !== undefined ? `vs Sep baseline (${k.format(base)})` : 'No Sep baseline'}
            </div>
          </div>
        );
      })}
    </section>
  );
}
