import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { AccountStatus } from '@/types/domain';

const styles: Record<AccountStatus, { label: string; cls: string; dot?: string; icon?: string }> = {
  connected: { label: 'Connected & Healthy', cls: 'bg-status-active-subtle border-emerald-200 text-[#065F46] font-semibold', dot: 'bg-status-active' },
  action_required: { label: 'Action Required — Token Refresh', cls: 'bg-status-paused-subtle border-amber-300 text-status-paused font-bold', icon: 'warning' },
  expired: { label: 'Connection Expired', cls: 'bg-surface-card-subtle border-border-strong text-status-draft font-semibold', dot: 'bg-slate-400' },
  syncing: { label: 'Syncing', cls: 'bg-status-completed-subtle border-sky-200 text-status-completed font-semibold', icon: 'sync' },
};

/** Status pill exactly as designed on the account cards (optionally prefixed "Status:" on the detail header). */
export function AccountStatusPill({ status, prefix, className }: { status: AccountStatus; prefix?: string; className?: string }) {
  const s = styles[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm border whitespace-nowrap', s.cls, className)}>
      {s.dot && <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />}
      {s.icon && <Icon name={s.icon} className="text-[13px]" />}
      {prefix}
      {s.label}
    </span>
  );
}

export const accountStatusLabel = (status: AccountStatus) => styles[status].label;
