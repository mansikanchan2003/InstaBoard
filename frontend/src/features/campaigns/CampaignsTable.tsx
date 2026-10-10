import { Link } from 'react-router-dom';
import { CampaignStatusBadge, HealthBadge } from '@/components/ui/Badge';
import { Checkbox, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Pagination, TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import type { useTable } from '@/hooks/useTable';
import { cn, formatCompact, formatDateRange, formatPercent } from '@/lib/format';
import type { Campaign, CampaignHealth } from '@/types/domain';
import { codeNumber, creativesLabel, metric } from './campaignUtils';
import { RowActionsMenu } from './RowActionsMenu';

export type CampaignSortKey = 'name' | 'objective' | 'status' | 'startDate' | 'views' | 'reach' | 'engagementRate' | 'leads' | 'conversionRate' | 'health' | 'created';

const healthRank: Record<CampaignHealth, number> = { excellent: 3, good: 2, needs_attention: 1 };

export const campaignSortAccessors: Record<CampaignSortKey, (c: Campaign) => string | number | null> = {
  name: (c) => c.name.toLowerCase(),
  objective: (c) => c.objective,
  status: (c) => c.status,
  startDate: (c) => c.startDate,
  views: (c) => metric(c, 'views'),
  reach: (c) => metric(c, 'reach'),
  engagementRate: (c) => metric(c, 'engagementRate'),
  leads: (c) => metric(c, 'leads'),
  conversionRate: (c) => metric(c, 'conversionRate'),
  health: (c) => (c.health ? healthRank[c.health] : null),
  created: codeNumber,
};

type CampaignTable = ReturnType<typeof useTable<Campaign, CampaignSortKey>>;

const engClass = (v: number) => (v >= 4.5 ? 'text-status-active' : v < 4 ? 'text-status-paused' : 'text-text-primary');

export function CampaignsTable({
  table,
  selected,
  onSelect,
  onOpen,
  onEdit,
  onToggleStatus,
  onDuplicate,
}: {
  table: CampaignTable;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  onOpen: (c: Campaign) => void;
  onEdit: (c: Campaign) => void;
  onToggleStatus: (c: Campaign) => void;
  onDuplicate: (c: Campaign) => void;
}) {
  const { rows, allRows, sort, toggleSort } = table;
  const allIds = allRows.map((c) => c.id);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const sortProps = { sort, onSort: toggleSort };

  return (
    <div className="bg-surface-card rounded-lg border border-border-strong overflow-hidden shadow-sm">
      <TableShell>
        <thead>
          <tr>
            <Th className="w-10 text-center">
              <Checkbox
                label="Select all campaigns"
                checked={selectedCount > 0 && selectedCount === allIds.length}
                indeterminate={selectedCount > 0 && selectedCount < allIds.length}
                onChange={(on) => onSelect(allIds, on)}
                className="border-border-strong"
              />
            </Th>
            <Th sortKey="name" {...sortProps}>
              Campaign Name
            </Th>
            <Th sortKey="objective" {...sortProps} className="px-3">
              Objective
            </Th>
            <Th sortKey="status" {...sortProps} className="px-3">
              Status
            </Th>
            <Th sortKey="startDate" {...sortProps} className="px-3">
              Duration
            </Th>
            <Th sortKey="views" {...sortProps} align="right" className="px-3">
              Views
            </Th>
            <Th sortKey="reach" {...sortProps} align="right" className="px-3">
              Reach
            </Th>
            <Th sortKey="engagementRate" {...sortProps} align="right" className="px-3">
              Eng. Rate
            </Th>
            <Th sortKey="leads" {...sortProps} align="right" className="px-3">
              Leads
            </Th>
            <Th sortKey="conversionRate" {...sortProps} align="right" className="px-3">
              Conv. Rate
            </Th>
            <Th sortKey="health" {...sortProps} align="center">
              Performance
            </Th>
            <Th className="w-8 px-2">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const m = c.metrics;
            const isSelected = selected.has(c.id);
            return (
              <Tr key={c.id} onClick={() => onOpen(c)} selected={isSelected} className="group" label={`${c.name} — open quick view`}>
                <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox label={`Select ${c.name}`} checked={isSelected} onChange={(on) => onSelect([c.id], on)} className="border-border-strong" />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-border-strong shrink-0 bg-surface-canvas flex items-center justify-center text-text-tertiary">
                      {c.thumbnailUrl ? (
                        <>
                          <ImageWithFallback src={c.thumbnailUrl} alt="" className="h-full w-full" />
                          <div className="absolute bottom-0 right-0 p-0.5 bg-black/60 text-white rounded-tl">
                            <Icon name={c.thumbnailType === 'video' ? 'smart_display' : 'photo_camera'} className="text-[10px] block" />
                          </div>
                        </>
                      ) : (
                        <Icon name={c.status === 'draft' ? 'draft' : c.status === 'scheduled' ? 'schedule' : 'campaign'} className="text-[20px]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/campaigns/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-headline-sm text-[13px] font-bold text-text-primary group-hover:text-primary hover:underline transition-colors flex items-center gap-1.5"
                      >
                        <span>{c.name}</span>
                        <Icon name="open_in_new" className="text-text-tertiary text-[14px]" />
                      </Link>
                      <div className="font-body-sm text-text-secondary text-[11px] flex items-center gap-2">
                        <span>ID: {c.code}</span>
                        <span className="text-text-tertiary">•</span>
                        <span className={cn(c.creativesCount >= 10 && 'text-primary font-medium')}>{creativesLabel(c)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-card-subtle border border-border-strong text-text-secondary whitespace-nowrap">{c.objective}</span>
                </td>
                <td className="py-3 px-3">
                  <CampaignStatusBadge status={c.status} />
                </td>
                <td className={cn('py-3 px-3 font-body-sm text-[12px] whitespace-nowrap', c.startDate ? 'text-text-secondary' : 'text-text-tertiary')}>
                  {formatDateRange(c.startDate, c.endDate)}
                </td>
                {m ? (
                  <>
                    <Td align="right" className="px-3 font-medium">
                      {formatCompact(m.views)}
                    </Td>
                    <Td align="right" className="px-3 font-medium">
                      {formatCompact(m.reach)}
                    </Td>
                    <Td align="right" className={cn('px-3 font-semibold', engClass(m.engagementRate))}>
                      {formatPercent(m.engagementRate)}
                    </Td>
                    <Td align="right" className="px-3 font-bold">
                      {m.leads}
                    </Td>
                    <Td align="right" className="px-3 font-semibold">
                      {formatPercent(m.conversionRate, 1)}
                    </Td>
                  </>
                ) : (
                  Array.from({ length: 5 }, (_, i) => (
                    <Td key={i} align="right" className="px-3 text-text-tertiary">
                      —
                    </Td>
                  ))
                )}
                <td className="py-3 px-4 text-center">
                  <HealthBadge value={c.health} fallback={c.status === 'draft' ? 'Draft' : c.status === 'scheduled' ? 'Scheduled' : 'Not rated'} />
                </td>
                <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <RowActionsMenu label={`Actions for ${c.name}`}>
                    {(close) => (
                      <>
                        <MenuItem icon="visibility" onClick={() => (close(), onOpen(c))}>
                          Quick view
                        </MenuItem>
                        <Link
                          to={`/campaigns/${c.id}`}
                          role="menuitem"
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-label-md text-left text-text-primary hover:bg-surface-canvas"
                        >
                          <Icon name="open_in_new" className="text-[16px] text-text-secondary" />
                          View details
                        </Link>
                        <MenuItem icon="edit" onClick={() => (close(), onEdit(c))}>
                          Edit campaign
                        </MenuItem>
                        {(c.status === 'active' || c.status === 'paused') && (
                          <MenuItem icon={c.status === 'active' ? 'pause' : 'play_arrow'} onClick={() => (close(), onToggleStatus(c))}>
                            {c.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                          </MenuItem>
                        )}
                        <MenuItem icon="content_copy" onClick={() => (close(), onDuplicate(c))}>
                          Duplicate as draft
                        </MenuItem>
                      </>
                    )}
                  </RowActionsMenu>
                </td>
              </Tr>
            );
          })}
        </tbody>
      </TableShell>
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        noun="campaigns"
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
        pageSizes={[10, 25, 50]}
      />
    </div>
  );
}

export function CampaignsTableSkeleton() {
  return (
    <div className="bg-surface-card rounded-lg border border-border-strong p-4 space-y-4 shadow-sm" role="status" aria-label="Loading campaigns">
      <div className="flex items-center justify-between pb-3 border-b border-border-strong">
        <div className="h-4 w-40 bg-border-strong/70 animate-pulse rounded" />
        <div className="h-4 w-28 bg-border-strong/70 animate-pulse rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 w-full bg-border-strong/70 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
