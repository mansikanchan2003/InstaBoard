import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination, TableShell, Th, Tr } from '@/components/tables/DataTable';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useTable } from '@/hooks/useTable';
import { cn } from '@/lib/format';
import type { ReportListItem } from '@/types/reports';
import { ReportStatusBadge, ReportTypeBadge } from './ReportBadges';
import { formatPeriod } from './reportMetrics';

type ColumnKey = 'type' | 'period' | 'campaigns' | 'generated';
const columnLabels: Record<ColumnKey, string> = { type: 'Report Type', period: 'Date Range', campaigns: 'Campaigns Included', generated: 'Generated On' };

export interface ReportRowActions {
  onDownload: (r: ReportListItem) => void;
  onDuplicate: (r: ReportListItem) => void;
  onToggleArchive: (r: ReportListItem) => void;
  onEdit: (r: ReportListItem) => void;
}

const canDownload = (r: ReportListItem) => r.status === 'ready' || r.status === 'ready_demo' || r.status === 'archived';

export function ReportsTable({ items, totalCount, actions }: { items: ReportListItem[]; totalCount: number; actions: ReportRowActions }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ type: true, period: true, campaigns: true, generated: true });
  const table = useTable<ReportListItem, 'title' | 'generated'>(items, {
    accessors: { title: (r) => r.title.toLowerCase(), generated: (r) => r.generatedAt },
    initialSort: { key: 'generated', direction: 'desc' },
    pageSize: 6,
  });
  const show = (k: ColumnKey) => visible[k];

  return (
    <section className="bg-surface-card rounded border border-border-strong shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-border-strong flex flex-wrap items-center justify-between gap-2 bg-surface-canvas">
        <div className="flex items-center gap-2">
          <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">Generated Reports</h2>
          <span className="font-label-code text-label-code bg-surface-card px-2 py-0.5 rounded border border-border-strong text-text-secondary font-bold tnum">
            {table.rows.length} of {items.length} shown{items.length !== totalCount && ` · ${totalCount} total`}
          </span>
        </div>
        <div className="flex items-center gap-3 font-body-sm text-body-sm text-text-secondary">
          <span className="hidden sm:inline">Showing: Oct 01 - Oct 31, 2024</span>
          <Dropdown
            label="Customize columns"
            trigger={({ toggle, open }) => (
              <button type="button" onClick={toggle} aria-expanded={open} className="text-text-primary hover:underline font-semibold flex items-center gap-1">
                <Icon name="view_column" className="text-[16px]" /> Customize Columns
              </button>
            )}
          >
            {() =>
              (Object.keys(columnLabels) as ColumnKey[]).map((k) => (
                <MenuItem key={k} active={visible[k]} onClick={() => setVisible((v) => ({ ...v, [k]: !v[k] }))}>
                  {columnLabels[k]}
                </MenuItem>
              ))
            }
          </Dropdown>
        </div>
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th sortKey="title" sort={table.sort} onSort={table.toggleSort}>
              Report Name &amp; ID
            </Th>
            {show('type') && <Th>{columnLabels.type}</Th>}
            {show('period') && <Th>{columnLabels.period}</Th>}
            {show('campaigns') && <Th>{columnLabels.campaigns}</Th>}
            {show('generated') && (
              <Th sortKey="generated" sort={table.sort} onSort={table.toggleSort}>
                {columnLabels.generated}
              </Th>
            )}
            <Th>Status</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody className="font-body-md text-body-md">
          {table.rows.map((r) => {
            const archived = r.status === 'archived';
            return (
              <Tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)} label={`Open ${r.title}`} className="group">
                <td className="py-3 px-4">
                  <div className="flex items-start gap-2.5">
                    <Icon name={r.icon} className={cn('text-[20px] mt-0.5', archived ? 'text-text-tertiary' : r.status === 'failed' ? 'text-error' : 'text-primary')} />
                    <div className="max-w-[260px]">
                      <div className={cn('font-semibold transition-colors whitespace-normal', archived ? 'text-text-secondary group-hover:text-text-primary' : 'text-text-primary group-hover:text-primary')}>
                        {r.title}
                      </div>
                      <div className="font-label-code text-label-code text-text-tertiary mt-0.5 tnum">ID: {r.code}</div>
                    </div>
                  </div>
                </td>
                {show('type') && (
                  <td className="py-3 px-4">
                    <ReportTypeBadge type={r.type} muted={archived} />
                  </td>
                )}
                {show('period') && <td className="py-3 px-4 text-text-secondary font-label-md text-label-md tnum whitespace-nowrap">{formatPeriod(r.period)}</td>}
                {show('campaigns') && (
                  <td className="py-3 px-4">
                    <span className={cn('font-medium whitespace-normal block max-w-[240px]', archived ? 'text-text-secondary' : 'text-text-primary')}>{r.summary.primary}</span>
                    <div
                      className={cn(
                        'font-body-sm text-body-sm tnum',
                        r.summary.tone === 'positive' ? 'text-status-active font-semibold' : r.summary.tone === 'muted' || archived ? 'text-text-tertiary' : 'text-text-secondary',
                      )}
                    >
                      {r.summary.secondary}
                    </div>
                  </td>
                )}
                {show('generated') && <td className="py-3 px-4 text-text-secondary font-body-sm text-body-sm tnum max-w-[150px] whitespace-normal">{r.generatedLabel}</td>}
                <td className="py-3 px-4">
                  <ReportStatusBadge status={r.status} />
                </td>
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/reports/${r.id}`)}
                      className="px-2.5 py-1 text-label-sm font-label-sm font-bold bg-white hover:bg-surface-canvas text-text-primary border border-border-strong rounded transition-colors shadow-xs whitespace-nowrap"
                    >
                      View Report
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.onDownload(r)}
                      className="p-1 text-text-secondary hover:text-text-primary rounded border border-border-strong hover:bg-surface-canvas disabled:opacity-40"
                      title={canDownload(r) ? 'Download CSV (demo data)' : 'Available once the report is generated'}
                      aria-label={`Download CSV for ${r.title}`}
                    >
                      <Icon name="file_download" className="text-[16px]" />
                    </button>
                    <Dropdown
                      label={`More options for ${r.title}`}
                      trigger={({ toggle, open }) => (
                        <button type="button" onClick={toggle} aria-expanded={open} className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-surface-canvas" aria-label="More options">
                          <Icon name="more_vert" className="text-[16px]" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem icon="open_in_new" onClick={() => (close(), navigate(`/reports/${r.id}`))}>
                            Open report
                          </MenuItem>
                          <MenuItem icon="tune" onClick={() => (close(), actions.onEdit(r))}>
                            Edit configuration
                          </MenuItem>
                          <MenuItem icon="content_copy" onClick={() => (close(), actions.onDuplicate(r))}>
                            Duplicate
                          </MenuItem>
                          <MenuItem icon={archived ? 'unarchive' : 'archive'} onClick={() => (close(), actions.onToggleArchive(r))}>
                            {archived ? 'Restore from archive' : 'Archive'}
                          </MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </div>
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
        noun="reports"
      />
    </section>
  );
}

export { canDownload };
