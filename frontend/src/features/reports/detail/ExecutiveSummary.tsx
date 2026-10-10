import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatCompact, formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

function Pillar({ label, icon, iconClass, title, foot }: { label: string; icon: string; iconClass: string; title: string; foot: ReactNode }) {
  return (
    <div className="p-4 rounded-lg bg-surface-canvas border border-border-strong flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="font-label-code text-[11px] text-text-secondary uppercase">{label}</span>
          <Icon name={icon} className={`text-[18px] ${iconClass}`} />
        </div>
        <div className="font-headline-sm text-[15px] font-bold text-text-primary leading-snug">{title}</div>
      </div>
      <div className="mt-3 pt-2 border-t border-border-strong font-body-sm text-xs text-text-secondary">{foot}</div>
    </div>
  );
}

const B = ({ children }: { children: ReactNode }) => <strong className="text-text-primary font-semibold">{children}</strong>;

/** Executive summary: narrative text + 4 pillars, every figure derived from the computed report. */
export function ExecutiveSummary({ detail, cplBenchmark }: { detail: ReportDetail; cplBenchmark: number }) {
  const { report, computed } = detail;
  const t = computed.totals;
  const top = computed.formats[0];
  const runnerUp = computed.formats[1];
  const states = computed.topStates.slice(0, 2);
  const stateShare = states.reduce((a, s) => a + s.share, 0);
  const stateLeads = states.reduce((a, s) => a + s.leads, 0);
  const allStateLeads = computed.topStates.reduce((a, s) => a + s.leads, 0);
  const subject = report.scope === 'account' ? '@ekoindia (all campaigns + organic content)' : computed.campaigns.map((c) => c.name).join(' and ') || 'the selected content';
  const cplDelta = t.cpl !== null ? ((t.cpl - cplBenchmark) / cplBenchmark) * 100 : null;

  return (
    <div className="bg-surface-card rounded-xl border border-amber-200/80 shadow-xs overflow-hidden relative" data-print-section="summary">
      <div className="bg-gradient-to-r from-amber-50/70 via-amber-50/20 to-white px-4 md:px-6 py-4 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="p-1 rounded bg-amber-500/10 text-brand-primary-hover flex items-center justify-center">
            <Icon name="auto_awesome" className="text-[20px]" />
          </span>
          <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">Executive Performance Summary</h2>
          <span className="px-2 py-0.5 rounded bg-ai-subtle border border-ai-border text-ai-accent font-label-code text-[10px] font-bold tracking-wider">[AI-SYNTHESIZED OVERVIEW]</span>
        </div>
        <span className="font-body-sm text-xs text-text-secondary">Synthesized {report.generatedLabel} from demo data — no Instagram connection</span>
      </div>
      <div className="p-4 md:p-6 space-y-5">
        <p className="font-body-lg text-body-lg text-text-primary leading-relaxed">
          During {computed.periodLabel}, {subject} delivered <B>{formatCompact(t.views)} total views</B> and <B>{formatNumber(t.leads)} leads</B>
          {t.conversionRate !== null && (
            <>
              , representing an <B>{t.conversionRate.toFixed(1)}% conversion rate</B>
            </>
          )}
          {t.cpl !== null && (
            <>
              {' '}
              at <B>₹{Math.round(t.cpl)} CPL</B>
            </>
          )}
          .{' '}
          {top && (
            <>
              {top.label} accounted for <B>{top.share.toFixed(0)}% of engagement</B> and <B>{formatNumber(top.leads)} content-attributed leads</B>
              {computed.efficiencyRatio !== null && runnerUp && (
                <>
                  , with a <B>{computed.efficiencyRatio.toFixed(1)}x</B> better lead yield per view than the next-best format
                </>
              )}
              .{' '}
            </>
          )}
          {states[0] && (
            <>
              {states[0].label} represented the largest geographic concentration ({states[0].share}% of account reach).
            </>
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <Pillar
            label="Top Conversion Channel"
            icon="smart_display"
            iconClass="text-primary-container"
            title={top?.label ?? '—'}
            foot={
              <>
                <span className="font-semibold text-text-primary">{formatNumber(top?.leads ?? 0)} leads</span>
                {t.avgWatchSec !== null && ` • ${t.avgWatchSec.toFixed(1)}s avg watch`}
              </>
            }
          />
          <Pillar
            label="Geographic Concentration"
            icon="map"
            iconClass="text-tertiary"
            title={states.map((s) => s.label).join(' & ')}
            foot={
              <>
                <span className="font-semibold text-text-primary">{stateShare}% of reach</span> · {allStateLeads ? Math.round((stateLeads / allStateLeads) * 100) : 0}% of attributed leads
              </>
            }
          />
          {report.narrative?.responseVelocity ? (
            <Pillar
              label="Response Velocity"
              icon="speed"
              iconClass="text-status-paused"
              title={report.narrative.responseVelocity.title}
              foot={
                <>
                  <span className="font-semibold text-text-primary">{report.narrative.responseVelocity.highlight}</span> {report.narrative.responseVelocity.detail}
                </>
              }
            />
          ) : (
            <Pillar
              label="Conversation Yield"
              icon="forum"
              iconClass="text-status-paused"
              title={`${formatNumber(t.comments)} Comments`}
              foot={
                <>
                  <span className="font-semibold text-text-primary">{t.comments ? ((t.leads / t.comments) * 100).toFixed(1) : '0'}%</span> converted to leads
                </>
              }
            />
          )}
          <Pillar
            label="Cost Efficiency"
            icon="payments"
            iconClass="text-status-active"
            title={t.cpl !== null ? `₹${Math.round(t.cpl)} Cost Per Lead` : 'CPL not attributed'}
            foot={
              cplDelta !== null ? (
                <>
                  <span className="font-semibold text-status-active">{Math.round(cplDelta)}% vs baseline</span> benchmark of ₹{cplBenchmark}
                </>
              ) : (
                'Boost spend is tracked per campaign, not per creative'
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
