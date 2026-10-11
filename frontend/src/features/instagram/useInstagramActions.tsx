import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/features/settings/settingsUi';
import { useMutation } from '@/hooks/useMutation';
import { ApiError } from '@/lib/api/client';
import { instagramService } from '@/services/instagram';
import type { InstagramConnection, SyncRun } from '@/types/instagram';

/** Every query that shows live Instagram data (accounts, media, insights, dashboard card). */
export const INSTAGRAM_QUERY_KEYS = ['instagram', 'dashboard'];

function describeError(err: Error): { title: string; description: string } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { title: 'Please wait', description: err.message || 'Too many requests — try again shortly.' };
    if (err.status === 403) return { title: 'Permission denied', description: err.message };
    if (err.status === 409) return { title: 'Not possible right now', description: err.message };
    if (err.status === 503) return { title: 'Integration not configured', description: err.message };
  }
  return { title: 'Instagram request failed', description: err.message };
}

export function describeRun(run: SyncRun): { tone: 'success' | 'error'; title: string; description: string } {
  if (run.status === 'failed') {
    const title = run.errorCode === 'rate_limited' ? 'Instagram rate limit reached'
      : run.errorCode?.startsWith('token') || run.errorCode === 'permission_denied' ? 'Reauthorization needed' : 'Sync failed';
    return { tone: 'error', title, description: run.errorMessage ?? 'The sync did not complete.' };
  }
  const counts = `${run.mediaFetched} media, ${run.mediaInsightsFetched} media metrics, ${run.accountInsightsFetched} account metrics, ${run.commentsFetched} comments`;
  return {
    tone: 'success',
    title: run.status === 'partial' ? 'Sync finished with gaps' : 'Sync complete',
    description: run.status === 'partial' ? `${counts}. Some data was unavailable from Instagram.` : `${counts} fetched from Instagram.`,
  };
}

/** Connect (redirects to Instagram), Sync now and Disconnect (with confirmation) for live accounts. */
export function useInstagramActions(opts: { onDisconnected?: () => void } = {}) {
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<InstagramConnection | null>(null);

  const connect = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const { authorizationUrl } = await instagramService.connect();
      const url = new URL(authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'www.instagram.com') throw new Error('Unexpected authorization URL.');
      window.location.assign(url.toString()); // official Instagram authorization window
    } catch (err) {
      setConnecting(false);
      toast({ tone: 'error', ...describeError(err instanceof Error ? err : new Error(String(err))) });
    }
  };

  const sync = useMutation(instagramService.sync, {
    invalidate: INSTAGRAM_QUERY_KEYS,
    onSuccess: (run) => toast(describeRun(run)),
    onError: (err) => toast({ tone: 'error', ...describeError(err) }),
  });

  const disconnect = useMutation(instagramService.disconnect, {
    invalidate: INSTAGRAM_QUERY_KEYS,
    onSuccess: (c) => {
      setDisconnecting(null);
      toast({ title: `@${c.username} disconnected`, description: 'The access token and the data fetched for this account were deleted from InstaBoard.' });
      opts.onDisconnected?.();
    },
    onError: (err) => toast({ tone: 'error', ...describeError(err) }),
  });

  const overlays = (
    <ConfirmModal
      open={!!disconnecting}
      onClose={() => setDisconnecting(null)}
      onConfirm={() => disconnecting && void disconnect.mutate(disconnecting.id)}
      loading={disconnect.isPending}
      title={`Disconnect @${disconnecting?.username ?? ''}?`}
      confirmLabel="Disconnect account"
      icon="link_off"
    >
      <p>InstaBoard will delete the encrypted access token and every media item, insight and comment it fetched for this account, and will stop calling Instagram for it.</p>
      <p>Campaigns, leads and other workspace data are not affected. To also remove Meta&apos;s grant, remove the app under Instagram → Settings → Apps and websites.</p>
    </ConfirmModal>
  );

  return { connect, connecting, sync, requestDisconnect: setDisconnecting, overlays };
}
