import { Fragment, useEffect, useMemo } from 'react';
import { Th, Tr } from '@/components/tables/DataTable';
import { useTable } from '@/hooks/useTable';
import { cn, formatDate } from '@/lib/format';
import type { ActivityActor, ActivityEntry } from '@/types/activity';
import { ActorCell, categoryLabels, formatIst, KindPill, OutcomePill, rowTint, TargetChip, weekdayLabel } from './activityUi';

type SortKey = 'timestamp' | 'category' | 'title' | 'entity' | 'actor' | 'outcome';

const outcomeRank = { failed: 0, warning: 1, in_progress: 2, resolved: 3, success: 4 } as const;

function pageWindow(page: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  if (page <= 3) [2, 3].forEach((p) => set.add(p));
  if (page >= count - 2) [count - 1, count - 2].forEach((p) => set.add(p));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const pageBtn = 'px-2.5 py-1 text-label-sm font-label-sm rounded border border-border-strong bg-white text-text-primary hover:bg-surface-canvas transition-colors disabled:text-text-tertiary disabled:cursor-not-allowed disabled:hover:bg-white';

export function ActivityTable({
  entries,
  actorLookup,
  onOpen,
  resetKey,
}: {
  entries: ActivityEntry[];
  actorLookup: (id: string) => ActivityActor | undefined;
  onOpen: (entry: ActivityEntry) => void;
  resetKey: string;
}) {
  const table = useTable<ActivityEntry, SortKey>(entries, {
    accessors: {
      timestamp: (e) => e.timestamp,
      category: (e) => categoryLabels[e.category],
      title: (e) => e.title,
      entity: (e) => e.target.label.toLowerCase(),
      actor: (e) => actorLookup(e.actorId)?.name ?? e.actorId,
      outcome: (e) => outcomeRank[e.outcome],
    },
    initialSort: { key: 'timestamp', direction: 'desc' },
    pageSize: 8,
  });
  const { setPage } = table;

  useEffect(() => setPage(1), [resetKey, setPage]);

  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.timestamp.slice(0, 10), (m.get(e.timestamp.slice(0, 10)) ?? 0) + 1));
    return m;
  }, [entries]);

  const grouped = table.sort?.key === 'timestamp';

  return (
    <div className="bg-surface-card border border-border-strong rounded-xl overflow-hidden shadow-xs mb-4">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr>
              <Th sortKey="timestamp" sort={table.sort} onSort={table.toggleSort} className="w-48">
                Timestamp (IST)
              </Th>
              <Th sortKey="category" sort={table.sort} onSort={table.toggleSort} className="w-44">
                Event Category
              </Th>
              <Th sortKey="title" sort={table.sort} onSort={table.toggleSort} className="min-w-[280px]">
                Reconciled Event &amp; Context
              </Th>
              <Th sortKey="entity" sort={table.sort} onSort={table.toggleSort} className="w-48">
                Related Entity
              </Th>
              <Th sortKey="actor" sort={table.sort} onSort={table.toggleSort} className="w-44">
                Actor / Source
              </Th>
              <Th sortKey="outcome" sort={table.sort} onSort={table.toggleSort} align="center" className="w-28">
                Outcome
              </Th>
              <Th align="right" className="w-24">
                Actions
              </Th>
            </tr>
          </thead>
          <tbody className="text-body-sm font-body-sm text-text-primary">
            {table.rows.map((e, i) => {
              const ts = formatIst(e.timestamp);
              const day = e.timestamp.slice(0, 10);
              const showGroup = grouped && (i === 0 || table.rows[i - 1].timestamp.slice(0, 10) !== day);
              return (
                <Fragment key={e.id}>
                  {showGroup && (
                    <tr className="bg-surface-canvas/70 border-b border-border-strong">
                      <td colSpan={7} className="px-4 py-1.5 font-label-code text-label-code text-text-tertiary uppercase tracking-wider">
                        {weekdayLabel(day)} · {formatDate(day)} · <span className="text-text-secondary">{perDay.get(day)} events</span>
                      </td>
                    </tr>
                  )}
                  <Tr onClick={() => onOpen(e)} label={`View audit detail: ${e.title}`} className={cn('group', rowTint[e.outcome])}>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-text-primary font-label-md text-label-md">{ts.date}</div>
                      <div className="font-label-code text-label-code text-text-tertiary">{ts.time}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <KindPill entry={e} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
                        <span>{e.title}</span>
                        {e.titleTag && (
                          <span
                            className={cn(
                              'font-label-code text-label-code px-1 rounded uppercase',
                              e.titleTag.tone === 'ai' ? 'text-ai-accent bg-ai-subtle' : 'bg-status-paused-subtle text-status-paused',
                            )}
                          >
                            {e.titleTag.label}
                          </span>
                        )}
                      </div>
                      <div className="text-text-secondary text-[12px] line-clamp-1">{e.summary}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <TargetChip target={e.target} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ActorCell actor={actorLookup(e.actorId)} />
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <OutcomePill entry={e} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onOpen(e);
                        }}
                        className="text-primary hover:text-brand-primary-hover font-label-sm text-label-sm font-semibold underline-offset-2 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </Tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-surface-canvas border-t border-border-strong flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="text-body-sm font-body-sm text-text-secondary font-medium">
            Showing{' '}
            <span className="font-bold text-text-primary tnum">
              {table.rangeStart} - {table.rangeEnd}
            </span>{' '}
            of <span className="font-bold text-text-primary tnum">{table.total}</span> audit events
          </div>
          <label className="flex items-center gap-1.5 text-body-sm text-text-secondary">
            <span>Rows:</span>
            <select
              value={table.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-7 pl-2 pr-7 py-0 text-[12px] rounded border border-border-strong bg-white focus:ring-0 focus:border-border-focused"
            >
              {[8, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="flex items-center gap-1 flex-wrap justify-center" aria-label="Pagination">
          <button type="button" className={pageBtn} disabled={table.page <= 1} onClick={() => table.setPage(table.page - 1)}>
            Previous
          </button>
          {pageWindow(table.page, table.pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-text-tertiary">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === table.page ? 'page' : undefined}
                onClick={() => table.setPage(p)}
                className={cn(
                  'px-2.5 py-1 text-label-sm font-label-sm rounded transition-colors tnum',
                  p === table.page ? 'bg-primary-container text-text-primary font-bold shadow-xs' : 'border border-border-strong bg-white text-text-primary hover:bg-surface-canvas',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className={cn(pageBtn, 'font-medium')} disabled={table.page >= table.pageCount} onClick={() => table.setPage(table.page + 1)}>
            Next
          </button>
        </nav>
      </div>
    </div>
  );
}
