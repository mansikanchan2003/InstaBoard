import {
  accountsSummaryMeta,
  accountTelemetry,
  connectCandidates,
  connectPrerequisites,
  rateLimitNotes,
  retentionPolicy,
  scopeCatalog,
  syncLogs,
} from '@/data/accountDetails';
import { fromSource, NotFoundError } from '@/lib/api/source';

/**
 * Instagram account telemetry, sync audit log and connect-flow reference data.
 * Query keys must start with "accounts" so `invalidateQueries('accounts')` refreshes them.
 * DEMO: nothing here talks to Instagram/Meta.
 */
const byNewest = <T extends { executedAt: string }>(rows: T[]) => [...rows].sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));

export const accountDetailService = {
  summary: () => fromSource(() => ({ meta: accountsSummaryMeta, rateLimitNotes, retentionPolicy }), '/accounts/summary'),

  scopeCatalog: () => fromSource(() => scopeCatalog, '/meta/scopes'),

  telemetry: (accountId: string) =>
    fromSource(() => {
      const found = accountTelemetry.find((t) => t.accountId === accountId);
      if (!found) throw new NotFoundError('Instagram account telemetry', accountId);
      return found;
    }, `/accounts/${accountId}/telemetry`),

  /** Sync audit log; all accounts when `accountId` is omitted (overview "Sync Logs" drawer). */
  syncLogs: (accountId?: string) =>
    fromSource(() => byNewest(accountId ? syncLogs.filter((l) => l.accountId === accountId) : syncLogs), accountId ? `/accounts/${accountId}/sync-logs` : '/accounts/sync-logs'),

  connectReference: () => fromSource(() => ({ prerequisites: connectPrerequisites, candidates: connectCandidates, scopes: scopeCatalog }), '/accounts/connect/reference'),
};
