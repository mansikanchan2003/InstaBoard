import { forwardRef, useState } from 'react';
import { Pagination } from '@/components/tables/DataTable';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { QueryState } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import type { ContentItem } from '@/types/domain';
import { AssetsGrid, AssetsTable, metricColumns, type MetricColumn } from './AssetViews';
import type { LibrarySort, LibrarySortKey } from './filters';

const PAGE_SIZES = [6, 12, 24];

function AssetsSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse" role="status" aria-label="Loading content">
      <div className="h-8 bg-slate-200 rounded w-1/4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  );
}

function AssetsEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-canvas border border-border-strong flex items-center justify-center mx-auto text-text-tertiary mb-3">
        <Icon name="movie_off" className="text-[24px]" />
      </div>
      <h3 className="font-headline-sm text-headline-sm font-bold text-text-primary">No Instagram content found</h3>
      <p className="font-body-sm text-body-sm text-text-secondary mt-1 max-w-sm mx-auto">There are no posts or reels matching the selected date range or campaign filter.</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 px-3 py-1.5 rounded bg-surface-card border border-border-strong text-text-primary font-label-md text-label-md font-semibold hover:bg-surface-canvas"
      >
        Reset Filters
      </button>
    </div>
  );
}

function AssetsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-16 px-4 text-center" role="alert">
      <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
        <Icon name="cloud_off" className="text-[24px]" />
      </div>
      <h3 className="font-headline-sm text-headline-sm font-bold text-text-primary">Unable to load Instagram content</h3>
      <p className="font-body-sm text-body-sm text-text-secondary mt-1 max-w-sm mx-auto">The Instagram Graph API token may need re-authentication or data sync timed out.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 px-4 py-2 rounded bg-primary-container text-text-primary font-headline-sm text-label-md font-bold hover:bg-brand-primary-hover"
      >
        Retry Connection
      </button>
    </div>
  );
}

/** "All Content Assets": list/grid toggle, column chooser, sortable columns, pagination, designed states. */
export const ContentAssetsSection = forwardRef<
  HTMLElement,
  {
    query: QueryResult<ContentItem[]>;
    items: ContentItem[];
    sort: LibrarySort;
    onSort: (key: LibrarySortKey) => void;
    onResetFilters: () => void;
    campaignName: (id: string | null) => string;
  }
>(function ContentAssetsSection({ query, items, sort, onSort, onResetFilters, campaignName }, ref) {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [columns, setColumns] = useState<MetricColumn[]>(metricColumns.map((c) => c.key));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const toggleColumn = (key: MetricColumn) => setColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <section ref={ref} className="bg-surface-card border border-border-strong rounded-lg shadow-xs overflow-hidden scroll-mt-20" aria-label="All content assets">
      <div className="p-4 border-b border-border-strong flex flex-wrap items-center justify-between gap-3 bg-surface-card">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">All Content Assets</h2>
          <span className="px-2 py-0.5 rounded-full bg-surface-card-subtle text-text-secondary text-label-sm font-label-sm border border-border-strong tnum">
            {query.status === 'success' ? items.length : 0} Total Items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-canvas p-1 rounded border border-border-strong" role="tablist" aria-label="View mode">
            {(
              [
                { value: 'list', icon: 'view_list', label: 'Table View' },
                { value: 'grid', icon: 'grid_view', label: 'Grid View' },
              ] as const
            ).map((v) => (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={view === v.value}
                aria-label={v.label}
                title={v.label}
                onClick={() => setView(v.value)}
                className={cn('p-1 rounded', view === v.value ? 'bg-surface-card text-text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary')}
              >
                <Icon name={v.icon} className="text-[16px]" />
              </button>
            ))}
          </div>
          <Dropdown
            label="Visible columns"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                disabled={view === 'grid'}
                title={view === 'grid' ? 'Columns apply to the table view' : undefined}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border-strong text-text-secondary hover:text-text-primary text-label-sm font-label-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="view_column" className="text-[16px]" />
                <span>Columns</span>
              </button>
            )}
          >
            {() => (
              <>
                <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Metric columns</p>
                {metricColumns.map((c) => (
                  <MenuItem key={c.key} active={columns.includes(c.key)} onClick={() => toggleColumn(c.key)}>
                    {c.label}
                  </MenuItem>
                ))}
                <div className="border-t border-border-subtle mt-1 pt-1">
                  <MenuItem icon="restart_alt" onClick={() => setColumns(metricColumns.map((c) => c.key))}>
                    Show all columns
                  </MenuItem>
                </div>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <QueryState query={query} loading={<AssetsSkeleton />} empty={<AssetsEmpty onReset={onResetFilters} />} error={(_, retry) => <AssetsError onRetry={retry} />}>
        {() =>
          items.length === 0 ? (
            <AssetsEmpty onReset={onResetFilters} />
          ) : (
            <>
              {view === 'list' ? (
                <AssetsTable items={pageItems} columns={columns} sort={sort} onSort={onSort} campaignName={campaignName} />
              ) : (
                <AssetsGrid items={pageItems} campaignName={campaignName} />
              )}
              <div className="bg-surface-canvas">
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  onPage={setPage}
                  rangeStart={(safePage - 1) * pageSize + 1}
                  rangeEnd={Math.min(safePage * pageSize, items.length)}
                  total={items.length}
                  pageSize={pageSize}
                  onPageSize={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                  pageSizes={PAGE_SIZES}
                />
              </div>
            </>
          )
        }
      </QueryState>
    </section>
  );
});
