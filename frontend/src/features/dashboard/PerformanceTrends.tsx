import { useState } from 'react';
import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { SegmentedControl } from '@/components/ui/Controls';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { formatCompact, formatPercent } from '@/lib/format';
import { accountService } from '@/services/accounts';
import type { TrendMetric } from '@/types/domain';

type ChartMetric = Extract<TrendMetric, 'views' | 'reach' | 'engagement' | 'leads' | 'shares'>;

const metricOptions: Array<{ value: ChartMetric; label: string }> = [
  { value: 'views', label: 'Views' },
  { value: 'reach', label: 'Reach' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
  { value: 'shares', label: 'Shares' },
];

const formatters: Record<ChartMetric, (v: number) => string> = {
  views: (v) => formatCompact(v),
  reach: (v) => formatCompact(v),
  engagement: (v) => formatPercent(v),
  leads: (v) => formatCompact(v),
  shares: (v) => formatCompact(v),
};

const CURRENT_LABEL = 'Current 30 Days (Oct 1 - Oct 31)';
const PREVIOUS_LABEL = 'Previous Baseline (Sep 1 - Sep 30)';

/** Performance Trends card: current vs baseline series with the Views/Reach/Engagement/Leads/Shares switch. */
export function PerformanceTrends() {
  const [metric, setMetric] = useState<ChartMetric>('views');
  const trends = useQuery('accounts:trends', accountService.trends);
  const label = metricOptions.find((o) => o.value === metric)?.label ?? metric;

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-5" aria-labelledby="dash-trends-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-strong">
        <div>
          <h2 id="dash-trends-title" className="font-headline-sm text-headline-sm text-text-primary">
            Performance Trends
          </h2>
          <p className="text-body-sm text-text-secondary">Aggregated reach and attribution across 30 days of active campaigns</p>
        </div>
        <SegmentedControl options={metricOptions} value={metric} onChange={setMetric} ariaLabel="Trend metric" />
      </div>
      <div className="pt-4">
        <QueryState
          query={trends}
          loading={<Skeleton className="h-64" />}
          empty={<div className="h-64 flex items-center justify-center text-body-sm text-text-secondary">No trend data for this period.</div>}
        >
          {(data) => (
            <div role="img" aria-label={`${label} per day, current period versus previous baseline`}>
              <TrendChart data={data[metric]} height={256} valueFormatter={formatters[metric]} currentLabel={CURRENT_LABEL} previousLabel={PREVIOUS_LABEL} />
            </div>
          )}
        </QueryState>
        <div className="pt-3 mt-2 border-t border-border-subtle">
          <ChartLegend
            items={[
              { label: CURRENT_LABEL, color: '#F5A623' },
              { label: PREVIOUS_LABEL, color: '#94A3B8', dashed: true },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
