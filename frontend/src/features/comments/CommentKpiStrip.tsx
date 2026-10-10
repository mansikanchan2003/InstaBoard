import type { ReactNode } from 'react';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary } from '@/types/comments';
import { pct } from './commentMeta';

function Tile({ label, badge, badgeCls, children, footer, highlight, onClick }: {
  label: string;
  badge: ReactNode;
  badgeCls: string;
  children: ReactNode;
  footer: ReactNode;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left bg-surface-card rounded p-3 flex flex-col justify-between min-w-0',
        highlight ? 'border-2 border-primary-container/60 relative shadow-sm' : 'border border-border-strong',
        onClick && 'hover:border-slate-300 transition-colors',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className={cn('text-label-sm font-label-sm', highlight ? 'text-text-primary font-bold' : 'text-text-secondary')}>{label}</span>
        <span className={cn('text-label-code font-label-code px-1.5 py-0.5 rounded font-bold whitespace-nowrap', badgeCls)}>{badge}</span>
      </div>
      <div className="my-1.5">{children}</div>
      {footer}
    </Wrapper>
  );
}

function Bar({ value, cls }: { value: number; cls: string }) {
  return (
    <div className="w-full bg-surface-canvas h-1.5 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full', cls)} style={{ width: `${value}%` }} />
    </div>
  );
}

const stat = 'text-metric-stat-sm md:text-metric-stat-lg font-metric-stat-lg text-text-primary tnum tracking-tight';

/** Section 2 of the export: 7-metric KPI strip. */
export function CommentKpiStrip({ summary, onShowAwaiting, onShowLeads }: { summary: CommentSummary; onShowAwaiting: () => void; onShowLeads: () => void }) {
  const { totalComments: total, sentiment } = summary;
  const share = (n: number) => (n / total) * 100;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
      <Tile label="Total Comments" badge={`+${summary.totalDeltaPct}%`} badgeCls="text-status-active bg-status-active-subtle" footer={<div className="text-label-sm font-label-sm text-text-tertiary truncate">vs {formatNumber(summary.baselineComments)} in Sep baseline</div>}>
        <div className={stat}>{formatNumber(total)}</div>
      </Tile>
      <Tile label="Positive Sentiment" badge={pct(sentiment.positive, total)} badgeCls="text-status-active bg-status-active-subtle" footer={<Bar value={share(sentiment.positive)} cls="bg-status-active" />}>
        <div className={stat}>{formatNumber(sentiment.positive)}</div>
      </Tile>
      <Tile label="Neutral Sentiment" badge={pct(sentiment.neutral, total)} badgeCls="text-text-secondary bg-surface-card-subtle" footer={<Bar value={share(sentiment.neutral)} cls="bg-status-draft" />}>
        <div className={stat}>{formatNumber(sentiment.neutral)}</div>
      </Tile>
      <Tile label="Negative Sentiment" badge={pct(sentiment.negative, total)} badgeCls="text-error bg-error-container/40" footer={<Bar value={share(sentiment.negative)} cls="bg-error" />}>
        <div className={stat}>{formatNumber(sentiment.negative)}</div>
      </Tile>
      <Tile
        label="Potential Leads"
        badge="AI-ESTIMATED"
        badgeCls="bg-ai-subtle border border-ai-border text-ai-accent uppercase"
        highlight
        onClick={onShowLeads}
        footer={<div className="text-label-sm font-label-sm text-status-active font-semibold truncate">{summary.potentialLeadsDeltaLabel}</div>}
      >
        <div className={cn(stat, 'text-primary font-bold')}>{formatNumber(summary.potentialLeads)}</div>
      </Tile>
      <Tile
        label="Response Needed"
        badge="Action"
        badgeCls="bg-status-paused-subtle text-status-paused"
        onClick={onShowAwaiting}
        footer={<div className="text-label-sm font-label-sm text-text-secondary truncate">Awaiting review queue</div>}
      >
        <div className={cn(stat, 'text-error')}>{formatNumber(summary.needsResponse)}</div>
      </Tile>
      <Tile label="Avg Sentiment" badge={`+${summary.avgSentimentDeltaPts} pts`} badgeCls="text-status-active bg-status-active-subtle" footer={<div className="text-label-sm font-label-sm text-text-secondary truncate">Eko Brand Health: High</div>}>
        <div className="flex items-baseline gap-1">
          <div className={stat}>{summary.avgSentimentScore}</div>
          <span className="text-label-md font-label-md text-text-tertiary">/100</span>
        </div>
      </Tile>
    </div>
  );
}
