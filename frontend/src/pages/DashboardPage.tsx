import { useAppUi } from '@/app/AppUiContext';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { AudienceSnapshot } from '@/features/dashboard/AudienceSnapshot';
import { CampaignPerformanceTable } from '@/features/dashboard/CampaignPerformanceTable';
import { DashboardHeader } from '@/features/dashboard/DashboardHeader';
import { DashboardKpis } from '@/features/dashboard/DashboardKpis';
import { ExecutiveBrief } from '@/features/dashboard/ExecutiveBrief';
import { PerformanceTrends } from '@/features/dashboard/PerformanceTrends';
import { activeCampaigns } from '@/features/dashboard/selectors';
import { TopContent } from '@/features/dashboard/TopContent';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';

/** Dashboard — "Eko India Campaign Overview" (view-dashboard of the campaign-intelligence export). */
export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { openCreateCampaign } = useAppUi();
  const overview = useQuery('accounts:overview', accountService.overview);
  const campaigns = useQuery('campaigns:list', campaignService.list);

  return (
    <div className="space-y-6">
      <DashboardHeader
        activeCount={campaigns.data ? activeCampaigns(campaigns.data).length : undefined}
        followers={overview.data?.followers}
        healthScore={overview.data?.aiHealthScore}
      />
      <QueryState
        query={overview}
        loading={<DashboardSkeleton />}
        error={(err, retry) => (
          <ErrorState
            title="Instagram Graph API Rate Limit Alert"
            error={err}
            onRetry={() => {
              retry();
              campaigns.refetch();
            }}
          />
        )}
        empty={
          <EmptyState
            icon="search_off"
            title="No campaign data for this period"
            description="No Instagram activity was found for the selected account and date range. Start a campaign or check the connected account."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={openCreateCampaign}>
                  + New Campaign
                </Button>
                <LinkButton to="/accounts">Instagram Accounts</LinkButton>
              </div>
            }
          />
        }
      >
        {(data) => (
          <>
            <DashboardKpis overview={data} campaigns={campaigns.data} />
            <PerformanceTrends />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <QueryState query={campaigns} loading={<Skeleton className="lg:col-span-2 h-80" />} empty={<CampaignsEmpty onCreate={openCreateCampaign} />}>
                {(list) => <CampaignPerformanceTable campaigns={list} />}
              </QueryState>
              <ExecutiveBrief />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <TopContent />
              <AudienceSnapshot />
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

/** Mirrors the export's "Skeleton Shimmer" state (KPI row, chart block, table block). */
function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-64" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function CampaignsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      className="lg:col-span-2"
      icon="campaign"
      title="No campaigns yet"
      description="Create your first Instagram campaign to start tracking performance here."
      action={
        <Button variant="primary" onClick={onCreate}>
          + New Campaign
        </Button>
      }
    />
  );
}
