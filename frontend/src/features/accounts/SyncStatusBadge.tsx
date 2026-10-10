import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { cn } from '@/lib/format';
import type { SyncLogEntry, SyncRunStatus, SyncTrigger } from '@/types/accounts';

const statusCls: Record<SyncRunStatus, { pill: string; dot: string }> = {
  success: { pill: 'bg-status-active-subtle text-[#065F46] border-[#A7F3D0]', dot: 'bg-status-active' },
  partial: { pill: 'bg-status-paused-subtle text-[#92400E] border-[#FDE68A]', dot: 'bg-status-paused' },
  failed: { pill: 'bg-error-container/60 text-on-error-container border-error/20', dot: 'bg-error' },
};

export const triggerIcon: Record<SyncTrigger, string> = { scheduled: 'alarm', manual: 'touch_app', webhook: 'webhook', token_refresh: 'key' };

export function SyncStatusBadge({ entry }: { entry: Pick<SyncLogEntry, 'status' | 'statusLabel'> }) {
  const s = statusCls[entry.status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold border whitespace-nowrap', s.pill)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {entry.statusLabel}
    </span>
  );
}

/** "view_json" — shows the bundled sample payload for a sync run. */
export function RawPayloadModal({ entry, onClose }: { entry: SyncLogEntry | null; onClose: () => void }) {
  const json = entry ? JSON.stringify(entry.raw, null, 2) : '';
  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      size="md"
      icon="data_object"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          Raw sync output <DemoBadge label="Sample payload" />
        </span>
      }
      subtitle={entry ? `${entry.executedLabel} · ${entry.triggerLabel}` : undefined}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <p className="text-body-sm text-text-secondary mb-2 flex items-center gap-1.5">
        <Icon name="info" className="text-[16px]" />
        Illustrative payload bundled with the prototype — not a response from the Instagram Graph API.
      </p>
      <pre className="text-[12px] leading-5 font-mono bg-surface-canvas border border-border-strong rounded-lg p-3 overflow-x-auto custom-scrollbar text-text-primary">{json}</pre>
    </Modal>
  );
}
