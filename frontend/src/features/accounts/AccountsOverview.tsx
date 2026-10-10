import { useMemo, useState } from 'react';
import { DemoBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { accountDetailService } from '@/services/accountDetails';
import { accountService } from '@/services/accounts';
import { AccountCard } from './AccountCard';
import { AccountsKpis } from './AccountsKpis';
import { AccountsToolbar, applyAccountFilters, defaultAccountFilters, type AccountFilters } from './AccountsToolbar';
import { ScopesPolicySection } from './ScopesPolicySection';
import { SyncLogsDrawer } from './SyncLogsDrawer';
import { useAccountActions } from './useAccountActions';

export const META_DOCS_URL = 'https://developers.facebook.com/docs/instagram-platform';

/** Honest replacement for the export's "Connected to demonstrative enterprise sandbox environment" banner. */
export function MetaIntegrationBanner({ version = 'v19.0' }: { version?: string }) {
  return (
    <div className="rounded bg-ai-subtle border border-ai-border px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-text-primary shadow-sm">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-1.5 bg-white rounded border border-ai-border text-ai-accent flex-shrink-0">
          <Icon name="webhook" className="text-[20px]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-label-sm font-label-sm tracking-wide text-ai-accent uppercase font-bold">Meta Graph API Integration</span>
            <span className="text-label-code font-label-code px-1.5 py-0.5 rounded bg-white text-text-secondary border border-border-strong uppercase">{version} Endpoints</span>
            <DemoBadge label="Not connected" />
          </div>
          <p className="text-body-sm font-body-sm text-text-secondary mt-0.5">
            Instagram Professional (Business or Creator) accounts are required for Graph API access.{' '}
            <strong className="text-text-primary font-semibold">Sample accounts — no Instagram account is connected in this prototype; statuses and metrics are demo data.</strong>
          </p>
        </div>
      </div>
      <a
        className="text-label-sm font-label-sm text-ai-accent font-semibold hover:underline flex items-center gap-1 flex-shrink-0"
        href={META_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Meta API Docs <Icon name="arrow_outward" className="text-[14px]" />
      </a>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading accounts">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-44" />
      ))}
    </div>
  );
}

/**
 * Full Accounts Overview body. Also rendered blurred & inert underneath the connect flow
 * (`background`), in which case overlays are not mounted.
 */
export function AccountsOverview({ background = false }: { background?: boolean }) {
  const accounts = useQuery('accounts:list', accountService.list);
  const summary = useQuery('accounts:summary', accountDetailService.summary);
  const [filters, setFilters] = useState<AccountFilters>(defaultAccountFilters);
  const [logsOpen, setLogsOpen] = useState(false);
  const actions = useAccountActions();
  const list = accounts.data ?? [];
  const filtered = useMemo(() => applyAccountFilters(list, filters), [list, filters]);
  const grantedScopes = useMemo(() => [...new Set(list.flatMap((a) => a.scopes))], [list]);

  return (
    <div className="space-y-6">
      <MetaIntegrationBanner version={summary.data?.meta.graphApiVersion} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary font-bold tracking-tight">Instagram Accounts</h1>
          <p className="font-body-md text-body-md text-text-secondary mt-0.5">Manage connected accounts and monitor data availability.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="md" icon="history" onClick={() => setLogsOpen(true)}>
            Sync Logs
          </Button>
          <LinkButton to="/accounts/connect" variant="primary" size="md" icon="add">
            Connect Instagram Account
          </LinkButton>
        </div>
      </div>

      <QueryState
        query={accounts}
        loading={
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-14 mt-6" />
            <div className="mt-4">
              <CardsSkeleton />
            </div>
          </>
        }
        empty={
          <EmptyState
            icon="switch_account"
            title="No Instagram accounts in this workspace"
            description="Connect an Instagram Professional account to see data availability. In this prototype the connect flow is a demo walkthrough."
            action={
              <LinkButton to="/accounts/connect" variant="primary" icon="add">
                Connect Instagram Account
              </LinkButton>
            }
          />
        }
      >
        {(rows) => (
          <div className="space-y-6">
            {summary.data && <AccountsKpis accounts={rows} meta={summary.data.meta} />}
            <AccountsToolbar accounts={rows} filters={filters} onChange={setFilters} onSyncAll={() => actions.syncAll(rows)} syncingAll={actions.isSyncingAll} />
            <section className="space-y-4" aria-label="Instagram accounts">
              {filtered.length === 0 ? (
                <EmptyState
                  icon="filter_alt_off"
                  title="No accounts match these filters"
                  description="Try a different search term or clear the filters."
                  action={
                    <Button icon="restart_alt" onClick={() => setFilters(defaultAccountFilters)}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                filtered.map((a) => <AccountCard key={a.id} account={a} actions={actions} />)
              )}
            </section>
          </div>
        )}
      </QueryState>

      {summary.data && <ScopesPolicySection scopes={grantedScopes} rateLimitNotes={summary.data.rateLimitNotes} retention={summary.data.retentionPolicy} />}

      {!background && (
        <>
          <SyncLogsDrawer open={logsOpen} onClose={() => setLogsOpen(false)} accounts={list} />
          {actions.overlays}
        </>
      )}
    </div>
  );
}
