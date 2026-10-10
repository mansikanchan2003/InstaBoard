import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { accountService } from '@/services/accounts';
import type { InstagramAccount } from '@/types/domain';
import { canSync } from './accountMeta';
import { DisconnectAccountModal } from './DisconnectAccountModal';
import { ReviewPermissionsModal } from './ReviewPermissionsModal';

/**
 * Honest account actions shared by the overview cards and the detail header.
 * Nothing here calls Instagram/Meta: sync refreshes the demo label, disconnect edits the local demo list.
 */
export function useAccountActions(options: { onDisconnected?: (account: InstagramAccount) => void } = {}) {
  const toast = useToast();
  const navigate = useNavigate();
  const { setLastSyncedLabel } = useAppUi();
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<InstagramAccount | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<InstagramAccount | null>(null);

  const syncOne = useMutation((id: string) => accountService.requestSync(id), { invalidate: ['accounts'] });
  const syncMany = useMutation((ids: string[]) => Promise.all(ids.map((id) => accountService.requestSync(id))), { invalidate: ['accounts'] });
  const disconnect = useMutation((id: string) => accountService.disconnect(id), { invalidate: ['accounts'] });

  const sync = async (account: InstagramAccount) => {
    if (!canSync(account)) {
      toast({ tone: 'warning', title: `@${account.handle} can't sync`, description: 'The sample token for this account has expired. Reconnect it to resume syncing.' });
      return;
    }
    setPendingSyncId(account.id);
    const result = await syncOne.mutate(account.id);
    setPendingSyncId(null);
    if (!result) return;
    if (account.status === 'connected') setLastSyncedLabel('Synced just now');
    toast({
      tone: 'demo',
      title: `Demo sync for @${account.handle}`,
      description:
        account.status === 'connected'
          ? 'No Instagram API call was made — only the “last synced” label of the sample account was refreshed.'
          : 'No Instagram API call was made. This sample account needs token renewal, so its label was left unchanged.',
    });
  };

  const syncAll = async (accounts: InstagramAccount[]) => {
    const eligible = accounts.filter(canSync);
    if (eligible.length === 0) {
      toast({ tone: 'warning', title: 'No accounts to sync', description: 'None of the sample accounts in this list have an active token.' });
      return;
    }
    const result = await syncMany.mutate(eligible.map((a) => a.id));
    if (!result) return;
    setLastSyncedLabel('Synced just now');
    toast({
      tone: 'demo',
      title: `Demo sync for ${eligible.length} account${eligible.length === 1 ? '' : 's'}`,
      description: 'Prototype only — no Instagram data was fetched. Sample “last synced” labels were refreshed.',
    });
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    const result = await disconnect.mutate(target.id);
    if (!result) return;
    setDisconnectTarget(null);
    toast({
      tone: 'demo',
      title: `@${target.handle} removed from the demo list`,
      description: 'Nothing was revoked on Meta (no connection exists). Reload the page to restore the sample accounts.',
    });
    options.onDisconnected?.(target);
  };

  const reconnect = () => navigate('/accounts/connect');

  const overlays = (
    <>
      <DisconnectAccountModal account={disconnectTarget} pending={disconnect.isPending} onCancel={() => setDisconnectTarget(null)} onConfirm={confirmDisconnect} />
      <ReviewPermissionsModal account={permissionsTarget} onClose={() => setPermissionsTarget(null)} onReconnect={reconnect} />
    </>
  );

  return {
    sync,
    syncAll,
    isSyncing: (id: string) => pendingSyncId === id,
    isSyncingAll: syncMany.isPending,
    requestDisconnect: setDisconnectTarget,
    reviewPermissions: setPermissionsTarget,
    reconnect,
    overlays,
  };
}
