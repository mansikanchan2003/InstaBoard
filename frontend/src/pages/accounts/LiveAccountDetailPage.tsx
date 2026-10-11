import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, ImageWithFallback, Notice } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton, QueryState, Skeleton } from '@/components/ui/States';
import { LiveSourceBadge, LiveStateBadge } from '@/features/instagram/LiveConnectionsSection';
import { connectionUiState, daysUntil, formatDateTime, metricLabels } from '@/features/instagram/liveMeta';
import { useInstagramActions } from '@/features/instagram/useInstagramActions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { ApiNotFoundError } from '@/lib/api/errors';
import { formatNumber } from '@/lib/format';
import { instagramService } from '@/services/instagram';
import type { AccountInsights, InstagramConnection, InstagramMedia } from '@/types/instagram';

const MEDIA_COLUMNS = ['views', 'reach', 'likes', 'comments', 'shares', 'saved'] as const;

function Unavailable({ label = 'Unavailable' }: { label?: string }) {
  return (
    <span className="text-text-tertiary" title="Instagram did not return this metric for this item (not a zero)">
      {label}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-4">
      <p className="text-label-sm text-text-secondary">{label}</p>
      <p className="font-metric-stat-lg text-metric-stat-lg font-bold text-text-primary tnum mt-1">{value === null ? <Unavailable label="Not returned" /> : formatNumber(value)}</p>
      {hint && <p className="text-[11px] text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}

function InsightsPanel({ insights, connection }: { insights: AccountInsights; connection: InstagramConnection }) {
  if (!connection.insightsAvailable) {
    return <Notice tone="info" title="Insights permission not granted">Reconnect and allow instagram_business_manage_insights to see reach, views and interactions.</Notice>;
  }
  if (insights.totals.length === 0) {
    return <EmptyState icon="query_stats" title="No insights yet" description="Run a sync to fetch the last 28 days of account insights." />;
  }
  const max = Math.max(1, ...insights.reachDaily.map((p) => p.value ?? 0));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {insights.totals.map((t) => (
          <div key={t.metric} className="p-3 rounded-lg border border-border-strong bg-surface-canvas">
            <p className="text-[12px] text-text-secondary">{metricLabels[t.metric] ?? t.metric}</p>
            <p className="text-headline-sm font-bold text-text-primary tnum">{t.value === null ? <Unavailable /> : formatNumber(t.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-text-tertiary">
        {formatDateTime(insights.totals[0].rangeStart)} – {formatDateTime(insights.totals[0].rangeEnd)} · fetched {formatDateTime(insights.totals[0].capturedAt)}. {insights.note}
      </p>
      {insights.reachDaily.length > 0 && (
        <div>
          <p className="text-label-sm font-semibold text-text-primary mb-2">Daily reach</p>
          <div className="flex items-end gap-1 h-24" role="img" aria-label="Daily reach bar chart">
            {insights.reachDaily.map((p) => (
              <div key={p.date} className="flex-1 bg-primary-container/70 rounded-t min-w-[4px]" style={{ height: `${((p.value ?? 0) / max) * 100}%` }}
                title={`${formatDateTime(p.date)}: ${p.value === null ? 'unavailable' : formatNumber(p.value)}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaTable({ media, connection }: { media: InstagramMedia[]; connection: InstagramConnection }) {
  if (media.length === 0) return <EmptyState icon="photo_library" title="No media synced yet" description="Run a sync to fetch recent posts and reels." />;
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[860px] text-body-sm">
        <thead>
          <tr className="border-b border-border-strong text-text-secondary font-label-code text-label-code uppercase tracking-wider">
            <th className="py-2.5 px-3">Media</th>
            <th className="py-2.5 px-3">Posted</th>
            {MEDIA_COLUMNS.map((c) => (
              <th key={c} className="py-2.5 px-3 text-right">{metricLabels[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {media.map((m) => {
            const metrics = Object.fromEntries(m.insights.map((i) => [i.metric, i]));
            return (
              <tr key={m.id} className={m.removed ? 'opacity-60' : undefined}>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ImageWithFallback src={m.thumbnailUrl ?? (m.mediaType === 'IMAGE' ? m.mediaUrl ?? undefined : undefined)} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="neutral">{m.mediaProductType ?? m.mediaType ?? 'MEDIA'}</Badge>
                        {m.removed && <Badge tone="error">Deleted on Instagram</Badge>}
                      </div>
                      <p className="text-[12px] text-text-secondary truncate max-w-[260px] mt-0.5">{m.caption ?? 'Caption not available via Instagram Login'}</p>
                      {m.permalink && (
                        <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Open on Instagram</a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">{formatDateTime(m.postedAt)}</td>
                {MEDIA_COLUMNS.map((c) => {
                  const fallback = c === 'likes' ? m.likeCount : c === 'comments' ? m.commentsCount : null;
                  const value = metrics[c]?.value ?? (connection.insightsAvailable ? null : fallback);
                  return (
                    <td key={c} className="py-2.5 px-3 text-right tnum">{value === null || value === undefined ? <Unavailable label="—" /> : formatNumber(value)}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-text-tertiary mt-2">“—” means Instagram did not return the metric for that item (e.g. not supported for the media type, too new, or the permission was not granted). It is not counted as zero.</p>
    </div>
  );
}

/** Live account detail (api mode): data fetched from the Instagram API for one connected account. */
export default function LiveAccountDetailPage() {
  const { connectionId = '' } = useParams();
  const navigate = useNavigate();
  const account = useQuery(`instagram:account:${connectionId}`, () => instagramService.account(connectionId));
  const enabled = account.status === 'success';
  const insights = useQuery(`instagram:insights:${connectionId}`, () => instagramService.insights(connectionId), { enabled, isEmpty: () => false });
  const media = useQuery(`instagram:media:${connectionId}`, () => instagramService.media(connectionId), { enabled, isEmpty: () => false });
  const runs = useQuery(`instagram:runs:${connectionId}`, () => instagramService.syncRuns(connectionId), { enabled, isEmpty: () => false });
  const comments = useQuery(`instagram:comments:${connectionId}`, () => instagramService.comments(connectionId), {
    enabled: enabled && !!account.data?.commentsAvailable, isEmpty: () => false,
  });
  const actions = useInstagramActions({ onDisconnected: () => navigate('/accounts') });
  useDocumentTitle(account.data ? `@${account.data.username} (live)` : 'Instagram account');

  return (
    <QueryState
      query={account}
      loading={<PageSkeleton />}
      error={(err, retry) =>
        err instanceof ApiNotFoundError ? (
          <EmptyState icon="person_off" title="Instagram account not found" description="It may have been disconnected, or it belongs to another workspace."
            action={<LinkButton to="/accounts" icon="arrow_back">Back to accounts</LinkButton>} />
        ) : (
          <ErrorState error={err} onRetry={retry} />
        )
      }
    >
      {(c) => {
        const state = connectionUiState(c);
        const expiresIn = daysUntil(c.tokenExpiresAt);
        return (
          <div className="flex flex-col gap-6">
            <Breadcrumbs items={[{ label: 'Instagram Accounts', to: '/accounts' }, { label: `@${c.username}` }]} />
            <div className="bg-surface-card border border-border-strong rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar name={c.username} src={c.profilePictureUrl ?? undefined} size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-headline-lg text-headline-md text-text-primary font-bold">@{c.username}</h1>
                    <LiveSourceBadge />
                    <LiveStateBadge state={state} />
                  </div>
                  <p className="text-body-sm text-text-secondary mt-0.5">
                    {c.name ?? 'Name not returned'} · {c.accountType === 'MEDIA_CREATOR' ? 'Creator' : c.accountType === 'BUSINESS' ? 'Business' : 'Professional'} account · Instagram ID {c.igUserId}
                  </p>
                  <p className="text-[12px] text-text-tertiary mt-0.5">
                    Last successful sync: {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : 'never'}
                    {expiresIn !== null && ` · token expires in ${Math.max(expiresIn, 0)} days (refreshed automatically during syncs when eligible)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {state === 'needs_reauth' ? (
                  <Button variant="primary" icon="key" onClick={() => void actions.connect()} loading={actions.connecting}>Reconnect</Button>
                ) : (
                  <Button variant="primary" icon="sync" onClick={() => void actions.sync.mutate(c.id)} loading={actions.sync.isPending}>Sync now</Button>
                )}
                <Button icon="link_off" onClick={() => actions.requestDisconnect(c)}>Disconnect</Button>
              </div>
            </div>

            {c.lastErrorMessage && (
              <Notice tone="warning" title={state === 'needs_reauth' ? 'Reauthorization needed' : 'Last sync failed'}>{c.lastErrorMessage}</Notice>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label="Followers" value={c.followersCount} hint="As returned by /me" />
              <Stat label="Following" value={c.followsCount} />
              <Stat label="Media" value={c.mediaCount} />
            </div>

            <section className="bg-surface-card border border-border-strong rounded-lg p-5">
              <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary mb-3">Account insights · last 28 days</h2>
              <QueryState query={insights} loading={<Skeleton className="h-32" />}>{(data) => <InsightsPanel insights={data} connection={c} />}</QueryState>
            </section>

            <section className="bg-surface-card border border-border-strong rounded-lg p-5">
              <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary mb-3">Recent media</h2>
              <QueryState query={media} loading={<Skeleton className="h-48" />}>{(rows) => <MediaTable media={rows} connection={c} />}</QueryState>
            </section>

            <section className="bg-surface-card border border-border-strong rounded-lg p-5">
              <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary mb-3">Comments</h2>
              {!c.commentsAvailable ? (
                <p className="text-body-sm text-text-secondary">Comments are not fetched: the instagram_business_manage_comments permission was not requested or not granted.</p>
              ) : (
                <QueryState query={comments} loading={<Skeleton className="h-24" />}>
                  {(rows) => rows.length === 0 ? (
                    <p className="text-body-sm text-text-secondary">No comments synced yet.</p>
                  ) : (
                    <ul className="divide-y divide-border-subtle">
                      {rows.slice(0, 20).map((cm) => (
                        <li key={cm.id} className={`py-2 text-body-sm ${cm.parentIgCommentId ? 'pl-6' : ''}`}>
                          <span className="font-semibold text-text-primary">{cm.username ? `@${cm.username}` : 'Unknown user'}</span>{' '}
                          <span className="text-text-secondary">{cm.text ?? ''}</span>
                          <span className="text-[11px] text-text-tertiary ml-2">{formatDateTime(cm.commentedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </QueryState>
              )}
            </section>

            <section className="bg-surface-card border border-border-strong rounded-lg p-5">
              <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary mb-3">Sync history</h2>
              <QueryState query={runs} loading={<Skeleton className="h-24" />}>
                {(rows) => rows.length === 0 ? (
                  <p className="text-body-sm text-text-secondary">No syncs yet.</p>
                ) : (
                  <ul className="divide-y divide-border-subtle text-body-sm">
                    {rows.map((r) => (
                      <li key={r.id} className="py-2 flex flex-col md:flex-row md:items-center justify-between gap-1">
                        <span className="flex items-center gap-2">
                          <Badge tone={r.status === 'success' ? 'active' : r.status === 'partial' ? 'amber' : r.status === 'running' ? 'scheduled' : 'error'}>{r.status}</Badge>
                          <span className="text-text-primary">{formatDateTime(r.startedAt)}</span>
                          <span className="text-text-tertiary">({r.trigger})</span>
                        </span>
                        <span className="text-[12px] text-text-secondary">
                          {r.errorMessage ?? `${r.mediaFetched} media · ${r.mediaInsightsFetched} media metrics · ${r.accountInsightsFetched} account metrics · ${r.commentsFetched} comments`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryState>
              <p className="text-[11px] text-text-tertiary mt-3 flex items-center gap-1">
                <Icon name="info" className="text-[14px]" /> Manual, bounded syncs only (no background scheduler in this phase).
              </p>
            </section>
            {actions.overlays}
          </div>
        );
      }}
    </QueryState>
  );
}
