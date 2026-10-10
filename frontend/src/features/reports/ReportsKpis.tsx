import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatCompact, formatDelta, formatNumber } from '@/lib/format';
import type { ReportContext, ReportListItem } from '@/types/reports';

function KpiShell({ label, badge, value, footLeft, footRight }: { label: string; badge: ReactNode; value: ReactNode; footLeft: ReactNode; footRight: ReactNode }) {
  return (
    <div className="bg-surface-card p-4 rounded border border-border-strong shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary font-semibold">{label}</span>
        {badge}
      </div>
      <div className="my-2">
        <div className="font-metric-stat-lg text-metric-stat-lg font-bold text-text-primary tnum">{value}</div>
      </div>
      <div className="flex items-center justify-between gap-2 text-body-sm font-body-sm text-text-secondary border-t border-border-subtle pt-2">
        {footLeft}
        <span className="text-text-tertiary whitespace-nowrap">{footRight}</span>
      </div>
    </div>
  );
}

const greenPill = 'inline-flex items-center px-1.5 py-0.5 rounded text-label-code font-label-code bg-status-active-subtle text-status-active font-bold whitespace-nowrap';

/** KPI summary cards. Library counts come from the report store; period metrics from the canonical account overview. */
export function ReportsKpis({ items, ctx }: { items: ReportListItem[]; ctx: ReportContext }) {
  const generated = items.filter((r) => r.status === 'ready' || r.status === 'ready_demo' || r.status === 'archived');
  const scheduled = items.filter((r) => r.schedule !== 'none' && r.status !== 'archived').length;
  const thisWeek = generated.filter((r) => r.generatedAt >= '2024-10-25').length;

  const analyzedIds = new Set(items.flatMap((r) => r.campaignIds));
  const analyzed = ctx.campaigns.filter((c) => analyzedIds.has(c.id) && c.metrics);
  const active = analyzed.filter((c) => c.status === 'active').length;
  const names = analyzed.map((c) => c.name.replace(/ Campaign$/, '').replace(/^SBI CSP Mitra /, 'Mitra ')).join(', ');

  const o = ctx.overview;
  const totalSpend = Object.values(ctx.boostSpendInr).reduce((a, b) => a + b, 0);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiShell
        label="Reports Generated"
        badge={
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-code font-label-code bg-surface-canvas text-text-secondary border border-border-strong whitespace-nowrap">
            {scheduled} Scheduled
          </span>
        }
        value={generated.length}
        footLeft={
          <span className="flex items-center text-status-active font-semibold">
            <Icon name="arrow_upward" className="text-[16px]" /> +{thisWeek} since Oct 25
          </span>
        }
        footRight="Oct 01 - Oct 31"
      />
      <KpiShell
        label="Campaigns Analyzed"
        badge={
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-code font-label-code bg-status-active-subtle text-status-active border border-status-active/20 font-bold whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active mr-1" /> {active} Active
          </span>
        }
        value={
          <>
            {analyzed.length} <span className="font-body-md text-text-tertiary font-normal">/ {ctx.campaigns.length} Total</span>
          </>
        }
        footLeft={<span className="truncate text-text-secondary font-medium" title={names}>{names}</span>}
        footRight="With Oct data"
      />
      <KpiShell
        label="Total Views in Period"
        badge={o.views.delta !== undefined && <span className={greenPill}>{formatDelta(o.views.delta)}</span>}
        value={formatCompact(o.views.value)}
        footLeft={<span className="text-text-secondary">vs Sep baseline ({formatCompact(o.views.baseline)})</span>}
        footRight="Account total"
      />
      <KpiShell
        label="Leads in Selected Period"
        badge={o.leads.delta !== undefined && <span className={greenPill}>{formatDelta(o.leads.delta)} pacing</span>}
        value={
          <>
            {formatNumber(o.leads.value)} <span className="font-body-md text-text-tertiary font-normal">/ {formatNumber(o.leads.target)} target</span>
          </>
        }
        footLeft={
          <span className={o.leads.value >= o.leads.target ? 'text-status-completed font-semibold' : 'text-status-paused font-semibold'}>
            {o.leads.value >= o.leads.target ? 'Target Exceeded' : 'Below Target'}
          </span>
        }
        footRight={`Avg CPL ₹${(totalSpend / o.leads.value).toFixed(1)}`}
      />
    </section>
  );
}
