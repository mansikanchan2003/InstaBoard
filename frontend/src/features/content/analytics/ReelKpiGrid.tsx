import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatNumber, formatPercent } from '@/lib/format';
import { ratio } from '../contentMeta';
import { rankOf, type AnalyticsPageData } from './model';

function Kpi({ label, aside, value, note, highlight }: { label: string; aside?: ReactNode; value: ReactNode; note: ReactNode; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden',
        highlight ? 'bg-amber-50/60 border-amber-300/80' : 'bg-surface-card border-border-strong',
      )}
    >
      {highlight && <div className="absolute top-0 right-0 w-8 h-8 bg-primary-container/20 rounded-bl-full pointer-events-none" />}
      <div className={cn('flex items-center justify-between gap-2 text-label-sm font-label-sm mb-1', highlight ? 'text-text-primary font-semibold' : 'text-text-secondary')}>
        <span>{label}</span>
        {aside}
      </div>
      <div className={cn('text-metric-stat-sm sm:text-metric-stat-lg font-metric-stat-lg tnum my-0.5', highlight ? 'text-primary' : 'text-text-primary')}>{value}</div>
      <div className={cn('text-label-sm font-label-sm', highlight ? 'text-text-primary font-medium' : 'text-text-secondary')}>{note}</div>
    </div>
  );
}

const chip = (text: string, cls = 'text-emerald-700 bg-status-active-subtle') => <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap', cls)}>{text}</span>;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;

/** The 8 KPI cards — values are the item's canonical metrics; notes are derived rates. */
export function ReelKpiGrid({ data }: { data: AnalyticsPageData }) {
  const { item, analytics, allContent, overview } = data;
  const m = item.metrics;
  const story = item.type === 'story';
  const nonFollowerPct = analytics?.discovery ? 100 - analytics.discovery.followerSharePct : undefined;
  const accountEr = overview.engagementRate.value;
  const leadsRank = rankOf(item, allContent, 'leads');
  const notTracked = 'Not tracked for Stories';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Kpi
        label="Views"
        aside={analytics?.viewsDeltaPct !== undefined && chip(signed(analytics.viewsDeltaPct), analytics.viewsDeltaPct >= 0 ? undefined : 'text-error bg-error-container/60')}
        value={formatCompact(m.views)}
        note={analytics?.viewsDeltaPct !== undefined ? `vs avg ${item.type} baseline` : `Rank #${rankOf(item, allContent, 'views')} of ${allContent.length}`}
      />
      <Kpi
        label="Reach"
        aside={nonFollowerPct !== undefined && nonFollowerPct >= 50 && chip('Discovery', 'text-primary bg-status-paused-subtle')}
        value={formatCompact(m.reach)}
        note={nonFollowerPct !== undefined ? `${nonFollowerPct}% non-followers` : `${Math.round(ratio(m.reach, m.views))}% of views unique`}
      />
      <Kpi
        label="Likes"
        aside={<Icon name="favorite" filled className="text-[12px] text-rose-500" />}
        value={story ? '—' : formatCompact(m.likes)}
        note={story ? notTracked : `${formatPercent(ratio(m.likes, m.views))} like rate`}
      />
      <Kpi
        label="Comments"
        aside={<Icon name="chat" className="text-[12px] text-blue-500" />}
        value={story ? '—' : formatNumber(m.comments)}
        note={story ? 'Replies arrive as DMs' : `${formatPercent(ratio(m.comments, m.views))} comment rate`}
      />
      <Kpi label="Shares" aside={ratio(m.shares, m.views) >= 1 && chip('Virality')} value={formatNumber(m.shares)} note={`${formatPercent(ratio(m.shares, m.views))} share rate`} />
      <Kpi
        label="Saves"
        aside={<Icon name="bookmark" filled className="text-[12px] text-amber-600" />}
        value={story ? '—' : formatCompact(m.saves)}
        note={story ? notTracked : `${formatPercent(ratio(m.saves, m.views))} save rate`}
      />
      <Kpi
        label="Engagement"
        aside={
          analytics?.engagementDeltaPct !== undefined &&
          chip(signed(analytics.engagementDeltaPct), analytics.engagementDeltaPct >= 0 ? undefined : 'text-error bg-error-container/60')
        }
        value={formatPercent(m.engagementRate)}
        note={m.engagementRate >= accountEr ? `Above account avg (${formatPercent(accountEr)})` : `Below account avg (${formatPercent(accountEr)})`}
      />
      <Kpi
        label="Leads Generated"
        aside={<Icon name="stars" className="text-[12px] text-primary" />}
        value={formatNumber(m.leads)}
        note={m.comments > 0 ? `${formatPercent(ratio(m.leads, m.comments), 1)} of comments → leads` : `Rank #${leadsRank} by leads`}
        highlight
      />
    </div>
  );
}

/** AI Performance Verdict banner (falls back to an honest "no verdict" note). */
export function AiVerdictBanner({ data }: { data: AnalyticsPageData }) {
  const verdict = data.analytics?.verdict;
  return (
    <div className="bg-ai-subtle border border-ai-border rounded-lg p-3.5 flex items-start gap-3">
      <div className="p-1.5 bg-white rounded border border-ai-border text-ai-accent shrink-0">
        <Icon name="auto_awesome" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-label-code font-label-code uppercase tracking-wider text-ai-accent bg-white px-2 py-0.5 rounded border border-ai-border font-bold">
            AI Performance Verdict
          </span>
          <span className="text-label-sm font-label-sm font-semibold text-text-primary">{verdict?.title ?? 'Verdict not generated'}</span>
        </div>
        <p className="text-body-sm font-body-sm text-text-secondary">
          {verdict?.body ??
            'No AI verdict exists for this item in the demo dataset. In production the verdict is generated by the InstaBoard backend once enough interaction data is synced.'}
        </p>
      </div>
    </div>
  );
}
