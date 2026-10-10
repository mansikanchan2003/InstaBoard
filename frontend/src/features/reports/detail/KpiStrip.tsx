import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail, ReportMetricKey } from '@/types/reports';

interface Tile {
  key: string;
  metric: ReportMetricKey;
  label: string;
  icon: string;
  value: ReactNode;
  foot: ReactNode;
  positive?: boolean;
  variant?: 'amber' | 'emerald';
}

function Delta({ value, suffix, unit = '%' }: { value: number; suffix: string; unit?: string }) {
  const up = value >= 0;
  return (
    <>
      <Icon name={up ? 'trending_up' : 'trending_down'} className="text-[13px]" />
      {up ? '+' : '−'}
      {Math.abs(value).toFixed(1)}
      {unit} {suffix}
    </>
  );
}

/** "Campaign Telemetry & KPIs" strip — values from the computed report; tiles follow the report's metric selection. */
export function KpiStrip({ detail, cplBenchmark }: { detail: ReportDetail; cplBenchmark: number }) {
  const { report, computed } = detail;
  const t = computed.totals;
  const d = computed.deltas;
  const mom = d.note && d.views !== undefined ? 'MoM*' : 'MoM';
  const tiles: Tile[] = [
    {
      key: 'views',
      metric: 'views',
      label: 'Views',
      icon: 'visibility',
      value: formatCompact(t.views),
      foot: d.views !== undefined ? <Delta value={d.views} suffix={mom} /> : 'No baseline',
      positive: d.views !== undefined,
    },
    {
      key: 'reach',
      metric: 'reach',
      label: 'Reach',
      icon: 'group',
      value: formatCompact(t.reach),
      foot: d.reach !== undefined ? <Delta value={d.reach} suffix={mom} /> : 'No baseline',
      positive: d.reach !== undefined,
    },
    {
      key: 'er',
      metric: 'engagement',
      label: 'Eng Rate',
      icon: 'touch_app',
      value: `${t.engagementRate.toFixed(2)}%`,
      foot: d.engagement !== undefined ? <Delta value={d.engagement} suffix="pts vs Sep" unit="" /> : 'Reach-weighted',
      positive: d.engagement !== undefined,
    },
    {
      key: 'watch',
      metric: 'watchTime',
      label: 'Watch Time',
      icon: 'schedule',
      value: (
        <>
          {formatNumber(Math.round(t.watchTimeHours))} <span className="text-xs font-normal text-text-secondary">hrs</span>
        </>
      ),
      foot: report.scope === 'account' && !report.contentIds?.length ? 'Account total' : `${t.reelCount} Reels (est.)`,
    },
    {
      key: 'avgwatch',
      metric: 'watchTime',
      label: 'Avg Watch',
      icon: 'timelapse',
      value: t.avgWatchSec !== null ? `${t.avgWatchSec.toFixed(1)}s` : '—',
      foot: report.scope === 'account' && !report.contentIds?.length ? 'Per view, all video' : 'View-weighted, Reels',
    },
    {
      key: 'comments',
      metric: 'comments',
      label: 'Comments',
      icon: 'forum',
      value: formatNumber(t.comments),
      foot: `${formatNumber(t.leads)} became leads`,
    },
    {
      key: 'leads',
      metric: 'leads',
      label: 'Leads',
      icon: 'person_add',
      value: formatNumber(t.leads),
      foot: d.leads !== undefined ? <Delta value={d.leads} suffix={mom} /> : 'No baseline',
      positive: d.leads !== undefined,
      variant: 'amber',
    },
    {
      key: 'cpl',
      metric: 'leads',
      label: 'Cost Per Lead',
      icon: 'savings',
      value: t.cpl !== null ? `₹${Math.round(t.cpl)}` : '—',
      foot: t.cpl !== null ? `${Math.round(((t.cpl - cplBenchmark) / cplBenchmark) * 100)}% vs ₹${cplBenchmark} bench` : 'Not attributed per creative',
      positive: t.cpl !== null,
      variant: 'emerald',
    },
  ];
  const visible = tiles.filter((x) => report.metrics.includes(x.metric));
  if (visible.length === 0) return null;

  return (
    <div data-print-section="kpis">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">Campaign Telemetry &amp; KPIs</h3>
        <span className="font-label-sm text-xs text-text-secondary">
          Derived from canonical demo campaign data{d.note ? ` · *${d.note}` : ''}
        </span>
      </div>
      <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3', visible.length >= 8 && 'lg:grid-cols-8', visible.length < 8 && visible.length > 4 && 'lg:grid-cols-6')}>
        {visible.map((tile) => (
          <div
            key={tile.key}
            className={cn(
              'bg-surface-card rounded-lg border p-3.5 flex flex-col justify-between transition-colors',
              tile.variant === 'amber' ? 'border-primary-container/60 bg-amber-50/20' : tile.variant === 'emerald' ? 'border-emerald-300 bg-emerald-50/20' : 'border-border-strong hover:border-slate-300',
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span
                className={cn(
                  'font-label-code text-[10px] uppercase',
                  tile.variant === 'amber' ? 'text-on-primary-container font-bold' : tile.variant === 'emerald' ? 'text-status-active font-bold' : 'text-text-secondary font-semibold',
                )}
              >
                {tile.label}
              </span>
              <Icon
                name={tile.icon}
                className={cn('text-[15px]', tile.variant === 'amber' ? 'text-brand-primary-hover' : tile.variant === 'emerald' ? 'text-status-active' : 'text-text-tertiary')}
              />
            </div>
            <div className="my-1.5">
              <div className="font-metric-stat-lg text-[20px] xl:text-[23px] font-bold text-text-primary tracking-tight tnum break-all">{tile.value}</div>
            </div>
            <div className={cn('inline-flex items-center gap-1 font-label-code text-[10px]', tile.positive ? 'text-status-active font-bold' : 'text-text-secondary font-medium')}>{tile.foot}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
