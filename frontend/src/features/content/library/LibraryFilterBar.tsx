import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { Campaign, ContentType } from '@/types/domain';
import { contentTypeMeta, contentTypeOrder } from '../contentMeta';
import { sortOptions, type LibraryFilters, type LibrarySort, type LibrarySortKey } from './filters';

const selectCls =
  'h-9 px-3 pr-8 rounded border border-border-strong bg-surface-card text-text-primary font-label-md text-label-md focus:border-border-focused focus:ring-0 outline-none cursor-pointer appearance-none';

/** Search + campaign + sort selects and the content-type segmented tabs (counts derived from data). */
export function LibraryFilterBar({
  filters,
  onFilters,
  sort,
  onSort,
  campaigns,
  counts,
}: {
  filters: LibraryFilters;
  onFilters: (f: LibraryFilters) => void;
  sort: LibrarySort;
  onSort: (s: LibrarySort) => void;
  campaigns: Campaign[] | undefined;
  /** Count per tab after search + campaign filters; undefined while loading. */
  counts: Record<ContentType | 'all', number> | undefined;
}) {
  const selectSortValue = sort.direction === 'desc' && sortOptions.some((o) => o.value === sort.key) ? sort.key : 'custom';
  const tabs: Array<{ value: ContentType | 'all'; label: string }> = [{ value: 'all', label: 'All' }, ...contentTypeOrder.map((t) => ({ value: t, label: contentTypeMeta[t].plural }))];

  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0 sm:min-w-[320px]">
        <div className="relative flex-1 max-w-md min-w-0 sm:min-w-[240px] w-full sm:w-auto">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            aria-label="Search content"
            value={filters.search}
            onChange={(e) => onFilters({ ...filters, search: e.target.value })}
            className="w-full h-9 pl-9 pr-3 rounded border border-border-strong bg-surface-card text-text-primary placeholder:text-text-tertiary font-body-sm text-body-sm focus:border-border-focused focus:ring-1 focus:ring-border-focused outline-none transition-all"
            placeholder="Search content caption, hashtags, ID..."
          />
        </div>
        <div className="relative">
          <select aria-label="Filter by campaign" className={selectCls} value={filters.campaignId} onChange={(e) => onFilters({ ...filters, campaignId: e.target.value })}>
            <option value="all">All Campaigns</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Organic (no campaign)</option>
          </select>
          <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary text-[16px]" />
        </div>
        <div className="relative">
          <select
            aria-label="Sort content"
            className={selectCls}
            value={selectSortValue}
            onChange={(e) => onSort({ key: e.target.value as LibrarySortKey, direction: 'desc' })}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {selectSortValue === 'custom' && <option value="custom" disabled>Sort: Custom (table column)</option>}
          </select>
          <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary text-[16px]" />
        </div>
      </div>
      <div role="tablist" aria-label="Content type" className="flex items-center gap-1 bg-surface-canvas p-1 rounded-lg border border-border-strong overflow-x-auto no-scrollbar max-w-full">
        {tabs.map((t) => {
          const active = filters.type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilters({ ...filters, type: t.value })}
              className={cn(
                'px-2.5 py-1 text-label-sm font-label-sm rounded whitespace-nowrap',
                active ? 'bg-surface-card text-text-primary font-semibold shadow-xs' : 'text-text-secondary hover:text-text-primary font-medium',
              )}
            >
              {t.label} ({counts ? counts[t.value] : '–'})
            </button>
          );
        })}
      </div>
    </div>
  );
}
