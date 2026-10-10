import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { ReportStatus, ReportType } from '@/types/reports';
import { reportStatusMeta, reportTypeLabel } from './reportOptions';

const statusStyles: Record<ReportStatus, { pill: string; dot?: string; icon?: string; spin?: boolean }> = {
  ready: { pill: 'bg-status-active-subtle text-status-active border-status-active/20 font-bold', dot: 'bg-status-active' },
  ready_demo: { pill: 'bg-status-active-subtle text-status-active border-status-active/20 font-bold', dot: 'bg-status-active' },
  generating: { pill: 'bg-status-paused-subtle text-[#92400E] border-status-paused/30 font-bold', icon: 'progress_activity', spin: true },
  scheduled: { pill: 'bg-tertiary-fixed/30 text-tertiary border-tertiary/20 font-bold', icon: 'schedule' },
  failed: { pill: 'bg-error-container/60 text-on-error-container border-error/20 font-bold', icon: 'error' },
  archived: { pill: 'bg-status-draft-subtle text-status-draft border-border-strong font-medium' },
};

export function ReportStatusBadge({ status, className, prefix }: { status: ReportStatus; className?: string; prefix?: string }) {
  const s = statusStyles[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label-sm font-label-sm border whitespace-nowrap', s.pill, className)}>
      {s.dot && <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />}
      {s.icon && <Icon name={s.icon} className={cn('text-[13px] -mx-0.5', s.spin && 'animate-spin')} />}
      {prefix}
      {reportStatusMeta[status].label}
    </span>
  );
}

export function ReportTypeBadge({ type, muted }: { type: ReportType; muted?: boolean }) {
  const exec = type === 'executive_summary';
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm border',
        exec ? 'bg-status-completed-subtle text-status-completed border-status-completed/20 font-semibold' : 'bg-surface-canvas border-border-strong',
        !exec && (muted ? 'text-text-secondary' : 'text-text-primary'),
      )}
    >
      {reportTypeLabel(type)}
    </span>
  );
}
