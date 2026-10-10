import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatNumber, formatPercent } from '@/lib/format';
import { signedPct, type AudiencePageData } from './model';

function Kpi({
  label,
  icon,
  hint,
  value,
  delta,
  deltaIcon = 'trending_up',
  context,
  accent,
  compare,
}: {
  label: string;
  icon: string;
  hint: string;
  value: ReactNode;
  delta: string;
  deltaIcon?: string;
  context: ReactNode;
  accent?: boolean;
  compare: boolean;
}) {
  return (
    <div className={cn('bg-surface-card border border-border-strong rounded-lg p-3.5 flex flex-col justify-between shadow-xs', accent && 'bg-gradient-to-b from-amber-50/20 to-white')}>
      <div className="flex items-center justify-between gap-2 text-text-secondary">
        <span className={cn('font-label-sm text-label-sm uppercase tracking-wider font-semibold', accent && 'text-primary')}>{label}</span>
        <span title={hint}>
          <Icon name={icon} className={cn('text-[16px]', accent ? 'text-primary' : 'text-text-tertiary')} label={hint} />
        </span>
      </div>
      <div className="my-2">
        <div className="font-metric-stat-lg text-metric-stat-lg text-text-primary font-bold tracking-tight tnum">{value}</div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        {compare && (
          <span className={cn('inline-flex items-center gap-0.5 font-semibold', accent ? 'text-primary' : delta.startsWith('−') ? 'text-error' : 'text-status-active')}>
            <Icon name={deltaIcon} className="text-[14px]" />
            {delta}
          </span>
        )}
        <span className="text-text-secondary text-right">{context}</span>
      </div>
    </div>
  );
}

/** Six KPI cards. With "compare" off, deltas and September baselines are hidden. */
export function AudienceKpis({ data, compare }: { data: AudiencePageData; compare: boolean }) {
  const { summary, intel, overview } = data;
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Kpi
        compare={compare}
        label="Total Reach"
        icon="visibility"
        hint="Unique accounts that saw your content"
        value={formatCompact(overview.reach.value)}
        delta={signedPct(overview.reach.delta ?? 0)}
        context={compare ? `vs Sep (${formatCompact(overview.reach.baseline)})` : 'Oct 1–31 total'}
      />
      <Kpi
        compare={compare}
        label="Engaged Audience"
        icon="touch_app"
        hint="Accounts that liked, commented, saved, or shared"
        value={formatCompact(summary.engagedAudience)}
        delta={signedPct(intel.kpis.engagedAudienceDeltaPct)}
        context={compare ? `vs Sep (${formatCompact(intel.kpis.engagedAudienceBaseline)})` : 'Interacting accounts'}
      />
      <Kpi
        compare={compare}
        label="Followers"
        icon="group"
        hint="Current total profile follower count"
        value={formatCompact(summary.followers)}
        delta={signedPct(summary.followerGrowthPct)}
        deltaIcon="arrow_upward"
        context={`Net growth (+${formatNumber(summary.netNewFollowers)})`}
      />
      <Kpi
        compare={compare}
        accent
        label="Non-Followers"
        icon="explore"
        hint="Proportion of reach coming from new audiences"
        value={`${summary.nonFollowerReachPct}%`}
        delta={signedPct(intel.kpis.nonFollowerDeltaPct)}
        deltaIcon="bolt"
        context="Discovery surge"
      />
      <Kpi
        compare={compare}
        label="Engagement Rate"
        icon="percent"
        hint="Engagements divided by total reach"
        value={formatPercent(overview.engagementRate.value)}
        delta={signedPct(overview.engagementRate.delta ?? 0)}
        context={`vs ${formatPercent(overview.engagementRate.baseline, 1)} bench`}
      />
      <Kpi
        compare={compare}
        label="New Followers"
        icon="person_add"
        hint="Followers acquired within October (gross)"
        value={formatNumber(intel.kpis.newFollowersGross)}
        delta={signedPct(intel.kpis.newFollowersDeltaPct)}
        context="Gross acquisitions"
      />
    </section>
  );
}

/** Three "highest value segment" summary cards derived from the segment, state and follower-split data. */
export function AudienceInsightCards({ data }: { data: AudiencePageData }) {
  const { intel, summary } = data;
  const topSegment = [...intel.segments].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  const topState = summary.topStates[0];
  const nonFollowerLeads = intel.followerSplit.find((r) => r.metric === 'leads')?.nonFollowers ?? 0;
  const cards = [
    {
      icon: 'military_tech',
      iconCls: 'bg-amber-50 text-primary',
      title: `${topSegment.label.replace(' Years Old', '')} Age Cohort`,
      tag: 'TOP CONVERTING',
      tagCls: 'bg-status-active-subtle text-status-active',
      body: (
        <>
          Strongest engagement rate at <strong className="text-text-primary">{formatPercent(topSegment.engagementRate)}</strong> and produced{' '}
          <strong className="text-text-primary">{topSegment.leads} attributed leads</strong> for CSP onboarding.
        </>
      ),
    },
    {
      icon: 'location_on',
      iconCls: 'bg-blue-50 text-status-completed',
      title: `${topState.label} Region`,
      tag: `${topState.share}% SHARE`,
      tagCls: 'bg-status-completed-subtle text-status-completed',
      body: (
        <>
          Largest geographical reach (<strong className="text-text-primary">{formatCompact(topState.reach)}</strong>) and highest localized lead volume (
          <strong className="text-text-primary">{topState.leads} leads</strong>).
        </>
      ),
    },
    {
      icon: 'explore',
      iconCls: 'bg-indigo-50 text-ai-accent',
      title: 'Non-Follower Discovery',
      tag: `${summary.nonFollowerReachPct}% TOTAL REACH`,
      tagCls: 'bg-ai-subtle text-ai-accent',
      body: (
        <>
          Viral Reels attribution drove <strong className="text-text-primary">{nonFollowerLeads} new agent inquiries</strong> from viewers who discovered Eko through the
          Explore tab.
        </>
      ),
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.title} className="bg-surface-card border border-border-strong rounded-lg p-3.5 flex items-start gap-3 shadow-xs">
          <div className={cn('p-2 rounded flex-shrink-0', c.iconCls)}>
            <Icon name={c.icon} className="text-[20px]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-headline-sm text-headline-sm text-text-primary font-bold">{c.title}</h4>
              <span className={cn('font-label-sm text-[10px] px-1.5 rounded font-bold', c.tagCls)}>{c.tag}</span>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
