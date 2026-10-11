import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { formatNumber } from '@/lib/format';
import { instagramService } from '@/services/instagram';
import type { InstagramConnection } from '@/types/instagram';
import { LiveSourceBadge, LiveStateBadge } from './LiveConnectionsSection';
import { connectionUiState, formatDateTime, metricLabels } from './liveMeta';

function LiveTotals({ c }: { c: InstagramConnection }) {
  const insights = useQuery(`instagram:insights:${c.id}`, () => instagramService.insights(c.id), { enabled: c.insightsAvailable, isEmpty: () => false });
  if (!c.insightsAvailable) return <span className="text-[12px] text-text-tertiary">Insights permission not granted</span>;
  if (insights.status === 'loading') return <Skeleton className="h-6 w-40" />;
  if (insights.error) return <span className="text-[12px] text-error">Insights could not be loaded: {insights.error.message}</span>;
  const totals = insights.data?.totals ?? [];
  if (totals.length === 0) return <span className="text-[12px] text-text-tertiary">No insights synced yet</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
      {totals.filter((t) => ['reach', 'views', 'total_interactions'].includes(t.metric)).map((t) => (
        <span key={t.metric}>
          <span className="text-text-secondary">{metricLabels[t.metric]} (28d): </span>
          <span className="font-semibold text-text-primary tnum">{t.value === null ? 'unavailable' : formatNumber(t.value)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Dashboard (api mode): live connected accounts, shown separately from — and never added to — the demo
 * KPIs on the rest of the dashboard.
 */
export function LiveInstagramCard() {
  const status = useQuery('instagram:status', instagramService.status);
  const accounts = useQuery('instagram:accounts', instagramService.accounts, { enabled: status.data?.enabled === true, isEmpty: () => false });
  if (status.status === 'loading' || !status.data) return null;
  const rows = accounts.data ?? [];

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4" aria-label="Live Instagram accounts">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">Live Instagram</h2>
          <LiveSourceBadge />
        </div>
        <Link to="/accounts" className="text-label-sm text-primary font-semibold hover:underline">Manage connections</Link>
      </div>
      {!status.data.enabled ? (
        <p className="text-body-sm text-text-secondary">Live connection is not configured on this server. The figures below are demo data.</p>
      ) : accounts.error ? (
        <p className="text-body-sm text-error">Live accounts could not be loaded: {accounts.error.message}</p>
      ) : accounts.status === 'loading' ? (
        <Skeleton className="h-10" />
      ) : rows.length === 0 ? (
        <p className="text-body-sm text-text-secondary">No Instagram account connected. The dashboard figures below are demo data.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((c) => (
            <li key={c.id} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <Avatar name={c.username} src={c.profilePictureUrl ?? undefined} size="sm" />
                <Link to={`/accounts/live/${c.id}`} className="font-semibold text-text-primary hover:underline">@{c.username}</Link>
                <LiveStateBadge state={connectionUiState(c)} />
                <span className="text-[12px] text-text-secondary">
                  {c.followersCount === null ? 'followers not returned' : `${formatNumber(c.followersCount)} followers`} · synced {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : 'never'}
                </span>
              </span>
              <LiveTotals c={c} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-text-tertiary mt-2">Live figures come from the Instagram API and are not included in the sample KPIs, charts and tables below, which remain demo data.</p>
    </section>
  );
}
