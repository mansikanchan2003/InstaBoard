import type { ReactNode } from 'react';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/format';
import type { ActivityActor, ActivityEntry } from '@/types/activity';
import { categoryLabels, formatIst, KindPill, outcomeTextClass } from './activityUi';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-label-code text-label-code text-text-tertiary uppercase">{label}</div>
      <div className="font-semibold text-text-primary break-words">{children}</div>
    </div>
  );
}

export function ActivityDetailModal({ entry, actor, onClose }: { entry: ActivityEntry | null; actor?: ActivityActor; onClose: () => void }) {
  const toast = useToast();
  if (!entry) return null;
  const ts = formatIst(entry.timestamp);
  const json = JSON.stringify(entry.payload, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast({ title: 'Payload copied', description: `${entry.id} JSON copied to your clipboard (demo record).` });
    } catch {
      toast({ tone: 'warning', title: 'Copy unavailable', description: 'Your browser blocked clipboard access. Select the JSON and copy it manually.' });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="manage_search"
      title={entry.title}
      subtitle={<span className="font-label-code text-label-code text-text-tertiary">{entry.id}</span>}
      footer={
        <div className="flex items-center justify-between w-full gap-2 flex-wrap">
          <Button onClick={onClose}>Close</Button>
          {entry.target.to ? (
            <LinkButton to={entry.target.to} variant="primary" iconRight="arrow_forward">
              Open {entry.target.module ?? 'Related Module'}
            </LinkButton>
          ) : (
            <Button variant="primary" disabled iconRight="arrow_forward">
              Open Related Module
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <KindPill entry={entry} />
          <span className="text-body-sm text-text-tertiary">{categoryLabels[entry.category]}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-canvas border border-border-strong rounded-lg text-body-sm font-body-sm">
          <Meta label="Timestamp (IST)">
            {ts.date} • {ts.short}
          </Meta>
          <Meta label="Response status">
            <span className={cn('flex items-center gap-1', outcomeTextClass[entry.outcome])}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> {entry.responseStatus}
            </span>
          </Meta>
          <Meta label="Actor / source identity">
            {actor ? (actor.kind === 'member' ? `${actor.name} (${actor.email})` : actor.name) : entry.actorId}
            {actor?.role && <span className="block text-[11px] font-normal text-text-tertiary">{actor.role}</span>}
          </Meta>
          <Meta label="Origin / user agent">
            <span className="font-mono text-[11px] text-text-secondary font-normal">{entry.origin}</span>
          </Meta>
        </div>

        <div>
          <span className="font-label-sm text-label-sm font-bold text-text-primary block mb-1">Audit Narrative &amp; Reconciled Context</span>
          <div className="p-3 bg-white border border-border-strong rounded-lg text-body-sm text-text-secondary">{entry.narrative}</div>
        </div>

        {entry.diff && entry.diff.length > 0 && (
          <div>
            <span className="font-label-sm text-label-sm font-bold text-text-primary block mb-1">Recorded Changes</span>
            <div className="border border-border-strong rounded-lg overflow-x-auto">
              <table className="w-full text-body-sm min-w-[420px]">
                <thead>
                  <tr className="bg-surface-canvas text-text-secondary font-label-code text-label-code uppercase">
                    <th className="text-left py-2 px-3">Field</th>
                    <th className="text-left py-2 px-3">Before</th>
                    <th className="text-left py-2 px-3">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {entry.diff.map((d) => (
                    <tr key={d.field}>
                      <td className="py-2 px-3 font-semibold text-text-primary">{d.field}</td>
                      <td className="py-2 px-3 text-error/80 line-through decoration-error/40">{d.before}</td>
                      <td className="py-2 px-3 text-status-active font-medium">{d.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-label-sm text-label-sm font-bold text-text-primary">Raw Payload Snippet (JSON · demo record)</span>
            <button
              type="button"
              onClick={copy}
              className="text-primary hover:text-brand-primary-hover font-label-code text-label-code font-bold uppercase flex items-center gap-1"
            >
              <Icon name="content_copy" className="text-[13px]" /> Copy Raw
            </button>
          </div>
          <div className="bg-text-primary text-slate-200 p-3 rounded-lg font-mono text-[11px] overflow-x-auto custom-scrollbar border border-slate-700">
            <pre>{json}</pre>
          </div>
        </div>

        <Notice tone="demo">Sample audit record. This prototype has no backend, so entries are not hashed, signed or stored server-side.</Notice>
      </div>
    </Modal>
  );
}
