import { DemoBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { TableShell, Td, Th } from '@/components/tables/DataTable';
import { cn } from '@/lib/format';
import type { CapabilityRow, CapabilityStatus } from '@/types/accounts';

const statusMeta: Record<CapabilityStatus, { label: string; cls: string; dot?: string }> = {
  available: { label: 'Available', cls: 'bg-status-active-subtle text-[#065F46] border-[#A7F3D0]', dot: 'bg-status-active' },
  partial: { label: 'Partial', cls: 'bg-status-paused-subtle text-[#92400E] border-[#FDE68A]', dot: 'bg-status-paused' },
  permission_required: { label: 'Permission Required', cls: 'bg-status-draft-subtle text-status-draft border-border-strong' },
  unavailable: { label: 'Unavailable', cls: 'bg-error-container/60 text-on-error-container border-error/20', dot: 'bg-error' },
};

/** "Data Availability & Meta API Capabilities Matrix". */
export function CapabilitiesMatrix({ rows, version, onRefresh, refreshing }: { rows: CapabilityRow[]; version: string; onRefresh: () => void; refreshing: boolean }) {
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] overflow-hidden" aria-labelledby="capabilities-title">
      <div className="p-5 border-b border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 id="capabilities-title" className="font-headline-sm text-headline-sm text-text-primary font-bold">
            Data Availability &amp; Meta API Capabilities Matrix
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Sample status of Instagram Graph API {version} endpoints and feature support for this account.</p>
        </div>
        <div className="flex items-center gap-2">
          <DemoBadge />
          <span className="font-label-sm text-label-sm text-text-secondary whitespace-nowrap">
            Graph API: <strong className="text-text-primary">{version} (LTS)</strong>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-surface-canvas disabled:opacity-50"
            aria-label="Reload capability matrix"
          >
            <Icon name="refresh" className={cn('text-[18px]', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th className="px-5">Data Category</Th>
            <Th className="px-5">Metric Endpoints</Th>
            <Th className="px-5">Status</Th>
            <Th className="px-5">Last Updated</Th>
            <Th className="px-5">API Limitations &amp; Technical Notes</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-strong">
          {rows.map((r) => {
            const s = statusMeta[r.status];
            return (
              <tr key={r.key} className="hover:bg-surface-canvas transition-colors">
                <Td className="px-5 py-3.5 font-semibold whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <Icon name={r.icon} className={cn('text-[18px]', r.iconClassName ?? 'text-text-secondary')} />
                    {r.category}
                  </span>
                </Td>
                <Td className="px-5 py-3.5 text-text-secondary font-mono text-[12px] min-w-[200px] whitespace-normal">{r.endpoints}</Td>
                <Td className="px-5 py-3.5">
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold border whitespace-nowrap', s.cls)}>
                    {s.dot && <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />}
                    {s.label}
                  </span>
                </Td>
                <Td className={cn('px-5 py-3.5 tnum whitespace-nowrap', r.lastUpdated ? 'text-text-secondary' : 'text-text-tertiary')}>{r.lastUpdated ?? 'N/A'}</Td>
                <Td className="px-5 py-3.5 text-text-secondary min-w-[240px] whitespace-normal">
                  {r.note}
                  {r.noteScope && (
                    <>
                      {' '}
                      <code className="font-mono text-[11px] bg-surface-canvas px-1.5 py-0.5 rounded text-text-primary">{r.noteScope}</code> review
                    </>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </section>
  );
}
