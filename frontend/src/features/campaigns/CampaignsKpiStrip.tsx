import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatDelta, formatNumber, formatPercent } from '@/lib/format';
import type { AccountOverview, Campaign } from '@/types/domain';

interface Kpi {
  label: string;
  icon: string;
  iconClassName: string;
  value: string;
  foot: string;
  footIcon: string;
  positive?: boolean;
  suffix?: string;
  title?: string;
}

const ACCOUNT_NOTE = 'Account-level total for the reporting period (campaign + organic content)';

/** Export: "6 COMPACT KPI CARDS". Counts are derived from the campaign list; totals come from the account overview. */
export function CampaignsKpiStrip({ campaigns, overview }: { campaigns: Campaign[]; overview: AccountOverview | undefined }) {
  const active = campaigns.filter((c) => c.status === 'active').length;
  const scheduled = campaigns.filter((c) => c.status === 'scheduled').length;
  const regions = new Set(campaigns.flatMap((c) => c.targetRegions)).size;
  const delta = (d: number | undefined) => (d === undefined ? '—' : formatDelta(d));

  const kpis: Kpi[] = [
    {
      label: 'Active Campaigns',
      icon: 'play_circle',
      iconClassName: 'text-status-active',
      value: String(active),
      foot: `${scheduled} scheduled next`,
      footIcon: 'event',
    },
    {
      label: 'Total Campaigns',
      icon: 'folder',
      iconClassName: 'text-text-secondary',
      value: String(campaigns.length),
      foot: `Across ${regions} region${regions === 1 ? '' : 's'}`,
      footIcon: 'inventory_2',
    },
    {
      label: 'Total Reach',
      icon: 'hub',
      iconClassName: 'text-primary',
      value: overview ? formatCompact(overview.reach.value) : '—',
      foot: delta(overview?.reach.delta),
      footIcon: 'trending_up',
      positive: true,
      suffix: 'vs Sep',
      title: ACCOUNT_NOTE,
    },
    {
      label: 'Total Views',
      icon: 'visibility',
      iconClassName: 'text-tertiary',
      value: overview ? formatCompact(overview.views.value) : '—',
      foot: delta(overview?.views.delta),
      footIcon: 'trending_up',
      positive: true,
      suffix: 'vs Sep',
      title: ACCOUNT_NOTE,
    },
    {
      label: 'Leads Generated',
      icon: 'contact_page',
      iconClassName: 'text-primary',
      value: overview ? formatNumber(overview.leads.value) : '—',
      foot: delta(overview?.leads.delta),
      footIcon: 'trending_up',
      positive: true,
      suffix: overview ? `target ${overview.leads.target}` : undefined,
      title: ACCOUNT_NOTE,
    },
    {
      label: 'Avg. Engagement',
      icon: 'insights',
      iconClassName: 'text-ai-accent',
      value: overview ? formatPercent(overview.engagementRate.value) : '—',
      foot: overview ? `+${(overview.engagementRate.value - (overview.engagementRate.baseline ?? overview.engagementRate.value)).toFixed(2)} pts` : '—',
      footIcon: 'trending_up',
      positive: true,
      suffix: 'vs Sep',
      title: ACCOUNT_NOTE,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {kpis.map((k) => (
        <div key={k.label} className="p-3.5 rounded-lg bg-surface-card border border-border-strong flex flex-col justify-between" title={k.title}>
          <div className="flex items-center justify-between text-text-secondary gap-2">
            <span className="font-label-sm text-label-sm font-semibold truncate">{k.label}</span>
            <Icon name={k.icon} className={cn('text-[18px]', k.iconClassName)} />
          </div>
          <div className="my-1.5">
            <div className="font-metric-stat-lg text-metric-stat-lg text-text-primary tnum">{k.value}</div>
          </div>
          <div className={cn('flex items-center gap-1 font-label-sm text-label-sm flex-wrap', k.positive ? 'text-status-active font-semibold' : 'text-text-secondary')}>
            <Icon name={k.footIcon} className="text-[14px]" />
            <span>{k.foot}</span>
            {k.suffix && <span className="text-text-tertiary font-normal text-[10px]">{k.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CampaignsKpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="p-3.5 rounded-lg bg-surface-card border border-border-strong space-y-2.5">
          <div className="h-3 w-20 bg-border-strong/70 animate-pulse rounded" />
          <div className="h-8 w-16 bg-border-strong/70 animate-pulse rounded" />
          <div className="h-3 w-24 bg-border-strong/70 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
