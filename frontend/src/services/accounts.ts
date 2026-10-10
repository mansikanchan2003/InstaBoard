import { accounts, primaryAccountId } from '@/data/accounts';
import { accountOverview, dailyTrends } from '@/data/overview';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { InstagramAccount } from '@/types/domain';

const store: InstagramAccount[] = structuredClone(accounts);

export const accountService = {
  list: () => fromSource(() => store, '/accounts'),

  get: (id: string) =>
    fromSource(() => {
      const found = store.find((a) => a.id === id);
      if (!found) throw new NotFoundError('Instagram account', id);
      return found;
    }, `/accounts/${id}`),

  primaryId: primaryAccountId,

  overview: () => fromSource(() => accountOverview, `/accounts/${primaryAccountId}/overview`),

  trends: () => fromSource(() => dailyTrends, `/accounts/${primaryAccountId}/trends`),

  /**
   * Prototype "sync": no Instagram/Meta call is made. In demo mode it only refreshes the
   * local "last synced" label so the UI can show feedback.
   */
  requestSync: (id: string) =>
    mutateSource(
      () => {
        const found = store.find((a) => a.id === id);
        if (!found) throw new NotFoundError('Instagram account', id);
        if (found.status === 'connected') found.lastSyncedAt = 'Just now (demo)';
        return found;
      },
      { method: 'post', path: `/accounts/${id}/sync` },
    ),

  /** Removes an account from the local demo list only. */
  disconnect: (id: string) =>
    mutateSource(
      () => {
        const idx = store.findIndex((a) => a.id === id);
        if (idx >= 0) store.splice(idx, 1);
        return { id };
      },
      { method: 'delete', path: `/accounts/${id}` },
    ),
};
