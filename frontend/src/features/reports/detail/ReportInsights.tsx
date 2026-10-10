import { BarList } from '@/components/charts/BarList';
import { Icon } from '@/components/ui/Icon';
import { formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

/** Audience & geography (account-level audience summary — shared with the Audience screen). */
export function AudienceSection({ detail }: { detail: ReportDetail }) {
  const a = detail.audience;
  return (
    <div className="bg-surface-card rounded-xl border border-border-strong p-4 md:p-6 space-y-4" data-print-section="audience">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-strong pb-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">Audience &amp; Geography</h3>
          <p className="font-body-sm text-xs text-text-secondary">
            @ekoindia audience · {formatCompact(a.followers)} followers · {a.nonFollowerReachPct}% non-follower reach
          </p>
        </div>
        <Icon name="public" className="text-text-tertiary text-[18px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="font-label-code text-label-code text-text-tertiary uppercase tracking-wider mb-2">Top states by reach</p>
          <BarList items={a.topStates.map((s) => ({ label: s.label, value: s.share, sublabel: `${formatNumber(s.leads)} leads` }))} />
        </div>
        <div>
          <p className="font-label-code text-label-code text-text-tertiary uppercase tracking-wider mb-2">Age brackets</p>
          <BarList items={a.age.map((x) => ({ label: x.label, value: x.share, sublabel: x.note }))} barClassName="bg-tertiary" />
        </div>
      </div>
    </div>
  );
}

/** AI findings & recommendations. Report-specific narrative when present, otherwise derived from the format breakdown. */
export function AiRecommendations({ detail, onApply }: { detail: ReportDetail; onApply: () => void }) {
  const { report, computed } = detail;
  const n = report.narrative;
  const top = computed.formats[0];
  const observed =
    n?.observed ??
    (top
      ? `${top.label} generated ${top.share.toFixed(0)}% of engagement and ${formatNumber(top.leads)} content-attributed leads in ${computed.periodLabel}, at a ${top.avgEngagementRate.toFixed(2)}% average engagement rate.`
      : 'No content activity was recorded for this scope in the selected period.');
  const recommendation =
    n?.recommendation ??
    (top
      ? `Shift more of next month's creative bandwidth toward ${top.label.toLowerCase()} and reuse the hooks of the top creative (“${computed.creatives[0]?.content.title ?? '—'}”). Re-run this report after two weeks to confirm the lift.`
      : 'Publish content for the selected campaigns before generating recommendations.');
  return (
    <div className="bg-surface-card rounded-xl border border-indigo-200 shadow-xs p-4 md:p-6 space-y-4" data-print-section="recommendations">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-strong pb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-ai-subtle border border-ai-border text-ai-accent flex items-center justify-center">
            <Icon name="psychology" className="text-[16px]" />
          </span>
          <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">AI Strategic Insights &amp; Attribution Audit</h3>
        </div>
        <div className="flex items-center gap-2">
          {n && <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-label-code text-[11px] font-bold">CONFIDENCE: {n.confidencePct}%</span>}
          <span className="font-label-code text-[11px] text-text-tertiary uppercase">{n?.modelLabel ?? 'Rule-based summary (demo)'}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="p-4 rounded-lg bg-surface-canvas border border-border-strong space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-[11px] font-bold uppercase tracking-wider text-text-secondary">[OBSERVED METRIC TELEMETRY]</span>
            <Icon name="sensors" className="text-text-tertiary text-[16px]" />
          </div>
          <p className="font-body-md text-sm text-text-primary leading-relaxed">{observed}</p>
          <div className="pt-2 border-t border-border-strong flex items-center gap-2 font-label-code text-[10px] text-text-secondary">
            <span className="text-text-secondary font-bold">Demo data</span>
            <span>• Not verified against the Instagram Graph API</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-ai-subtle/50 border border-ai-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-[11px] font-bold uppercase tracking-wider text-ai-accent">[AI-GENERATED RECOMMENDATION]</span>
            <Icon name="bolt" className="text-ai-accent text-[16px]" />
          </div>
          <p className="font-body-md text-sm text-text-primary leading-relaxed">{recommendation}</p>
          <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-2 font-label-code text-[10px]">
            <span className="text-ai-accent font-bold">{n?.projectedImpact ?? 'Projected impact: not modelled for this report'}</span>
            <button type="button" onClick={onApply} className="text-text-primary underline font-bold hover:text-ai-accent print:hidden">
              Apply to Next Campaign →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
