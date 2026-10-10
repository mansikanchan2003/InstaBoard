import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Td, Th, Tr } from '@/components/tables/DataTable';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useTable } from '@/hooks/useTable';
import { cn, formatCompact, formatDateRange, formatNumber, formatPercent } from '@/lib/format';
import type { Campaign, CampaignMetrics } from '@/types/domain';

type RunCampaign = Campaign & { metrics: CampaignMetrics };
type SortKey = 'name' | 'views' | 'reach' | 'engagement' | 'leads' | 'conversion';

const accessors: Record<SortKey, (c: RunCampaign) => string | number> = {
  name: (c) => c.name.toLowerCase(),
  views: (c) => c.metrics.views,
  reach: (c) => c.metrics.reach,
  engagement: (c) => c.metrics.engagementRate,
  leads: (c) => c.metrics.leads,
  conversion: (c) => c.metrics.conversionRate,
};

/** Campaign Performance card: campaigns that have run (have metrics), sortable, rows open Campaign Detail. */
export function CampaignPerformanceTable({ campaigns }: { campaigns: Campaign[] }) {
  const navigate = useNavigate();
  const withMetrics = useMemo(() => campaigns.filter((c): c is RunCampaign => c.metrics !== null), [campaigns]);
  const table = useTable<RunCampaign, SortKey>(withMetrics, { accessors, initialSort: { key: 'views', direction: 'desc' }, pageSize: 50 });

  return (
    <section className="lg:col-span-2 bg-surface-card border border-border-strong rounded-lg p-5 min-w-0" aria-labelledby="dash-campaigns-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 id="dash-campaigns-title" className="font-headline-sm text-headline-sm text-text-primary">
            Campaign Performance
          </h3>
          <p className="text-body-sm text-text-secondary">Click row to open granular attribution analytics</p>
        </div>
        <Link to="/campaigns" className="text-label-md text-text-primary hover:text-primary-container font-semibold flex items-center gap-1 shrink-0">
          <span>View All ({campaigns.length})</span>
          <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      </div>
      {withMetrics.length === 0 ? (
        <p className="text-body-sm text-text-secondary py-8 text-center border border-dashed border-border-strong rounded-lg">No campaigns have reported metrics in this period yet.</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              <Th sortKey="name" sort={table.sort} onSort={table.toggleSort} className="!px-2.5">
                Campaign Name
              </Th>
              <Th className="!px-2.5">Status</Th>
              <Th sortKey="views" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5">
                Views
              </Th>
              <Th sortKey="reach" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5 hidden 2xl:table-cell">
                Reach
              </Th>
              <Th sortKey="engagement" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5">
                Engagement
              </Th>
              <Th sortKey="leads" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5">
                Leads
              </Th>
              <Th sortKey="conversion" sort={table.sort} onSort={table.toggleSort} align="right" className="!px-2.5">
                Conv. Rate
              </Th>
              <Th align="center" className="!px-2.5">
                Action
              </Th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((c) => {
              const open = () => navigate(`/campaigns/${c.id}`);
              return (
                <Tr key={c.id} onClick={open} className="group" label={`Open ${c.name}`}>
                  <Td className="!px-2.5">
                    <div className="font-bold text-text-primary group-hover:text-primary-container transition-colors">{c.name}</div>
                    <span className="text-[11px] text-text-tertiary">
                      {formatDateRange(c.startDate, c.endDate)} • {c.focus}
                    </span>
                  </Td>
                  <Td className="!px-2.5">
                    <CampaignStatusBadge status={c.status} />
                  </Td>
                  <Td align="right" className="!px-2.5 font-semibold">
                    {formatCompact(c.metrics.views)}
                  </Td>
                  <Td align="right" className="!px-2.5 text-text-secondary hidden 2xl:table-cell">
                    {formatCompact(c.metrics.reach)}
                  </Td>
                  <Td align="right" className="!px-2.5">
                    {formatPercent(c.metrics.engagementRate)}
                  </Td>
                  <Td align="right" className="!px-2.5 font-bold">
                    {formatNumber(c.metrics.leads)}
                  </Td>
                  <Td align="right" className={cn('!px-2.5', c.metrics.conversionRate >= 5 ? 'text-status-active font-semibold' : 'text-text-secondary')}>
                    {formatPercent(c.metrics.conversionRate, 1)}
                  </Td>
                  <Td align="center" className="!px-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        open();
                      }}
                      className="px-2 py-1 rounded bg-surface-canvas hover:bg-surface-card border border-border-strong text-[11px] font-semibold text-text-primary"
                      aria-label={`View details for ${c.name}`}
                    >
                      Detail
                    </button>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
