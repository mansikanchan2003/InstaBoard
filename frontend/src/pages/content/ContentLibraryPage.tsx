import { useMemo, useRef, useState } from 'react';
import { QueryState } from '@/components/ui/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import type { ContentType } from '@/types/domain';
import { contentTypeOrder } from '@/features/content/contentMeta';
import { ContentAssetsSection } from '@/features/content/library/ContentAssetsSection';
import { filterBySearchAndCampaign, initialFilters, initialSort, sortItems, type LibraryFilters, type LibrarySort, type LibrarySortKey } from '@/features/content/library/filters';
import { LibraryFilterBar } from '@/features/content/library/LibraryFilterBar';
import { LibraryHeader } from '@/features/content/library/LibraryHeader';
import { LibraryKpiSkeleton, LibraryKpiStrip } from '@/features/content/library/LibraryKpiStrip';
import { PerformanceTrendsCard } from '@/features/content/library/PerformanceTrendsCard';
import { TopCreativesCard, type RankMetric } from '@/features/content/library/TopCreativesCard';

export default function ContentLibraryPage() {
  useDocumentTitle('Content Library');
  const contentQ = useQuery('content:list', contentService.list);
  const campaignsQ = useQuery('campaigns:list', campaignService.list);
  const overviewQ = useQuery('accounts:overview', accountService.overview);
  const trendsQ = useQuery('accounts:trends', accountService.trends);

  const [filters, setFilters] = useState<LibraryFilters>(initialFilters);
  const [sort, setSort] = useState<LibrarySort>(initialSort);
  const assetsRef = useRef<HTMLElement>(null);

  const campaigns = campaignsQ.data;
  const campaignName = (id: string | null) => campaigns?.find((c) => c.id === id)?.name ?? (id ?? 'Organic');

  const { visible, counts } = useMemo(() => {
    const base = filterBySearchAndCampaign(contentQ.data ?? [], filters);
    const tally = { all: base.length } as Record<ContentType | 'all', number>;
    contentTypeOrder.forEach((t) => (tally[t] = base.filter((i) => i.type === t).length));
    const typed = filters.type === 'all' ? base : base.filter((i) => i.type === filters.type);
    return { visible: sortItems(typed, sort, campaigns), counts: contentQ.data ? tally : undefined };
  }, [contentQ.data, filters, sort, campaigns]);

  const toggleSort = (key: LibrarySortKey) =>
    setSort((prev) => (prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'title' || key === 'campaign' || key === 'type' ? 'asc' : 'desc' }));

  const viewAllBy = (metric: RankMetric) => {
    setFilters(initialFilters);
    setSort({ key: metric, direction: 'desc' });
    assetsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <LibraryHeader />
        <LibraryFilterBar filters={filters} onFilters={setFilters} sort={sort} onSort={setSort} campaigns={campaigns} counts={counts} />
      </div>

      <QueryState query={overviewQ} loading={<LibraryKpiSkeleton />}>
        {(overview) => <LibraryKpiStrip overview={overview} content={contentQ.data} />}
      </QueryState>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <PerformanceTrendsCard trends={trendsQ} content={contentQ.data} />
        <TopCreativesCard content={contentQ.data} status={contentQ.status} onViewAll={viewAllBy} />
      </section>

      <ContentAssetsSection
        ref={assetsRef}
        query={contentQ}
        items={visible}
        sort={sort}
        onSort={toggleSort}
        onResetFilters={() => {
          setFilters(initialFilters);
          setSort(initialSort);
          contentQ.refetch();
        }}
        campaignName={campaignName}
      />
    </div>
  );
}
