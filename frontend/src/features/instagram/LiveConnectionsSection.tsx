import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Notice } from '@/components/ui/Misc';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { invalidateQueries, useQuery } from '@/hooks/useQuery';
import { formatNumber } from '@/lib/format';
import { instagramService } from '@/services/instagram';
import type { InstagramConnection, IntegrationStatus } from '@/types/instagram';
import { callbackReasons, connectionUiState, daysUntil, liveStateMeta, type LiveUiState } from './liveMeta';
import { SyncNowButton, SyncSummary } from './SyncWidgets';
import { INSTAGRAM_QUERY_KEYS, useInstagramActions } from './useInstagramActions';
import { useSyncState } from './useSyncState';

export function LiveStateBadge({ state }: { state: LiveUiState }) {
  const meta = liveStateMeta[state];
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={state === 'connecting' ? '[&_.material-symbols-outlined]:animate-spin' : undefined}>
      {meta.label}
    </Badge>
  );
}

export function LiveSourceBadge() {
  return (
    <Badge tone="active" icon="verified">
      Live · Instagram API
    </Badge>
  );
}

/** Handles the redirect back from Instagram (`/accounts?instagram=connected|error&reason=…`) exactly once. */
function useCallbackResult(onConnected: (id: string) => void) {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const handled = useRef(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  useEffect(() => {
    const outcome = params.get('instagram');
    if (!outcome || handled.current) return;
    handled.current = true;
    const account = params.get('account');
    const reason = params.get('reason') ?? 'authorization_failed';
    const next = new URLSearchParams(params);
    ['instagram', 'reason', 'account'].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
    if (outcome === 'connected' && account && /^igc_[a-f0-9]+$/.test(account)) {
      toast({ title: 'Instagram account connected', description: 'The first sync was queued and runs in the background.' });
      onConnected(account);
    } else {
      setError(callbackReasons[reason] ?? callbackReasons.authorization_failed);
    }
  }, [params, setParams, toast, onConnected]);
  return { error, dismiss: () => setError(null) };
}

function DisabledNotice({ status }: { status: IntegrationStatus }) {
  return (
    <Notice tone="warning" title="Live Instagram connection is not configured on this server">
      An administrator must create a Meta app with Instagram Login and set these server variables in <code>backend/.env</code>:{' '}
      <span className="font-mono text-[12px]">{status.missingConfig.join(', ')}</span>. Until then only the sample accounts below are shown.
    </Notice>
  );
}

function LiveAccountRow({ c, actions, canManage }: { c: InstagramConnection; actions: ReturnType<typeof useInstagramActions>; canManage: boolean }) {
  const state = connectionUiState(c);
  const sync = useSyncState(c.id);
  const expiresIn = daysUntil(c.tokenExpiresAt);
  return (
    <li className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={c.username} src={c.profilePictureUrl ?? undefined} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/accounts/live/${c.id}`} className="font-semibold text-text-primary hover:underline">
              @{c.username}
            </Link>
            {c.name && <span className="text-body-sm text-text-secondary truncate">{c.name}</span>}
            <LiveStateBadge state={state} />
          </div>
          <div className="text-[12px] text-text-secondary mt-0.5 flex flex-wrap gap-x-3">
            <span>{c.accountType === 'MEDIA_CREATOR' ? 'Creator' : c.accountType === 'BUSINESS' ? 'Business' : 'Professional'} account</span>
            <span>Followers: {c.followersCount === null ? 'not returned' : formatNumber(c.followersCount)}</span>
            <span>Media: {c.mediaCount === null ? 'not returned' : formatNumber(c.mediaCount)}</span>
            {expiresIn !== null && <span className={expiresIn < 7 ? 'text-error font-medium' : undefined}>Token expires in {Math.max(expiresIn, 0)} days</span>}
          </div>
          <div className="mt-1.5 max-w-xl"><SyncSummary sync={sync} /></div>
          {c.lastErrorMessage && !sync.active && <p className="text-[12px] text-error mt-1">{c.lastErrorMessage}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {state === 'needs_reauth' ? (
          <Button variant="primary" icon="key" onClick={() => void actions.connect()} loading={actions.connecting}>
            Reconnect
          </Button>
        ) : (
          <SyncNowButton sync={sync} disabled={!canManage} />
        )}
        <Link to={`/accounts/live/${c.id}`} className="h-8 px-3 inline-flex items-center rounded border border-border-strong text-label-sm font-semibold text-text-primary hover:bg-surface-canvas">
          View data
        </Link>
        <Button variant="ghost" icon="link_off" onClick={() => actions.requestDisconnect(c)}>
          Disconnect
        </Button>
      </div>
    </li>
  );
}

/**
 * API mode only: the workspace's *live* Instagram connections, kept visually separate from the sample
 * (demo) accounts so live and demo numbers are never mixed.
 */
export function LiveConnectionsSection() {
  const status = useQuery('instagram:status', instagramService.status);
  const accounts = useQuery('instagram:accounts', instagramService.accounts, { enabled: status.data?.enabled === true, isEmpty: () => false });
  const actions = useInstagramActions();
  const firstSync = useRef<string | null>(null);

  // The server queues the first sync when the connection is created; each row then follows its job.
  const onConnected = (id: string) => {
    if (firstSync.current === id) return;
    firstSync.current = id;
    INSTAGRAM_QUERY_KEYS.forEach(invalidateQueries);
  };
  const callback = useCallbackResult(onConnected);

  const canManage = status.data?.canManage ?? false;
  const rows = accounts.data ?? [];

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg shadow-sm" aria-labelledby="live-ig-heading">
      <div className="px-5 py-4 border-b border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="live-ig-heading" className="font-headline-sm text-headline-sm font-bold text-text-primary">Live Instagram connections</h2>
            <LiveSourceBadge />
            {status.data?.apiVersion && <span className="text-label-code font-label-code px-1.5 py-0.5 rounded bg-surface-canvas border border-border-strong text-text-secondary">Graph API {status.data.apiVersion}</span>}
          </div>
          <p className="text-body-sm text-text-secondary mt-0.5">Accounts authorized through Instagram Login. Read-only: InstaBoard never posts, replies or reads direct messages.</p>
        </div>
        {status.data?.enabled && (
          <Button variant="primary" size="md" icon={actions.connecting ? 'progress_activity' : 'add_link'} onClick={() => void actions.connect()} loading={actions.connecting}
            disabled={!canManage} title={canManage ? undefined : 'Only workspace owners and admins can connect accounts'}>
            {actions.connecting ? 'Connecting…' : 'Connect with Instagram'}
          </Button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {callback.error && (
          <div className="flex items-start justify-between gap-3 p-3 rounded border border-error/30 bg-error-container/40" role="alert">
            <div>
              <p className="font-semibold text-text-primary text-body-sm">{callback.error.title}</p>
              <p className="text-body-sm text-text-secondary">{callback.error.detail}</p>
            </div>
            <button type="button" aria-label="Dismiss" onClick={callback.dismiss} className="text-text-secondary hover:text-text-primary">
              <Icon name="close" />
            </button>
          </div>
        )}
        {status.status === 'loading' ? (
          <Skeleton className="h-16" />
        ) : status.error ? (
          <ErrorState title="Could not load the Instagram integration status" error={status.error} onRetry={status.refetch} />
        ) : status.data && !status.data.enabled ? (
          <DisabledNotice status={status.data} />
        ) : accounts.error ? (
          <ErrorState title="Could not load connected Instagram accounts" error={accounts.error} onRetry={accounts.refetch} />
        ) : accounts.status === 'loading' ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-3 text-body-sm text-text-secondary">
            <LiveStateBadge state={actions.connecting ? 'connecting' : 'not_connected'} />
            <span>
              No Instagram account is connected yet.{' '}
              {canManage ? 'Use “Connect with Instagram” to authorize a Business or Creator account.' : 'Ask a workspace owner or admin to connect one.'}
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle border border-border-strong rounded-lg">
            {rows.map((c) => (
              <LiveAccountRow key={c.id} c={c} actions={actions} canManage={canManage} />
            ))}
          </ul>
        )}
      </div>
      {actions.overlays}
    </section>
  );
}
