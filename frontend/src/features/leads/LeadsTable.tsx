import { Pagination, TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { LeadStatusBadge } from '@/components/ui/Badge';
import type { SortState } from '@/hooks/useTable';
import { cn } from '@/lib/format';
import { scoreChipClass, type LeadRow } from './leadUtils';

export type LeadSortKey = 'name' | 'score' | 'lastContact';

interface TableModel {
  rows: LeadRow[];
  sort: SortState<LeadSortKey> | undefined;
  toggleSort: (key: LeadSortKey) => void;
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}

/** Leads table (view-leads export). Row click or "Manage" opens the lead drawer. */
export function LeadsTable({ table, onManage, selectedId }: { table: TableModel; onManage: (id: string) => void; selectedId: string | null }) {
  return (
    <>
      <TableShell>
        <thead>
          <tr>
            <Th sortKey="name" sort={table.sort} onSort={table.toggleSort}>
              Applicant Name / Handle
            </Th>
            <Th>Associated Campaign</Th>
            <Th>Content Source</Th>
            <Th sortKey="score" sort={table.sort} onSort={table.toggleSort} align="center">
              Score
            </Th>
            <Th>Pipeline Status</Th>
            <Th sortKey="lastContact" sort={table.sort} onSort={table.toggleSort}>
              Last Contact
            </Th>
            <Th align="center">Action</Th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((l) => (
            <Tr key={l.id} onClick={() => onManage(l.id)} selected={l.id === selectedId} label={`Manage lead ${l.name}`}>
              <Td className="py-3.5">
                <div className="font-bold text-text-primary">{l.name}</div>
                <span className="text-xs text-text-tertiary">
                  @{l.handle} • {l.location}
                </span>
              </Td>
              <Td className="py-3.5 text-xs font-semibold">{l.campaignName}</Td>
              <Td className="py-3.5 text-xs text-text-secondary max-w-[240px] truncate">{l.contentLabel ?? '—'}</Td>
              <Td align="center" className="py-3.5">
                <span className={cn('px-2 py-0.5 rounded text-xs font-bold tnum', scoreChipClass(l.score, l.status))}>{l.score}</span>
              </Td>
              <Td className="py-3.5">
                <LeadStatusBadge status={l.status} />
              </Td>
              <Td className="py-3.5 text-xs text-text-tertiary whitespace-nowrap">{l.lastContact}</Td>
              <Td align="center" className="py-3.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManage(l.id);
                  }}
                  className="px-2.5 py-1 bg-surface-canvas hover:bg-surface-card border border-border-strong rounded text-xs font-semibold"
                  aria-label={`Manage ${l.name}`}
                >
                  Manage
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        noun="leads"
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
      />
    </>
  );
}
