import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { Pagination, TableShell, Td, Th } from '@/components/tables/DataTable';
import { useTable } from '@/hooks/useTable';
import { formatNumber } from '@/lib/format';
import type { SyncLogEntry, SyncRunStatus } from '@/types/accounts';
import { RawPayloadModal, SyncStatusBadge, triggerIcon } from '../SyncStatusBadge';

function downloadCsv(handle: string, rows: SyncLogEntry[]) {
  const header = ['executed_at', 'trigger', 'duration_sec', 'media', 'comments', 'status', 'note'];
  const esc = (v: string | number | undefined | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    `# DEMO DATA - sample sync audit log for @${handle}; not retrieved from Instagram`,
    header.join(','),
    ...rows.map((r) => [r.executedAt, r.triggerLabel, r.durationSec, r.media, r.comments ?? 0, r.status, r.statusLabel].map(esc).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `instaboard-sync-audit-${handle}-demo.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** "Synchronization History Log" audit table with status filter, pagination, CSV export and raw payload viewer. */
export function SyncHistoryLog({ entries, handle, totalRuns }: { entries: SyncLogEntry[]; handle: string; totalRuns: number }) {
  const toast = useToast();
  const [status, setStatus] = useState<SyncRunStatus | 'all'>('all');
  const [rawEntry, setRawEntry] = useState<SyncLogEntry | null>(null);
  const filtered = useMemo(() => (status === 'all' ? entries : entries.filter((e) => e.status === status)), [entries, status]);
  const table = useTable<SyncLogEntry, 'executedAt' | 'durationSec' | 'media'>(filtered, {
    accessors: { executedAt: (r) => r.executedAt, durationSec: (r) => r.durationSec, media: (r) => r.media },
    initialSort: { key: 'executedAt', direction: 'desc' },
    pageSize: 4,
  });
  const failedCount = entries.filter((e) => e.status !== 'success').length;
  const count = (s: SyncRunStatus) => entries.filter((e) => e.status === s).length;

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] overflow-hidden" aria-labelledby="sync-history-title">
      <div className="p-5 border-b border-border-strong flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 id="sync-history-title" className="font-headline-sm text-headline-sm text-text-primary font-bold">
            Synchronization History Log
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Chronological audit stream of data pipeline executions, payloads, and API status codes (sample log).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            icon="restart_alt"
            onClick={() =>
              toast({
                tone: 'demo',
                title: failedCount ? `${failedCount} failed/partial run${failedCount === 1 ? '' : 's'} not retried` : 'No failed runs to retry',
                description: 'Retrying needs the FastAPI sync worker, which isn’t connected in this prototype.',
              })
            }
          >
            Retry Failed Syncs
          </Button>
          <Button
            icon="download"
            onClick={() => {
              downloadCsv(handle, entries);
              toast({ tone: 'success', title: 'Sync audit log downloaded', description: 'CSV generated in your browser from the bundled demo log.' });
            }}
          >
            Download Sync Audit Log (CSV)
          </Button>
        </div>
      </div>
      <div className="px-5 py-3 border-b border-border-strong">
        <SegmentedControl
          size="xs"
          ariaLabel="Filter sync runs by status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            table.setPage(1);
          }}
          options={[
            { value: 'all', label: 'All', count: entries.length },
            { value: 'success', label: 'Success', count: count('success') },
            { value: 'partial', label: 'Partial', count: count('partial') },
            { value: 'failed', label: 'Failed', count: count('failed') },
          ]}
        />
      </div>
      {table.total === 0 ? (
        <div className="p-5">
          <EmptyState icon="history" title="No sync runs match this filter" />
        </div>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th className="px-5" sortKey="executedAt" sort={table.sort} onSort={table.toggleSort}>
                Execution Timestamp
              </Th>
              <Th className="px-5">Trigger Method</Th>
              <Th className="px-5" sortKey="durationSec" sort={table.sort} onSort={table.toggleSort}>
                Duration
              </Th>
              <Th className="px-5" sortKey="media" sort={table.sort} onSort={table.toggleSort}>
                Payload Processed
              </Th>
              <Th className="px-5">Status</Th>
              <Th className="px-5" align="right">
                Raw Output
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-strong">
            {table.rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-canvas transition-colors">
                <Td className="px-5 py-3.5 font-medium tnum">{r.executedLabel}</Td>
                <Td className="px-5 py-3.5 text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Icon name={triggerIcon[r.trigger]} className="text-[16px] text-text-tertiary" />
                    {r.triggerLabel}
                  </span>
                </Td>
                <Td className="px-5 py-3.5 text-text-secondary tnum">{r.durationSec !== null ? `${r.durationSec}s` : '—'}</Td>
                <Td className="px-5 py-3.5 text-text-secondary">
                  <span className="font-medium text-text-primary tnum">{formatNumber(r.media)}</span> media
                  {r.comments ? (
                    <>
                      , <span className="font-medium text-text-primary tnum">{formatNumber(r.comments)}</span> comments
                    </>
                  ) : null}
                </Td>
                <Td className="px-5 py-3.5">
                  <SyncStatusBadge entry={r} />
                </Td>
                <Td className="px-5 py-3.5" align="right">
                  <button type="button" onClick={() => setRawEntry(r)} className="text-text-secondary hover:text-text-primary text-[12px] font-mono hover:underline">
                    view_json
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        noun="sample runs"
      />
      <p className="px-5 pb-3 -mt-1 text-[11px] text-text-tertiary">
        The full log would record <span className="tnum">{formatNumber(totalRuns)}</span> synchronization runs for @{handle} (demo figure); the most recent sample runs are bundled here.
      </p>
      <RawPayloadModal entry={rawEntry} onClose={() => setRawEntry(null)} />
    </section>
  );
}
