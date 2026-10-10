import type { ReactNode } from 'react';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

/**
 * Compact KPI tile used across the dashboard / detail screens:
 * label (+ optional delta or icon) on top, bold tabular stat, footnote at the bottom.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  footnote,
  icon,
  highlight,
  className,
  onClick,
}: {
  label: string;
  value: ReactNode;
  /** Percent change; positive renders emerald, negative red. */
  delta?: number;
  deltaLabel?: string;
  footnote?: ReactNode;
  icon?: string;
  highlight?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const positive = (delta ?? 0) >= 0;
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left bg-surface-card border rounded-lg p-3 transition-colors flex flex-col',
        highlight ? 'border-primary-container bg-amber-50/20' : 'border-border-strong hover:border-slate-300',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-label-sm block', highlight ? 'text-on-primary-container font-bold' : 'text-text-secondary')}>{label}</span>
        {icon && <Icon name={icon} className={cn('text-[16px]', highlight ? 'text-primary-container' : 'text-text-tertiary')} />}
      </div>
      <div className="font-metric-stat-lg text-metric-stat-sm text-text-primary mt-1 font-bold tnum">{value}</div>
      {delta !== undefined && (
        <span className={cn('text-[11px] font-semibold flex items-center gap-0.5', positive ? 'text-status-active' : 'text-error')}>
          <Icon name={positive ? 'trending_up' : 'trending_down'} className="text-[14px]" />
          {positive ? '+' : '−'}
          {Math.abs(delta).toFixed(1)}%{deltaLabel && <span className="font-normal text-text-tertiary ml-1">{deltaLabel}</span>}
        </span>
      )}
      {footnote && <span className="text-[11px] text-text-tertiary mt-0.5">{footnote}</span>}
    </Wrapper>
  );
}
