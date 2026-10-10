import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

/** "Timeline Trajectory": cumulative views for the report scope vs the September baseline (both derived). */
export function TimelineCard({ detail }: { detail: ReportDetail }) {
  const { computed, report } = detail;
  const hasBaseline = computed.baselineGap !== null;
  return (
    <div className="bg-surface-card rounded-xl border border-border-strong p-4 md:p-6 space-y-4 min-w-0" data-print-section="timeline">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-strong pb-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">Timeline Trajectory: {hasBaseline ? 'October vs September Baseline' : 'October Pacing'}</h3>
          <p className="font-body-sm text-xs text-text-secondary">Cumulative daily view pacing ({computed.periodLabel})</p>
        </div>
        <ChartLegend
          items={[
            { label: 'October Cycle (Current)', color: '#F5A623' },
            ...(hasBaseline ? [{ label: report.scope === 'account' ? 'September Baseline' : 'September Baseline (campaigns with Sep data)', color: '#94A3B8', dashed: true }] : []),
          ]}
        />
      </div>
      <TrendChart data={computed.timeline} height={256} showPrevious={hasBaseline} showYAxis currentLabel="October (cumulative)" previousLabel="September (cumulative)" />
      <div className="p-3 bg-surface-canvas rounded-lg border border-border-strong flex flex-wrap items-center justify-between gap-2 font-body-sm text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="insights" className="text-status-active text-[16px]" />
          {computed.peak ? (
            <span>
              <strong>Key inflection:</strong> {computed.peak.date} was the peak day with {formatCompact(computed.peak.views)} views ({computed.peak.share.toFixed(1)}% of the period).
            </span>
          ) : (
            <span>No activity in this period.</span>
          )}
        </span>
        {computed.baselineGap !== null && (
          <span className="font-label-code text-[11px] text-text-tertiary tnum">
            Pacing delta: {computed.baselineGap >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(computed.baselineGap))} views vs baseline
          </span>
        )}
      </div>
    </div>
  );
}

const barColors = ['bg-primary-container', 'bg-tertiary', 'bg-slate-400', 'bg-slate-300'];
const iconColors = ['text-primary-container', 'text-tertiary', 'text-text-tertiary', 'text-text-tertiary'];

/** "Creative Format Efficiency": engagement share per content format, from canonical content metrics. */
export function FormatEfficiencyCard({ detail }: { detail: ReportDetail }) {
  const { formats, efficiencyRatio } = detail.computed;
  const best = [...formats].filter((f) => f.views > 0).sort((a, b) => b.leads / b.views - a.leads / a.views)[0];
  return (
    <div className="bg-surface-card rounded-xl border border-border-strong p-4 md:p-6 flex flex-col justify-between space-y-4" data-print-section="formats">
      <div>
        <div className="flex items-center justify-between border-b border-border-strong pb-3">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">Creative Format Efficiency</h3>
            <p className="font-body-sm text-xs text-text-secondary">Share of engagement by asset format</p>
          </div>
          <Icon name="pie_chart" className="text-text-tertiary text-[18px]" />
        </div>
        <div className="mt-4 space-y-4">
          {formats.length === 0 && <p className="text-body-sm text-text-secondary">No content published in this scope.</p>}
          {formats.map((f, i) => (
            <div key={f.type} className="space-y-1.5">
              <div className="flex justify-between items-center gap-2 text-xs">
                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                  <Icon name={f.icon} className={cn('text-[15px]', iconColors[i] ?? 'text-text-tertiary')} />
                  {f.label} <span className="text-text-tertiary font-normal">({f.count})</span>
                </span>
                <span className="font-label-code font-bold text-text-primary tnum">{f.share.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-surface-canvas rounded-full h-2 overflow-hidden border border-border-strong">
                <div className={cn('h-full rounded-full', barColors[i] ?? 'bg-slate-300')} style={{ width: `${f.share}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-text-secondary font-label-code">
                <span>{formatNumber(f.leads)} Leads</span>
                <span>
                  {formatCompact(f.views)} views • {f.avgEngagementRate.toFixed(2)}% ER
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {efficiencyRatio !== null && best && (
        <div className="p-3.5 rounded-lg bg-surface-canvas border border-border-strong space-y-1">
          <div className="flex items-center gap-1.5 font-label-code text-[11px] text-text-primary font-bold">
            <Icon name="verified" className="text-[16px] text-status-active" />
            Efficiency Ratio: {efficiencyRatio.toFixed(1)}x
          </div>
          <p className="font-body-sm text-xs text-text-secondary leading-snug">{best.label} achieved {efficiencyRatio.toFixed(1)}x the leads-per-view of the next most efficient format.</p>
        </div>
      )}
    </div>
  );
}
