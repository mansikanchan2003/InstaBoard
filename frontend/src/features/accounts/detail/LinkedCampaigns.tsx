import { Link, useNavigate } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { useQuery } from '@/hooks/useQuery';
import { formatCompact, formatDateRange, formatNumber } from '@/lib/format';
import { campaignService } from '@/services/campaigns';

/** Campaigns that run on this Instagram account (from the shared campaign service). */
export function LinkedCampaigns({ accountId, handle }: { accountId: string; handle: string }) {
  const navigate = useNavigate();
  const { openCreateCampaign } = useAppUi();
  const campaigns = useQuery('campaigns:list', campaignService.list);

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] overflow-hidden" aria-labelledby="linked-campaigns-title">
      <div className="p-5 border-b border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 id="linked-campaigns-title" className="font-headline-sm text-headline-sm text-text-primary font-bold">
            Linked Campaigns
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Campaigns tracked on @{handle}.</p>
        </div>
        <LinkButton to="/campaigns" iconRight="arrow_forward">
          All campaigns
        </LinkButton>
      </div>
      <QueryState
        query={campaigns}
        loading={
          <div className="p-5 space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        }
        empty={<EmptyState className="m-5" icon="campaign" title="No campaigns yet" />}
      >
        {(all) => {
          const rows = all.filter((c) => c.accountId === accountId);
          if (rows.length === 0)
            return (
              <div className="p-5">
                <EmptyState
                  icon="campaign"
                  title="No campaigns linked to this account"
                  description={`Campaigns created for @${handle} will appear here.`}
                  action={
                    <Button variant="primary" icon="add" onClick={openCreateCampaign}>
                      New Campaign
                    </Button>
                  }
                />
              </div>
            );
          return (
            <TableShell>
              <thead>
                <tr>
                  <Th className="px-5">Campaign</Th>
                  <Th className="px-5">Status</Th>
                  <Th className="px-5">Dates</Th>
                  <Th className="px-5" align="right">
                    Views
                  </Th>
                  <Th className="px-5" align="right">
                    Leads
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <Tr key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} label={`Open campaign ${c.name}`}>
                    <Td className="px-5">
                      <Link to={`/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-text-primary hover:underline">
                        {c.name}
                      </Link>
                      <span className="block text-[11px] text-text-tertiary">
                        {c.code} · {c.objective}
                      </span>
                    </Td>
                    <Td className="px-5">
                      <CampaignStatusBadge status={c.status} />
                    </Td>
                    <Td className="px-5 text-text-secondary whitespace-nowrap">{formatDateRange(c.startDate, c.endDate)}</Td>
                    <Td className="px-5" align="right">
                      {c.metrics ? formatCompact(c.metrics.views) : '—'}
                    </Td>
                    <Td className="px-5" align="right">
                      {c.metrics ? formatNumber(c.metrics.leads) : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableShell>
          );
        }}
      </QueryState>
    </section>
  );
}
