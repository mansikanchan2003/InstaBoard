import { TableShell, Th } from '@/components/tables/DataTable';
import { Icon } from '@/components/ui/Icon';
import { useTable } from '@/hooks/useTable';
import { cn, formatNumber, formatPercent } from '@/lib/format';
import type { AudienceSegmentRow, SegmentImpact } from '@/types/audience';
import type { AudiencePageData } from './model';

type SegKey = 'label' | 'reach' | 'engagedUsers' | 'engagementRate' | 'leads' | 'conversionRate';

const sortLabels: Record<SegKey, string> = {
  label: 'Segment',
  reach: 'Reach',
  engagedUsers: 'Engaged Users',
  engagementRate: 'Engagement Rate',
  leads: 'Leads Generated',
  conversionRate: 'Conversion Rate',
};

const impact: Record<SegmentImpact, { label: string; cls: string; dot: string }> = {
  top: { label: '⭐ Top Converting Segment', cls: 'bg-amber-100 text-primary border-amber-300', dot: 'bg-primary-container' },
  high: { label: 'High Potential', cls: 'bg-status-active-subtle text-status-active border-status-active/40', dot: 'bg-blue-500' },
  stable: { label: 'Stable', cls: 'bg-surface-card-subtle text-text-secondary border-border-strong', dot: 'bg-slate-600' },
  moderate: { label: 'Moderate', cls: 'bg-surface-card-subtle text-text-secondary border-border-strong', dot: 'bg-slate-400' },
  low: { label: 'Low', cls: 'bg-surface-card-subtle text-text-tertiary border-border-strong', dot: 'bg-slate-300' },
  not_targeted: { label: 'Not targeted (under 18)', cls: 'bg-surface-card-subtle text-text-tertiary border-border-strong', dot: 'bg-slate-200' },
};

const accessors: Record<SegKey, (r: AudienceSegmentRow) => string | number> = {
  label: (r) => r.label,
  reach: (r) => r.reach,
  engagedUsers: (r) => r.engagedUsers,
  engagementRate: (r) => r.engagementRate,
  leads: (r) => r.leads,
  conversionRate: (r) => r.conversionRate,
};

/** Sortable segment engagement & conversion table. */
export function SegmentTable({ data }: { data: AudiencePageData }) {
  const t = useTable<AudienceSegmentRow, SegKey>(data.intel.segments, { accessors, initialSort: { key: 'conversionRate', direction: 'desc' }, pageSize: 50 });

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-3">
        <div>
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Audience Segment Engagement &amp; Conversion</h3>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Cross-cohort analysis of reach, interaction depth, and downstream lead generation</p>
        </div>
        {t.sort && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary font-medium">Sorted by:</span>
            <span className="text-xs font-bold text-text-primary bg-surface-canvas border border-border-strong px-2 py-1 rounded flex items-center gap-1">
              {sortLabels[t.sort.key]} <Icon name={t.sort.direction === 'desc' ? 'arrow_downward' : 'arrow_upward'} className="text-[14px]" />
            </span>
          </div>
        )}
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th sortKey="label" sort={t.sort} onSort={t.toggleSort}>
              Segment (Cohort)
            </Th>
            <Th sortKey="reach" sort={t.sort} onSort={t.toggleSort} align="right">
              Reach
            </Th>
            <Th sortKey="engagedUsers" sort={t.sort} onSort={t.toggleSort} align="right">
              Engaged Users
            </Th>
            <Th sortKey="engagementRate" sort={t.sort} onSort={t.toggleSort} align="right">
              Engagement Rate
            </Th>
            <Th sortKey="leads" sort={t.sort} onSort={t.toggleSort} align="right">
              Leads Generated
            </Th>
            <Th sortKey="conversionRate" sort={t.sort} onSort={t.toggleSort} align="right">
              Conversion Rate
            </Th>
            <Th align="center">Status / Impact</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-strong font-body-sm text-body-sm">
          {t.rows.map((r) => {
            const top = r.impact === 'top';
            const im = impact[r.impact];
            return (
              <tr key={r.id} className={cn('transition-colors', top ? 'hover:bg-amber-50/30 bg-amber-50/10' : 'hover:bg-surface-canvas')}>
                <td className={cn('py-3 px-4 text-text-primary', top ? 'font-bold' : 'font-medium')}>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className={cn('w-2 h-2 rounded-full', im.dot)} />
                    {r.label}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tnum font-medium text-text-secondary">{formatNumber(r.reach)}</td>
                <td className="py-3 px-4 text-right tnum font-semibold text-text-primary">{formatNumber(r.engagedUsers)}</td>
                <td className={cn('py-3 px-4 text-right tnum', top ? 'font-bold text-primary' : 'font-semibold text-text-primary')}>{formatPercent(r.engagementRate)}</td>
                <td className="py-3 px-4 text-right tnum font-bold text-text-primary">{r.leads}</td>
                <td className={cn('py-3 px-4 text-right tnum font-semibold', r.conversionRate >= 8 ? 'text-status-active' : 'text-text-secondary', top && 'font-bold')}>
                  {formatPercent(r.conversionRate, 1)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap', im.cls)}>{im.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </section>
  );
}
