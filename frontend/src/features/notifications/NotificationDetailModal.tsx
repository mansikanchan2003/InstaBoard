import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { cn } from '@/lib/format';
import type { NotificationAction, NotificationItem } from '@/types/notifications';
import { NotificationBody } from './NotificationCard';
import { categoryLabels, metaToneText, priorityLabels, toneClasses } from './notificationMeta';

/** "Inspect Detail" modal from the export. */
export function NotificationDetailModal({ item, onClose, onAction }: { item: NotificationItem | null; onClose: () => void; onAction: (a: NotificationAction) => void }) {
  if (!item) return null;
  const tone = toneClasses[item.tone];
  const badge = toneClasses[item.badge.tone];
  const action = item.primaryAction;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className={cn('w-7 h-7 rounded-lg border flex items-center justify-center', tone.box)}>
            <Icon name={item.icon} className="text-[17px]" />
          </span>
          <span className="text-label-sm font-label-sm font-semibold text-text-secondary uppercase">{categoryLabels[item.category]}</span>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => onAction(action)}>
            {action.label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-label-sm font-label-sm text-text-tertiary">{item.timestampLabel}</span>
          <span className={cn('h-5 px-2 rounded-full border text-[11px] font-semibold flex items-center', badge.pill)}>
            {item.priority === 'standard' ? item.badge.label : priorityLabels[item.priority]}
          </span>
        </div>
        <h2 className="text-headline-md font-headline-md font-bold text-text-primary">{item.title}</h2>
        <p className="text-body-md font-body-md text-text-secondary leading-relaxed">
          <NotificationBody item={item} />
        </p>
        <div className="bg-surface-canvas border border-border-strong rounded-lg p-3 flex flex-col gap-2 text-label-code font-label-code">
          {item.meta.map((m, i) => (
            <div key={m.label} className={cn('flex justify-between gap-3 py-1', i < item.meta.length - 1 && 'border-b border-border-subtle')}>
              <span className="text-text-tertiary uppercase">{m.label}</span>
              <span className={cn('text-right', m.tone ? metaToneText[m.tone] : 'text-text-primary font-bold')}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
