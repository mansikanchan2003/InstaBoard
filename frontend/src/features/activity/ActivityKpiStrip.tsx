import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { cn, formatDelta, formatNumber } from '@/lib/format';
import { ACTIVITY_PERIOD } from '@/services/activity';
import type { ActivitySummary } from '@/types/activity';

function KpiTile({
  label,
  icon,
  iconClass,
  children,
  footLabel,
  footValue,
  onClick,
  active,
  ariaLabel,
}: {
  label: string;
  icon: string;
  iconClass: string;
  children: ReactNode;
  footLabel: string;
  footValue: ReactNode;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      aria-label={ariaLabel}
      className={cn(
        'text-left bg-surface-card border rounded-xl p-4 flex flex-col justify-between hover:border-text-secondary transition-all',
        active ? 'border-primary-container ring-1 ring-primary-container' : 'border-border-strong',
      )}
    >
      <div className="flex items-center justify-between text-text-secondary mb-2 w-full gap-2">
        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider">{label}</span>
        <Icon name={icon} className={cn('text-[20px]', iconClass)} />
      </div>
      <div>{children}</div>
      <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between font-label-code text-label-code text-text-tertiary w-full gap-2">
        <span>{footLabel}</span>
        <span className="font-semibold text-text-secondary text-right">{footValue}</span>
      </div>
    </Wrapper>
  );
}

export type KpiQuickFilter = 'automated' | 'operator' | 'issues' | null;

export function ActivityKpiStrip({ summary, active, onQuickFilter }: { summary: ActivitySummary; active: KpiQuickFilter; onQuickFilter: (f: KpiQuickFilter) => void }) {
  const pct = (n: number) => (summary.total ? Math.round((n / summary.total) * 100) : 0);
  const delta = summary.previousPeriodTotal ? ((summary.total - summary.previousPeriodTotal) / summary.previousPeriodTotal) * 100 : 0;
  const toggle = (f: Exclude<KpiQuickFilter, null>) => onQuickFilter(active === f ? null : f);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <KpiTile label="Total Events Logged" icon="list_alt" iconClass="text-text-tertiary" footLabel="PERIOD" footValue={ACTIVITY_PERIOD.label}>
        <div className="font-metric-stat-lg text-metric-stat-lg font-bold text-text-primary tnum">{formatNumber(summary.total)}</div>
        <div className="font-body-sm text-body-sm text-text-secondary mt-1 flex items-center gap-1 flex-wrap">
          <span className={cn('font-medium', delta >= 0 ? 'text-status-active' : 'text-error')}>{formatDelta(delta)}</span>
          <span>vs previous 30-day period</span>
        </div>
      </KpiTile>
      <KpiTile
        label="Automated System Actions"
        icon="smart_toy"
        iconClass="text-tertiary"
        footLabel="PIPELINE HEALTH"
        footValue={
          <span className="text-status-active flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active" /> {summary.pipelineHealth.toFixed(2)}%
          </span>
        }
        onClick={() => toggle('automated')}
        active={active === 'automated'}
        ariaLabel="Filter to automated system actions"
      >
        <div className="flex items-baseline gap-2">
          <div className="font-metric-stat-lg text-metric-stat-lg font-bold text-text-primary tnum">{formatNumber(summary.automated)}</div>
          <span className="font-label-md text-label-md font-semibold text-text-secondary tnum">({pct(summary.automated)}%)</span>
        </div>
        <div className="font-body-sm text-body-sm text-text-secondary mt-1">Meta Graph syncs, AI synthesis, scheduled jobs</div>
      </KpiTile>
      <KpiTile
        label="Operator / Staff Actions"
        icon="badge"
        iconClass="text-primary"
        footLabel="ACTIVE OPERATORS"
        footValue={`${summary.activeOperators} MEMBERS`}
        onClick={() => toggle('operator')}
        active={active === 'operator'}
        ariaLabel="Filter to operator actions"
      >
        <div className="flex items-baseline gap-2">
          <div className="font-metric-stat-lg text-metric-stat-lg font-bold text-text-primary tnum">{formatNumber(summary.operator)}</div>
          <span className="font-label-md text-label-md font-semibold text-text-secondary tnum">({pct(summary.operator)}%)</span>
        </div>
        <div className="font-body-sm text-body-sm text-text-secondary mt-1">Report generation, lead triage, campaign &amp; preference updates</div>
      </KpiTile>
      <KpiTile
        label="Failed / Warning Events"
        icon="warning"
        iconClass="text-status-paused"
        footLabel="RESOLVED STATUS"
        footValue={`${summary.issuesAddressed} of ${summary.issues} ADDRESSED`}
        onClick={() => toggle('issues')}
        active={active === 'issues'}
        ariaLabel="Filter to failed and warning events"
      >
        <div className="flex items-baseline gap-2">
          <div className="font-metric-stat-lg text-metric-stat-lg font-bold text-status-paused tnum">{summary.issues}</div>
          <span className="font-label-md text-label-md font-semibold text-text-secondary">Events</span>
        </div>
        <div className="font-body-sm text-body-sm text-text-secondary mt-1">Token expiry alerts, revoked tokens, transient rate limit throttling</div>
      </KpiTile>
    </div>
  );
}

export function ActivityKpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" role="status" aria-label="Loading summary">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[150px] rounded-xl" />
      ))}
    </div>
  );
}
