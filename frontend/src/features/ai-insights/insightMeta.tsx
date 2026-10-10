import { Fragment } from 'react';
import { cn } from '@/lib/format';
import type { ActionStatus, InsightCategory, InsightPriority, InsightStatus } from '@/types/insights';

export const categoryMeta: Record<InsightCategory, { label: string; tab: string }> = {
  campaign: { label: 'Campaign Performance', tab: 'Campaign Performance' },
  content: { label: 'Content Intelligence', tab: 'Content Intelligence' },
  audience: { label: 'Audience Intelligence', tab: 'Audience' },
  comments: { label: 'Comments & Sentiment', tab: 'Comments & Sentiment' },
  leads: { label: 'Lead Gen', tab: 'Lead Gen' },
};

export const categoryOrder: InsightCategory[] = ['campaign', 'content', 'audience', 'comments', 'leads'];

export const priorityMeta: Record<InsightPriority, { label: string; short: string; pill: string; dot: string }> = {
  high: { label: 'HIGH PRIORITY', short: 'HIGH', pill: 'bg-error-container text-on-error-container', dot: 'bg-error' },
  medium: { label: 'MEDIUM PRIORITY', short: 'MED', pill: 'bg-status-paused-subtle text-status-paused border border-status-paused/30', dot: 'bg-status-paused' },
  low: { label: 'LOW PRIORITY', short: 'LOW', pill: 'bg-surface-card-subtle text-text-secondary border border-border-strong', dot: 'bg-text-tertiary' },
};

export function PriorityPill({ priority, short, className }: { priority: InsightPriority; short?: boolean; className?: string }) {
  const m = priorityMeta[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-code font-label-code font-semibold whitespace-nowrap', m.pill, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
      {short ? m.short : m.label}
    </span>
  );
}

export const insightStatusMeta: Record<InsightStatus, { label: string; pill: string; icon: string }> = {
  new: { label: 'New', pill: 'bg-ai-subtle border-ai-border text-ai-accent', icon: 'fiber_new' },
  reviewed: { label: 'Reviewed', pill: 'bg-status-active-subtle border-status-active/30 text-status-active', icon: 'check_circle' },
  dismissed: { label: 'Dismissed', pill: 'bg-surface-card-subtle border-border-strong text-text-secondary', icon: 'visibility_off' },
};

export const actionStatusMeta: Record<ActionStatus, { label: string; pill: string }> = {
  pending_review: { label: 'Pending Review', pill: 'bg-status-paused-subtle text-status-paused border border-status-paused/30' },
  reviewed: { label: 'Reviewed', pill: 'bg-surface-card-subtle text-text-secondary border border-border-strong' },
  done: { label: 'Done', pill: 'bg-status-active-subtle text-status-active border border-status-active/30' },
  dismissed: { label: 'Dismissed', pill: 'bg-surface-card-subtle text-text-tertiary border border-border-strong line-through' },
};

/** Renders the `[[b:…]]`, `[[pos:…]]`, `[[neg:…]]` inline markup used in insight copy. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[\[(?:b|pos|neg):[^\]]+\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[\[(b|pos|neg):([^\]]+)\]\]$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const cls = m[1] === 'pos' ? 'text-status-active font-semibold' : m[1] === 'neg' ? 'text-error font-semibold' : 'text-text-primary font-semibold';
        return (
          <strong key={i} className={cls}>
            {m[2]}
          </strong>
        );
      })}
    </>
  );
}

/** Plain-text version of the markup (for print / clipboard). */
export const stripMarkup = (text: string) => text.replace(/\[\[(?:b|pos|neg):([^\]]+)\]\]/g, '$1');
