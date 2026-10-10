import { useNavigate, useParams } from 'react-router-dom';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { ErrorState, PageSkeleton, QueryState, Skeleton } from '@/components/ui/States';
import { AccountDetailHeader, AccountDetailTitle } from '@/features/accounts/detail/AccountDetailHeader';
import { CapabilitiesMatrix } from '@/features/accounts/detail/CapabilitiesMatrix';
import { LinkedCampaigns } from '@/features/accounts/detail/LinkedCampaigns';
import { ScopesCard } from '@/features/accounts/detail/ScopesCard';
import { SyncHistoryLog } from '@/features/accounts/detail/SyncHistoryLog';
import { TelemetryTiles } from '@/features/accounts/detail/TelemetryTiles';
import { useAccountActions } from '@/features/accounts/useAccountActions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { NotFoundError } from '@/lib/api/source';
import { accountDetailService } from '@/services/accountDetails';
import { accountService } from '@/services/accounts';
import type { InstagramAccount } from '@/types/domain';

function AccountNotFound({ id }: { id: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-surface-card border border-border-strong rounded-lg">
      <div className="w-14 h-14 rounded-full bg-primary-container/15 flex items-center justify-center mb-4">
        <Icon name="person_off" className="text-[30px] text-primary" />
      </div>
      <h1 className="font-headline-lg text-headline-lg text-text-primary">Instagram account not found</h1>
      <p className="text-body-md text-text-secondary mt-2 max-w-md">
        There is no account with ID <code className="px-1 py-0.5 rounded bg-surface-card-subtle text-text-primary text-[13px]">{id}</code> in this workspace’s sample list. It may
        have been disconnected from the demo list.
      </p>
      <div className="flex gap-2 mt-6 flex-wrap justify-center">
        <LinkButton to="/accounts" variant="primary" icon="arrow_back">
          Back to Accounts Overview
        </LinkButton>
        <LinkButton to="/accounts/connect" icon="add">
          Connect Instagram Account
        </LinkButton>
      </div>
    </div>
  );
}

function StatusCallout({ account, onReconnect }: { account: InstagramAccount; onReconnect: () => void }) {
  if (account.status === 'connected' || account.status === 'syncing') return null;
  const expired = account.status === 'expired';
  return (
    <div className={expired ? 'p-4 rounded-lg border border-error/20 bg-error-container/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3' : 'p-4 rounded-lg border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3'}>
      <div className="flex items-start gap-3">
        <Icon name={expired ? 'link_off' : 'lock_clock'} className={expired ? 'text-error text-[22px]' : 'text-status-paused text-[22px]'} />
        <div>
          <p className="font-semibold text-text-primary text-body-md">{expired ? 'Connection expired — data collection stopped' : 'Token renewal required'}</p>
          <p className="text-body-sm text-text-secondary mt-0.5">
            {account.statusNote}. {expired ? 'Reconnect the account to resume syncing.' : 'Re-authorize before the token expires to avoid gaps in data.'} (Sample status.)
          </p>
        </div>
      </div>
      <Button variant={expired ? 'primary' : 'secondary'} icon={expired ? 'sync_problem' : 'key'} onClick={onReconnect} className="self-start sm:self-auto">
        {expired ? 'Reconnect Account' : 'Renew Token'}
      </Button>
    </div>
  );
}

/** Instagram Account Detail (design-reference: eko_instaboard_account_detail_eko_india_financial_services). */
export default function AccountDetailPage() {
  const { accountId = '' } = useParams();
  const navigate = useNavigate();
  const account = useQuery(`accounts:detail:${accountId}`, () => accountService.get(accountId));
  const telemetry = useQuery(`accounts:telemetry:${accountId}`, () => accountDetailService.telemetry(accountId), { enabled: account.status === 'success' });
  const logs = useQuery(`accounts:sync-logs:${accountId}`, () => accountDetailService.syncLogs(accountId));
  const catalog = useQuery('accounts:scopes', accountDetailService.scopeCatalog);
  const summary = useQuery('accounts:summary', accountDetailService.summary);
  const actions = useAccountActions({ onDisconnected: () => navigate('/accounts') });
  useDocumentTitle(account.data ? `${account.data.displayName} (@${account.data.handle})` : 'Instagram Account');

  return (
    <QueryState
      query={account}
      loading={<PageSkeleton />}
      error={(err, retry) => (err instanceof NotFoundError ? <AccountNotFound id={accountId} /> : <ErrorState error={err} onRetry={retry} />)}
    >
      {(acc) => (
        <div className="flex flex-col gap-6">
          <AccountDetailTitle account={acc} />
          <Notice tone="demo" title="Sample accounts — no Instagram account is connected in this prototype">
            Statuses and metrics are demo data. Sync, token and connection actions explain what would happen once the FastAPI backend and Meta app are connected.
          </Notice>
          <QueryState query={telemetry} loading={<PageSkeleton />}>
            {(t) => (
              <>
                <AccountDetailHeader account={acc} telemetry={t} actions={actions} />
                <StatusCallout account={acc} onReconnect={actions.reconnect} />
                <TelemetryTiles tiles={t.tiles} />
                <CapabilitiesMatrix rows={t.capabilities} version={summary.data?.meta.graphApiVersion ?? 'v19.0'} onRefresh={telemetry.refetch} refreshing={telemetry.isFetching} />
                <ScopesCard telemetry={t} catalog={catalog.data ?? []} handle={acc.handle} />
                <QueryState query={logs} loading={<Skeleton className="h-72" />}>
                  {(rows) => <SyncHistoryLog entries={rows} handle={acc.handle} totalRuns={t.totalSyncRuns} />}
                </QueryState>
              </>
            )}
          </QueryState>
          <LinkedCampaigns accountId={acc.id} handle={acc.handle} />
          {actions.overlays}
        </div>
      )}
    </QueryState>
  );
}
