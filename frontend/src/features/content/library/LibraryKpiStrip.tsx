import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { cn, formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { AccountOverview, ContentItem } from '@/types/domain';

/** Compact tile copied from the export's "6 compact enterprise tiles" markup. */
function Tile({
  label,
  badge,
  badgeIcon = 'arrow_upward',
  value,
  footLeft,
  footRight,
  footRightClassName = 'text-text-secondary font-medium',
  className,
  badgeBold,
}: {
  label: string;
  badge?: string;
  badgeIcon?: string;
  value: ReactNode;
  footLeft: ReactNode;
  footRight: ReactNode;
  footRightClassName?: string;
  className?: string;
  badgeBold?: boolean;
}) {
  return (
    <div className={cn('bg-surface-card border border-border-strong rounded-lg p-3.5 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-colors', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-label-sm text-label-sm text-text-secondary font-medium">{label}</span>
        {badge && (
          <span className={cn('flex items-center text-status-active font-label-code text-label-code whitespace-nowrap', badgeBold && 'font-bold')}>
            <Icon name={badgeIcon} className="text-[14px]" />
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2">
        <span className="font-metric-stat-lg text-metric-stat-lg text-text-primary font-bold tnum">{value}</span>
      </div>
      <div className="mt-1 pt-2 border-t border-border-subtle flex items-center justify-between gap-2 text-text-tertiary text-label-sm font-label-sm">
        <span>{footLeft}</span>
        <span className={cn('text-right', footRightClassName)}>{footRight}</span>
      </div>
    </div>
  );
}

const pct = (v: number | undefined) => (v === undefined ? undefined : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`);

export function LibraryKpiSkeleton() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Loading KPIs">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-[120px]" />
      ))}
    </section>
  );
}

/** Account totals for the reporting period + content count derived from the content list. */
export function LibraryKpiStrip({ overview, content }: { overview: AccountOverview; content: ContentItem[] | undefined }) {
  const total = content?.length;
  const reelShare = content && content.length ? Math.round((content.filter((c) => c.type === 'reel').length / content.length) * 100) : undefined;
  const publishedThisPeriod = content?.filter((c) => c.publishedAt.startsWith('2024-10')).length;
  const leadTargetPct = (overview.leads.value / overview.leads.target) * 100;
  const er = overview.engagementRate;

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Tile
        label="Total Content"
        badge={publishedThisPeriod !== undefined ? `+${publishedThisPeriod}` : undefined}
        value={total ?? '—'}
        footLeft="Reels share"
        footRight={reelShare !== undefined ? `${reelShare}%` : '—'}
      />
      <Tile
        label="Total Views"
        badge={pct(overview.views.delta)}
        value={formatCompact(overview.views.value)}
        footLeft="vs Sep baseline"
        footRight={formatCompact(overview.views.baseline)}
      />
      <Tile
        label="Total Reach"
        badge={pct(overview.reach.delta)}
        value={formatCompact(overview.reach.value)}
        footLeft="vs Sep baseline"
        footRight={formatCompact(overview.reach.baseline)}
      />
      <Tile
        label="Avg. Engagement"
        badge={pct(er.delta)}
        value={formatPercent(er.value)}
        footLeft={`Benchmark: ${formatPercent(er.baseline, 1)}`}
        footRight={er.baseline !== undefined && er.value >= er.baseline ? 'Exceeds' : 'Below'}
        footRightClassName={er.baseline !== undefined && er.value >= er.baseline ? 'text-status-active font-semibold' : 'text-error font-semibold'}
      />
      <Tile
        label="Watch Time"
        badge={pct(overview.watchTimeHours.delta)}
        value={
          <>
            {formatNumber(overview.watchTimeHours.value)}
            <span className="text-headline-sm font-normal text-text-secondary ml-1">hrs</span>
          </>
        }
        footLeft="Avg per day"
        footRight={`${formatNumber(Math.round(overview.watchTimeHours.value / 31))} hrs`}
      />
      <Tile
        label="Leads Generated"
        badge={pct(overview.leads.delta)}
        badgeIcon="trending_up"
        badgeBold
        value={formatNumber(overview.leads.value)}
        footLeft={`CSP target: ${formatNumber(overview.leads.target)}`}
        footRight={`${leadTargetPct.toFixed(1)}% Target`}
        footRightClassName="text-status-active font-bold"
        className="bg-gradient-to-br from-surface-card to-status-active-subtle/30"
      />
    </section>
  );
}
