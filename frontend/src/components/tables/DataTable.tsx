import type { ReactNode } from 'react';
import { cn } from '@/lib/format';
import type { SortState } from '@/hooks/useTable';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Controls';

/** DESIGN.md data-table header cell: #F8FAFC, uppercase 11px/600, 0.05em tracking. Sortable when `sortKey` is set. */
export function Th<K extends string>({
  children,
  sortKey,
  sort,
  onSort,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  sortKey?: K;
  sort?: SortState<K>;
  onSort?: (key: K) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const active = sortKey && sort?.key === sortKey;
  const alignCls = align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left';
  return (
    <th
      scope="col"
      aria-sort={active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary whitespace-nowrap bg-surface-canvas border-b border-border-strong', alignCls, className)}
    >
      {sortKey && onSort ? (
        <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-0.5 uppercase hover:text-text-primary', alignCls, active && 'text-text-primary')}>
          {children}
          <Icon name={active ? (sort!.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'} className={cn('text-[14px]', !active && 'text-text-tertiary')} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({ children, align = 'left', className, numeric }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string; numeric?: boolean }) {
  return (
    <td className={cn('py-3 px-4 text-[13px] text-text-primary', align === 'right' && 'text-right', align === 'center' && 'text-center', (numeric || align === 'right') && 'tnum', className)}>
      {children}
    </td>
  );
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto custom-scrollbar', className)}>
      <table className="w-full border-collapse min-w-max">{children}</table>
    </div>
  );
}

/** Interactive row: hover tint, keyboard activation with Enter/Space. */
export function Tr({ children, onClick, className, selected, label }: { children: ReactNode; onClick?: () => void; className?: string; selected?: boolean; label?: string }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onClick()) : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      className={cn(
        'border-b border-border-subtle last:border-b-0 transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-canvas focus-visible:bg-surface-canvas focus-visible:outline-none',
        selected && 'bg-amber-50/40',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Pagination({
  page,
  pageCount,
  onPage,
  rangeStart,
  rangeEnd,
  total,
  noun = 'items',
  pageSize,
  onPageSize,
  pageSizes = [5, 10, 25],
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  noun?: string;
  pageSize?: number;
  onPageSize?: (n: number) => void;
  pageSizes?: number[];
}) {
  // First, last, and a window around the current page; gaps collapse to "…".
  const pages: Array<number | 'gap'> = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border-strong text-label-md text-text-secondary">
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="text-text-primary tnum">{total === 0 ? 0 : `${rangeStart}-${rangeEnd}`}</strong> of <strong className="text-text-primary tnum">{total}</strong> {noun}
        </span>
        {onPageSize && pageSize && (
          <label className="hidden sm:flex items-center gap-2">
            <span>Rows per page:</span>
            <Select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-7 text-[12px] py-0">
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button type="button" className="h-7 px-2 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        {pages.map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-text-tertiary" aria-hidden>
              …
            </span>
          ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPage(p)}
            className={cn('h-7 min-w-[28px] px-2 rounded border text-[12px] font-semibold', p === page ? 'border-primary-container bg-primary-container/15 text-text-primary' : 'border-border-strong bg-surface-card hover:bg-surface-canvas')}
          >
            {p}
          </button>
          ),
        )}
        <button type="button" className="h-7 px-2 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
          Next
        </button>
      </nav>
    </div>
  );
}
