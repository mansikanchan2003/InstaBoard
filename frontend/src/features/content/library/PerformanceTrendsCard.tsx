import { useState } from 'react';
import { TrendChart } from '@/components/charts/TrendChart';
import { AiBadge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/Controls';
import { QueryState, Skeleton, ErrorState } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { cn, formatCompact, formatDelta, formatNumber } from '@/lib/format';
import type { ContentItem, TrendMetric, TrendPoint } from '@/types/domain';
import { ratio } from '../contentMeta';

type ChartMetric = Extract<TrendMetric, 'views' | 'reach' | 'engagement' | 'leads' | 'watchTime'>;

const metricOptions: Array<{ value: ChartMetric; label: string }> = [
  { value: 'views', label: 'Views' },
  { value: 'reach', label: 'Reach' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
  { value: 'watchTime', label: 'Watch Time' },
];

const formatters: Record<ChartMetric, (v: number) => string> = {
  views: (v) => formatCompact(v),
  reach: (v) => formatCompact(v),
  engagement: (v) => `${v.toFixed(2)}%`,
  leads: (v) => formatNumber(v),
  watchTime: (v) => `${formatNumber(v)} hrs`,
};

/** Footer "velocity" stat: daily average for summable metrics, mean daily rate for engagement. */
function velocity(metric: ChartMetric, series: TrendPoint[]): { label: string; value: string } {
  const total = series.reduce((s, p) => s + p.current, 0);
  const perDay = total / series.length;
  switch (metric) {
    case 'engagement':
      return { label: 'AVG DAILY RATE', value: `${perDay.toFixed(2)}% / day` };
    case 'leads':
      return { label: 'DAILY VELOCITY', value: `${perDay.toFixed(1)} leads/day` };
    case 'watchTime':
      return { label: 'DAILY VELOCITY', value: `${formatNumber(Math.round(perDay))} hrs/day` };
    case 'reach':
      return { label: 'DAILY VELOCITY', value: `${formatNumber(Math.round(perDay))} accounts/day` };
    default:
      return { label: 'DAILY VELOCITY', value: `${formatNumber(Math.round(perDay))} views/day` };
  }
}

export function PerformanceTrendsCard({ trends, content }: { trends: QueryResult<Record<TrendMetric, TrendPoint[]>>; content: ContentItem[] | undefined }) {
  const [metric, setMetric] = useState<ChartMetric>('views');
  const fmt = formatters[metric];
  const totalViews = content?.reduce((s, c) => s + c.metrics.views, 0) ?? 0;
  const reelViews = content?.filter((c) => c.type === 'reel').reduce((s, c) => s + c.metrics.views, 0) ?? 0;

  return (
    <div className="lg:col-span-8 bg-surface-card border border-border-strong rounded-lg p-5 flex flex-col justify-between shadow-xs min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">Content Performance Trends</h3>
            <AiBadge />
          </div>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Daily progression comparing Oct 01 - Oct 31 with September baseline.</p>
        </div>
        <SegmentedControl ariaLabel="Trend metric" options={metricOptions} value={metric} onChange={setMetric} size="xs" />
      </div>
      <QueryState
        query={trends}
        loading={<Skeleton className="h-72 mt-6" />}
        error={(err, retry) => <ErrorState className="mt-6" title="Unable to load trend data" error={err} onRetry={retry} />}
      >
        {(data) => {
          const series = data[metric];
          const peak = series.reduce((best, p) => (p.current > best.current ? p : best), series[0]);
          const current = series.reduce((s, p) => s + p.current, 0);
          const previous = series.reduce((s, p) => s + p.previous, 0);
          const growth = previous > 0 ? (current / previous - 1) * 100 : 0;
          const vel = velocity(metric, series);
          return (
            <>
              <div className="pt-6 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-label-code text-text-tertiary mb-2">
                  <span className="tnum uppercase">
                    Peak: {fmt(peak.current)} ({peak.date})
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-primary-container inline-block" /> Current Cycle
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0 inline-block border-t-2 border-dashed border-slate-400" /> Prev Baseline
                    </span>
                  </div>
                </div>
                <TrendChart data={series} height={240} valueFormatter={fmt} currentLabel="Current cycle (Oct)" previousLabel="Prev baseline (Sep)" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 mt-1 border-t border-border-subtle bg-surface-canvas -mx-5 -mb-5 px-5 py-3 rounded-b-lg">
                <div className="flex flex-col">
                  <span className="text-label-sm font-label-sm text-text-tertiary">{vel.label}</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-text-primary tnum">{vel.value}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-sm font-label-sm text-text-tertiary">VS SEP BASELINE</span>
                  <span className={cn('font-headline-sm text-headline-sm font-bold tnum', growth >= 0 ? 'text-status-active' : 'text-error')}>{formatDelta(growth)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-label-sm font-label-sm text-text-tertiary">REEL SHARE OF CONTENT VIEWS</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-text-primary tnum">
                    {content ? `${ratio(reelViews, totalViews).toFixed(1)}% of total` : '—'}
                  </span>
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
