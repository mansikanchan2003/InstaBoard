import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SegmentedControl, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { formatNumber } from '@/lib/format';
import { accountDetailService } from '@/services/accountDetails';
import type { SyncLogEntry, SyncRunStatus } from '@/types/accounts';
import type { InstagramAccount } from '@/types/domain';
import { RawPayloadModal, SyncStatusBadge, triggerIcon } from './SyncStatusBadge';

/** Overview "Sync Logs" drawer: recent pipeline runs across every sample account. */
export function SyncLogsDrawer({ open, onClose, accounts }: { open: boolean; onClose: () => void; accounts: InstagramAccount[] }) {
  const logs = useQuery('accounts:sync-logs:all', () => accountDetailService.syncLogs(), { enabled: open });
  const [accountId, setAccountId] = useState('all');
  const [status, setStatus] = useState<SyncRunStatus | 'all'>('all');
  const [rawEntry, setRawEntry] = useState<SyncLogEntry | null>(null);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="w-full sm:w-[520px]"
      title="Sync Logs"
      subtitle="Recent data-pipeline runs across all sample accounts."
      headerExtra={<DemoBadge className="mt-2" label="Sample audit log" />}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-3 mb-4">
        <Select aria-label="Filter by account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full">
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.handle}
            </option>
          ))}
        </Select>
        <SegmentedControl
          ariaLabel="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'success', label: 'Success' },
            { value: 'partial', label: 'Partial' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </div>
      <QueryState
        query={logs}
        loading={
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        }
        empty={<EmptyState icon="history" title="No sync runs recorded" description="Sync history appears here once accounts are connected." />}
      >
        {(rows) => {
          const filtered = rows.filter((r) => (accountId === 'all' || r.accountId === accountId) && (status === 'all' || r.status === status));
          if (filtered.length === 0) return <EmptyState icon="filter_alt_off" title="No runs match these filters" />;
          return (
            <ol className="space-y-2">
              {filtered.map((r) => {
                const acc = byId.get(r.accountId);
                return (
                  <li key={r.id} className="p-3 rounded-lg border border-border-strong bg-surface-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-label-md font-semibold text-text-primary tnum">{r.executedLabel}</p>
                        <p className="text-body-sm text-text-secondary flex items-center gap-1 mt-0.5">
                          <Icon name={triggerIcon[r.trigger]} className="text-[14px] text-text-tertiary" />
                          {r.triggerLabel}
                          {r.durationSec !== null && <span className="text-text-tertiary tnum">· {r.durationSec}s</span>}
                        </p>
                      </div>
                      <SyncStatusBadge entry={r} />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 text-body-sm">
                      {acc ? (
                        <Link to={`/accounts/${acc.id}`} className="font-medium text-text-primary hover:underline">
                          @{acc.handle}
                        </Link>
                      ) : (
                        <span className="text-text-tertiary">Removed account</span>
                      )}
                      <span className="text-text-secondary tnum">
                        {formatNumber(r.media)} media{r.comments ? `, ${formatNumber(r.comments)} comments` : ''}
                      </span>
                      <button type="button" onClick={() => setRawEntry(r)} className="text-text-secondary hover:text-text-primary text-[12px] font-mono hover:underline">
                        view_json
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          );
        }}
      </QueryState>
      <RawPayloadModal entry={rawEntry} onClose={() => setRawEntry(null)} />
    </Drawer>
  );
}
