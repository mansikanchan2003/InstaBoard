import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { NotificationAction, NotificationItem } from '@/types/notifications';
import { categoryLabels, neutralTag, toneClasses } from './notificationMeta';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Renders `body`, bolding `emphasis` phrases and italicising the quoted comment. */
export function NotificationBody({ item }: { item: NotificationItem }): ReactNode {
  const marks = [...(item.emphasis ?? []), ...(item.quote ? [item.quote] : [])];
  if (marks.length === 0) return item.body;
  const parts = item.body.split(new RegExp(`(${marks.map(escapeRe).join('|')})`, 'g'));
  return parts.map((p, i) =>
    p === item.quote ? (
      <span key={i} className="italic text-text-primary">
        {p}
      </span>
    ) : item.emphasis?.includes(p) ? (
      <span key={i} className="font-semibold text-text-primary">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export function NotificationCard({
  item,
  onOpen,
  onInspect,
  onToggleRead,
  onAction,
}: {
  item: NotificationItem;
  onOpen: () => void;
  onInspect: () => void;
  onToggleRead: () => void;
  onAction: (action: NotificationAction) => void;
}) {
  const tone = toneClasses[item.tone];
  const badge = toneClasses[item.badge.tone];
  const actions = [item.primaryAction, item.secondaryAction].filter((a): a is NotificationAction => !!a);
  return (
    <article
      className={cn(
        'relative bg-surface-card border rounded-xl p-4 transition-all duration-150 hover:border-text-secondary hover:shadow-xs group',
        'border-border-strong',
        item.priority === 'urgent' && !item.read && 'border-l-4 border-l-primary-container',
      )}
      aria-label={`${item.read ? '' : 'Unread: '}${item.title}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="relative flex-shrink-0">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center', tone.box)}>
            <Icon name={item.icon} className="text-[20px]" />
          </div>
          {!item.read && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary-container ring-2 ring-white" aria-hidden />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label-sm font-label-sm font-semibold text-text-secondary">{categoryLabels[item.category]}</span>
              <span className="text-text-tertiary text-xs">•</span>
              <span className="text-label-sm font-label-sm text-text-tertiary">{item.timeLabel}</span>
              <span className={cn('h-[22px] px-2 rounded-full border text-[11px] font-semibold flex items-center gap-1', badge.pill)}>
                {item.badge.dot && <span className={cn('w-1.5 h-1.5 rounded-full', badge.dot)} />}
                {item.badge.icon && <Icon name={item.badge.icon} className="text-[12px]" />}
                <span>{item.badge.label}</span>
              </span>
              {item.priority === 'high' && item.badge.label !== 'High Priority' && (
                <span className="h-[22px] px-2 rounded-full border text-[11px] font-semibold flex items-center bg-error-container/40 border-error/20 text-on-error-container">High Priority</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-text-tertiary opacity-80 group-hover:opacity-100">
              <button type="button" className="p-1 hover:text-text-primary rounded hover:bg-surface-canvas" onClick={onInspect} title="Inspect Detail" aria-label={`Inspect details: ${item.title}`}>
                <Icon name="open_in_new" className="text-[17px]" />
              </button>
              <button
                type="button"
                className="p-1 hover:text-text-primary rounded hover:bg-surface-canvas"
                onClick={onToggleRead}
                title={item.read ? 'Mark as unread' : 'Mark as read'}
                aria-label={item.read ? `Mark as unread: ${item.title}` : `Mark as read: ${item.title}`}
              >
                <Icon name={item.read ? 'mark_email_read' : 'drafts'} className="text-[17px]" />
              </button>
            </div>
          </div>
          <h3>
            <button
              type="button"
              onClick={onOpen}
              className={cn('text-left text-headline-sm font-headline-sm text-text-primary hover:text-primary transition-colors', item.read ? 'font-semibold' : 'font-bold')}
            >
              {item.title}
            </button>
          </h3>
          <p className="text-body-md font-body-md text-text-secondary mt-1">
            <NotificationBody item={item} />
          </p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {item.tags.map((t) => (
              <span key={t.label} className={cn('px-2 py-0.5 rounded border text-label-code font-label-code', t.tone ? toneClasses[t.tone].pill : neutralTag)}>
                {t.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3.5 pt-2.5 border-t border-border-subtle">
            {actions.map((a, i) => (
              <span key={a.label} className="flex items-center gap-3">
                {i > 0 && <span className="text-border-strong" aria-hidden>•</span>}
                <button
                  type="button"
                  onClick={() => onAction(a)}
                  className={cn(
                    'text-label-md font-label-md flex items-center gap-1',
                    i === 0 ? 'font-bold text-text-primary hover:text-brand-primary-hover' : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  <span>{a.label}</span>
                  {i === 0 && <Icon name={a.icon ?? 'arrow_forward'} className="text-[16px]" />}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
