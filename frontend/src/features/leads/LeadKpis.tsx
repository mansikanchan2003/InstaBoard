import { Skeleton } from '@/components/ui/States';
import { cn, formatNumber } from '@/lib/format';
import type { LeadPipelineSummary } from '@/types/domain';

/** Pipeline funnel stat cards (period totals) — markup follows the export's view-leads cards. */
export function LeadKpis({ summary }: { summary: LeadPipelineSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat label="Total Comment Inquiries" value={formatNumber(summary.totalCommentInquiries)} note="All Instagram comments" noteClass="text-text-tertiary" />
      <Stat
        label="AI Filtered Potential"
        value={formatNumber(summary.aiFilteredPotential)}
        note={`${summary.aiIntentRate.toFixed(1)}% intent rate`}
        noteClass="text-status-active font-semibold"
      />
      <Stat
        label="Qualified Campaign Leads"
        value={formatNumber(summary.qualifiedLeads)}
        note={`${summary.qualifiedLeadsDelta >= 0 ? '+' : '−'}${Math.abs(summary.qualifiedLeadsDelta).toFixed(1)}% this month`}
        noteClass="text-status-active font-bold"
        highlight
      />
      <Stat
        label="Converted Operators"
        value={formatNumber(summary.convertedOperators)}
        note={`${summary.closeRate.toFixed(1)}% close rate`}
        noteClass="text-status-completed font-semibold"
      />
    </div>
  );
}

function Stat({ label, value, note, noteClass, highlight }: { label: string; value: string; note: string; noteClass: string; highlight?: boolean }) {
  return (
    <div className={cn('bg-surface-card border rounded-lg p-3', highlight ? 'border-primary-container bg-amber-50/20' : 'border-border-strong')}>
      <span className={cn('text-xs block', highlight ? 'text-on-primary-container font-bold' : 'text-text-secondary')}>{label}</span>
      <span className="text-xl font-bold text-text-primary mt-1 block tnum">{value}</span>
      <span className={cn('text-[11px]', noteClass)}>{note}</span>
    </div>
  );
}

export function LeadKpisSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="status" aria-label="Loading lead summary">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[86px]" />
      ))}
    </div>
  );
}
