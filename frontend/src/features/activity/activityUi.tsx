import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn, formatDate, initials } from '@/lib/format';
import type { ActivityActor, ActivityCategory, ActivityEntry, ActivityOutcome, ActivityTarget } from '@/types/activity';

/* ------------------------------- Labels / options ------------------------------ */

export const categoryLabels: Record<ActivityCategory, string> = {
  data_sync: 'Data Sync & API',
  campaigns: 'Campaigns',
  content: 'Content',
  ai: 'AI Intelligence',
  reports: 'Reports',
  leads: 'Leads & Comments',
  security: 'Security & Accounts',
  settings: 'Settings & Config',
};

export const outcomeLabels: Record<ActivityOutcome, string> = {
  success: 'Success',
  in_progress: 'In Progress',
  warning: 'Warning',
  failed: 'Failed',
  resolved: 'Resolved',
};

export type OutcomeFilter = ActivityOutcome | 'issues' | '';
export type DateScope = 'period' | '7d' | 'today' | 'all';

export const dateScopes: Record<DateScope, { label: string; from?: string; to?: string }> = {
  period: { label: 'Oct 01 - 31, 2024', from: '2024-10-01', to: '2024-10-31' },
  '7d': { label: 'Oct 25 - 31, 2024', from: '2024-10-25', to: '2024-10-31' },
  today: { label: 'Oct 31, 2024 (Today)', from: '2024-10-31', to: '2024-10-31' },
  all: { label: 'All retained events' },
};

export interface ActivityFilterState {
  search: string;
  category: ActivityCategory | '';
  outcome: OutcomeFilter;
  /** Actor id, or "kind:member" / "kind:automated". */
  actor: string;
  account: string;
  date: DateScope;
}

export const defaultFilters: ActivityFilterState = { search: '', category: '', outcome: '', actor: '', account: '', date: 'period' };

/* ------------------------------------ Time ------------------------------------ */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2024-10-31T10:30:14" → { date: "Oct 31, 2024", time: "10:30:14 AM IST" } (values are already IST). */
export function formatIst(ts: string) {
  const [h, m, s] = ts.slice(11, 19).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${suffix}`;
  return { date: formatDate(ts), time: `${time} IST`, short: time };
}

export function weekdayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/* ------------------------------------ Pills ----------------------------------- */

const kindTones = {
  neutral: 'bg-surface-card-subtle text-text-secondary border border-border-strong',
  ai: 'bg-ai-subtle text-ai-accent border border-ai-border',
  warning: 'bg-status-paused-subtle text-status-paused border border-[#FDE68A]',
};

export function KindPill({ entry }: { entry: ActivityEntry }) {
  const iconClass = entry.kindTone === 'ai' ? 'text-ai-accent' : entry.kindTone === 'warning' ? 'text-status-paused' : entry.kindIconClass;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold', kindTones[entry.kindTone])}>
      <Icon name={entry.kindIcon} className={cn('text-[13px]', iconClass)} />
      <span>{entry.kind}</span>
    </span>
  );
}

const outcomeStyles: Record<ActivityOutcome, { pill: string; dot: string }> = {
  success: { pill: 'bg-status-active-subtle text-status-active border border-[#A7F3D0]', dot: 'bg-status-active' },
  in_progress: { pill: 'bg-tertiary-fixed/30 text-tertiary border border-tertiary/20', dot: 'bg-tertiary animate-pulse' },
  warning: { pill: 'bg-status-paused-subtle text-status-paused border border-[#FDE68A]', dot: 'bg-status-paused' },
  failed: { pill: 'bg-error-container/60 text-error border border-error/20', dot: 'bg-error' },
  resolved: { pill: 'bg-status-completed-subtle text-status-completed border border-[#BAE6FD]', dot: 'bg-status-completed' },
};

export function OutcomePill({ entry }: { entry: Pick<ActivityEntry, 'outcome' | 'outcomeLabel'> }) {
  const s = outcomeStyles[entry.outcome];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', s.pill)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      <span>{entry.outcomeLabel ?? outcomeLabels[entry.outcome]}</span>
    </span>
  );
}

export const outcomeTextClass: Record<ActivityOutcome, string> = {
  success: 'text-status-active',
  in_progress: 'text-tertiary',
  warning: 'text-status-paused',
  failed: 'text-error',
  resolved: 'text-status-completed',
};

export const rowTint: Partial<Record<ActivityOutcome, string>> = {
  warning: 'bg-amber-50/20',
  resolved: 'bg-amber-50/10',
  failed: 'bg-red-50/30',
};

export function ActorCell({ actor }: { actor?: ActivityActor }) {
  if (!actor) return <span className="text-text-tertiary text-[12px]">Unknown actor</span>;
  if (actor.kind === 'member') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-surface-container-high text-[9px] font-bold flex items-center justify-center shrink-0">{initials(actor.name)}</span>
        <span className="text-text-secondary font-medium text-[12px]">{actor.shortLabel}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Icon name={actor.icon ?? 'memory'} className={cn('text-[15px]', actor.kind === 'ai' ? 'text-ai-accent' : 'text-text-tertiary')} />
      <span className="text-text-secondary text-[12px]">{actor.shortLabel}</span>
    </div>
  );
}

export function TargetChip({ target }: { target: ActivityTarget }) {
  const cls = cn(
    'font-mono text-[11px] bg-surface-canvas border border-border-strong px-2 py-0.5 rounded',
    target.emphasis === 'strong' && 'font-semibold text-text-primary',
    target.emphasis === 'warning' && 'text-status-paused font-semibold',
    !target.emphasis && 'text-text-secondary',
  );
  if (!target.to) return <span className={cls}>{target.label}</span>;
  return (
    <Link
      to={target.to}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      className={cn(cls, 'hover:border-text-secondary hover:text-text-primary transition-colors')}
      title={target.module ? `Open ${target.module}` : undefined}
    >
      {target.label}
    </Link>
  );
}

/* ------------------------------------- CSV ------------------------------------ */

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Client-side CSV of the given (filtered) entries. Demo data only — generated in the browser. */
export function downloadActivityCsv(entries: ActivityEntry[], actorLookup: (id: string) => ActivityActor | undefined) {
  const header = ['event_id', 'timestamp_ist', 'category', 'event_type', 'title', 'summary', 'related_entity', 'entity_route', 'actor', 'actor_type', 'outcome', 'response_status'];
  const lines = entries.map((e) => {
    const actor = actorLookup(e.actorId);
    return [
      e.id,
      e.timestamp.replace('T', ' '),
      categoryLabels[e.category],
      e.kind,
      e.title,
      e.summary,
      e.target.label,
      e.target.to ?? '',
      actor?.name ?? e.actorId,
      actor?.kind === 'member' ? 'operator' : 'automated',
      e.outcomeLabel ?? outcomeLabels[e.outcome],
      e.responseStatus,
    ]
      .map(csvCell)
      .join(',');
  });
  const csv = ['# InstaBoard audit log export - DEMO DATA generated in your browser from prototype sample records (not retrieved from Meta or any server)', header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'instaboard-audit-log-demo.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
