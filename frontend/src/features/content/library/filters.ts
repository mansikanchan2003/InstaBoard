import type { Campaign, ContentItem, ContentType } from '@/types/domain';

export type LibrarySortKey = 'title' | 'type' | 'campaign' | 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagement' | 'leads' | 'recent';

export interface LibrarySort {
  key: LibrarySortKey;
  direction: 'asc' | 'desc';
}

export interface LibraryFilters {
  search: string;
  campaignId: string;
  type: ContentType | 'all';
}

export const initialFilters: LibraryFilters = { search: '', campaignId: 'all', type: 'all' };
export const initialSort: LibrarySort = { key: 'views', direction: 'desc' };

/** Options of the "Sort:" select in the filter toolbar (always descending). */
export const sortOptions: Array<{ value: LibrarySortKey; label: string }> = [
  { value: 'views', label: 'Sort: Highest Views' },
  { value: 'reach', label: 'Sort: Highest Reach' },
  { value: 'engagement', label: 'Sort: Highest Engagement' },
  { value: 'leads', label: 'Sort: Most Leads' },
  { value: 'recent', label: 'Sort: Recent Date' },
];

export function sortValue(item: ContentItem, key: LibrarySortKey, campaignName: (id: string | null) => string): string | number {
  switch (key) {
    case 'title':
      return item.title.toLowerCase();
    case 'type':
      return item.type;
    case 'campaign':
      return campaignName(item.campaignId).toLowerCase();
    case 'engagement':
      return item.metrics.engagementRate;
    case 'recent':
      return item.publishedAt;
    default:
      return item.metrics[key];
  }
}

/** Search (title / caption / id) + campaign filter. The type tab is applied separately so tab counts stay meaningful. */
export function filterBySearchAndCampaign(items: ContentItem[], filters: LibraryFilters): ContentItem[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((i) => {
    if (filters.campaignId !== 'all' && (filters.campaignId === 'none' ? i.campaignId !== null : i.campaignId !== filters.campaignId)) return false;
    if (!q) return true;
    return i.title.toLowerCase().includes(q) || i.caption.toLowerCase().includes(q) || i.id.includes(q);
  });
}

export function sortItems(items: ContentItem[], sort: LibrarySort, campaigns: Campaign[] | undefined): ContentItem[] {
  const name = (id: string | null) => campaigns?.find((c) => c.id === id)?.name ?? (id ? id : 'Organic');
  const dir = sort.direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = sortValue(a, sort.key, name);
    const vb = sortValue(b, sort.key, name);
    if (va === vb) return 0;
    return va > vb ? dir : -dir;
  });
}
