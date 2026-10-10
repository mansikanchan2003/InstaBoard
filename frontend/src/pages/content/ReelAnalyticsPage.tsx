import { useParams } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { NotFoundError } from '@/lib/api/source';
import { PerformanceAuditCard, ReelFooterNav } from '@/features/content/analytics/AuditAndFooter';
import { CommentStreamCard, LeadAttributionCard } from '@/features/content/analytics/CommentsLeadsCards';
import { AudienceSnapshotCard, DiscoveryCard } from '@/features/content/analytics/DiscoveryAudienceCards';
import { loadAnalyticsPage, type AnalyticsPageData } from '@/features/content/analytics/model';
import { ReelHeader } from '@/features/content/analytics/ReelHeader';
import { AiVerdictBanner, ReelKpiGrid } from '@/features/content/analytics/ReelKpiGrid';
import { ReelPreviewCard } from '@/features/content/analytics/ReelPreviewCard';
import { WatchRetentionSection } from '@/features/content/analytics/WatchRetentionSection';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading content analytics">
      <Skeleton className="h-20" />
      <div className="grid grid-cols-12 gap-5">
        <Skeleton className="col-span-12 lg:col-span-4 h-[520px]" />
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function AnalyticsView({ data }: { data: AnalyticsPageData }) {
  return (
    <div>
      <ReelHeader data={data} />
      <div className="flex justify-end -mt-3 mb-3">
        <DemoBadge label="Demo analytics — not fetched from Instagram" />
      </div>
      <section className="grid grid-cols-12 gap-5 mb-6">
        <ReelPreviewCard data={data} />
        <div className="col-span-12 lg:col-span-8 flex flex-col justify-between gap-3">
          <ReelKpiGrid data={data} />
          <AiVerdictBanner data={data} />
        </div>
      </section>
      <WatchRetentionSection data={data} />
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <DiscoveryCard data={data} />
        <AudienceSnapshotCard data={data} />
      </section>
      <section className="grid grid-cols-12 gap-5 mb-6">
        <CommentStreamCard data={data} />
        <LeadAttributionCard data={data} />
      </section>
      <PerformanceAuditCard data={data} />
      <ReelFooterNav data={data} />
    </div>
  );
}

export default function ReelAnalyticsPage() {
  const { contentId = '' } = useParams();
  const query = useQuery(`content:analytics-page:${contentId}`, () => loadAnalyticsPage(contentId));
  useDocumentTitle(query.data ? `${query.data.item.title} — Analytics` : 'Content Analytics');

  return (
    <QueryState
      query={query}
      loading={<AnalyticsSkeleton />}
      empty={
        <EmptyState
          icon="movie_off"
          title="No analytics for this content yet"
          description="Metrics appear after the first sync of this Instagram media."
          action={<LinkButton to="/content" icon="arrow_back">Back to Content</LinkButton>}
        />
      }
      error={(err, retry) =>
        err instanceof NotFoundError ? (
          <EmptyState
            icon="search_off"
            title="Content not found"
            description={`There is no content item with id "${contentId}" in this workspace.`}
            action={
              <LinkButton to="/content" variant="primary" icon="arrow_back">
                Back to Content Library
              </LinkButton>
            }
          />
        ) : (
          <ErrorState title="Unable to load content analytics" error={err} onRetry={retry} />
        )
      }
    >
      {(data) => <AnalyticsView data={data} />}
    </QueryState>
  );
}
