import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DemoBadge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { Insight, InsightReasoning, InsightTelemetry } from '@/types/insights';
import { RichText } from './insightMeta';

function SectionShell({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-strong pb-3">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-text-primary">{title}</h2>
          {subtitle && <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

/** Placeholder for sections without evidence in the demo dataset. */
export function MissingEvidence({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <SectionShell title={title}>
      <div className="flex items-start gap-2.5 bg-surface-canvas border border-dashed border-border-strong rounded p-3 text-body-sm text-text-secondary">
        <Icon name="science" className="text-[18px] text-text-tertiary" />
        <div>
          <p className="font-semibold text-text-primary">Evidence not available in demo data</p>
          {children ?? <p className="mt-0.5">This section would be populated by the synthesis engine once the backend is connected.</p>}
        </div>
      </div>
    </SectionShell>
  );
}

const deltaTone = { positive: 'text-status-active', negative: 'text-error', neutral: 'text-text-tertiary' } as const;
const segTone = { active: 'bg-status-active', primary: 'bg-primary-container', muted: 'bg-border-strong' } as const;

/** 1. Observed performance telemetry (comparison table + optional retention breakdown). */
export function TelemetrySection({ telemetry: t }: { telemetry: InsightTelemetry }) {
  return (
    <SectionShell
      title={t.title}
      subtitle={t.subtitle}
      badge={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-status-active-subtle border border-status-active text-text-primary font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
            OBSERVED DATA - NOT ESTIMATED
          </span>
          <DemoBadge />
        </span>
      }
    >
      <div className="overflow-x-auto custom-scrollbar border border-border-strong rounded">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-surface-canvas border-b border-border-strong">
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-secondary uppercase tracking-wider">Metric Parameter</th>
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-primary font-bold bg-amber-50/50 border-x border-border-strong">
                <span className="flex items-center gap-1">
                  <Icon name={t.primaryIcon} className="text-[14px] text-primary" />
                  {t.primaryLabel}
                </span>
              </th>
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <Icon name={t.comparisonIcon} className="text-[14px]" />
                  {t.comparisonLabel}
                </span>
              </th>
              <th className="py-2.5 px-3.5 text-label-sm font-label-sm text-text-secondary text-right">Delta / Multiplier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-strong font-body-sm text-body-sm">
            {t.rows.map((r) => (
              <tr key={r.label} className={cn('hover:bg-surface-canvas', r.emphasis && 'bg-emerald-50/40')}>
                <td className={cn('py-2.5 px-3.5', r.emphasis ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>{r.label}</td>
                <td className={cn('py-2.5 px-3.5 text-text-primary border-x border-border-strong tnum', r.emphasis ? 'font-extrabold bg-amber-100/60' : 'font-semibold bg-amber-50/30')}>
                  {r.primary} {r.primaryNote && <span className="font-normal text-xs text-text-secondary">{r.primaryNote}</span>}
                </td>
                <td className={cn('py-2.5 px-3.5 text-text-secondary tnum', r.emphasis && 'font-semibold')}>
                  {r.comparison} {r.comparisonNote && <span className="font-normal text-xs text-text-tertiary">{r.comparisonNote}</span>}
                </td>
                <td className={cn('py-2.5 px-3.5 text-right tnum', r.emphasis ? 'font-extrabold' : 'font-bold', deltaTone[r.deltaTone ?? 'positive'])}>{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.retention && (
        <div className="border border-border-strong rounded p-3.5 bg-surface-canvas space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-label-sm text-label-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
              <Icon name="stacked_line_chart" className="text-[16px] text-primary" />
              {t.retention.title}
            </span>
            <span className="font-label-sm text-label-sm text-text-secondary font-semibold">{t.retention.headline}</span>
          </div>
          <div className="w-full bg-border-strong h-2.5 rounded-full overflow-hidden flex" role="img" aria-label={t.retention.segments.map((s) => s.title).join('; ')}>
            {t.retention.segments.map((s) => (
              <div key={s.title} className={cn('h-full', segTone[s.tone])} style={{ width: `${s.width}%` }} title={s.title} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-body-sm text-body-sm text-text-secondary">
            {t.retention.notes.map((n) => (
              <div key={n.range} className="flex items-start gap-2 bg-surface-card p-2 rounded border border-border-strong">
                <span className="font-bold text-text-primary whitespace-nowrap">{n.range}</span>
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

const factorTone = { amber: 'bg-amber-100 text-on-primary-container', blue: 'bg-blue-100 text-tertiary', emerald: 'bg-emerald-100 text-status-active' } as const;

/** 2. AI reasoning & diagnostic breakdown. */
export function ReasoningSection({ reasoning }: { reasoning: InsightReasoning }) {
  return (
    <SectionShell
      title="2. AI Reasoning & Diagnostic Breakdown"
      subtitle="Multi-factor causal decomposition of Instagram audience response signals."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-ai-subtle border border-ai-border text-ai-accent font-bold">
          <Icon name="psychology" filled className="text-[13px]" />
          AI INTERPRETATION &amp; CAUSAL ANALYSIS
        </span>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reasoning.factors.map((f) => (
          <div key={f.title} className="bg-surface-canvas border border-border-strong rounded p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded', factorTone[f.tone])}>
                <Icon name={f.icon} className="text-[18px]" />
              </div>
              <h3 className="font-label-md text-label-md font-bold text-text-primary">{f.title}</h3>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary leading-relaxed">
              <RichText text={f.text} />
            </p>
          </div>
        ))}
      </div>
      <div className="p-3 bg-ai-subtle/60 border border-ai-border/80 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ai-accent font-body-sm text-body-sm">
        <div className="flex items-start gap-2">
          <Icon name="verified_user" className="text-[18px]" />
          <span>
            <strong className="font-semibold">Confidence Formulation:</strong> {reasoning.confidenceNote}
          </span>
        </div>
        <span className="font-mono text-xs font-bold whitespace-nowrap bg-surface-card px-2 py-0.5 rounded border border-ai-border self-start sm:self-auto">{reasoning.errorMargin}</span>
      </div>
    </SectionShell>
  );
}

const tagTone = {
  ai: 'px-2 py-0.5 rounded text-label-sm font-label-sm bg-ai-subtle border border-ai-border text-ai-accent font-semibold',
  positive: 'font-label-sm text-label-sm text-status-active font-bold',
  primary: 'font-label-sm text-label-sm text-primary font-bold',
} as const;

/** 3. Evidence-based next best actions with checkable steps (progress stored in the insights store). */
export function ActionPlanSection({ insight, busy, onToggleStep }: { insight: Insight; busy: boolean; onToggleStep: (stepId: string) => void }) {
  const steps = insight.detail?.steps ?? [];
  const done = steps.filter((s) => insight.completedStepIds.includes(s.id)).length;
  return (
    <SectionShell
      title="3. Evidence-Based Next Best Actions (Recommended Plan)"
      subtitle="Optimized tactical playbooks recommended by content intelligence models. Check steps off as your team completes them."
      badge={
        <span className="font-label-sm text-label-sm text-text-tertiary">
          {done}/{steps.length} completed · {steps.length} Actions Generated
        </span>
      }
    >
      <ol className="space-y-3">
        {steps.map((s, idx) => {
          const checked = insight.completedStepIds.includes(s.id);
          return (
            <li key={s.id} className={cn('border border-border-strong rounded p-3.5 bg-surface-canvas hover:border-border-focused transition-colors flex items-start gap-3', checked && 'bg-status-active-subtle/50')}>
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5', checked ? 'bg-status-active text-white' : 'bg-text-primary text-white')}>
                {checked ? <Icon name="check" className="text-[14px]" /> : idx + 1}
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn('font-label-md text-label-md font-bold text-text-primary', checked && 'line-through decoration-text-tertiary')}>{s.title}</span>
                  <span className={tagTone[s.tagTone]}>{s.tag}</span>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary">{s.description}</p>
              </div>
              <div className={cn('shrink-0 pt-1', busy && 'pointer-events-none opacity-60')}>
                <Checkbox checked={checked} onChange={() => onToggleStep(s.id)} label={`Mark step ${idx + 1} as ${checked ? 'not done' : 'done'}`} />
              </div>
            </li>
          );
        })}
      </ol>
      {insight.detail?.quickLinks && (
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {insight.detail.quickLinks.map((l) => (
            <Link
              key={l.to + l.label}
              to={l.to}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 font-label-md text-label-md rounded transition-colors',
                l.primary ? 'bg-primary-container hover:bg-brand-primary-hover text-text-primary font-bold shadow-sm' : 'bg-surface-canvas border border-border-strong hover:bg-surface-card text-text-primary font-semibold',
              )}
            >
              <span>{l.label}</span>
              <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          ))}
        </div>
      )}
      <p className="text-label-code font-label-code text-text-tertiary flex items-center gap-1">
        <Icon name="info" className="text-[12px]" /> Steps are executed by your team. InstaBoard does not publish content, change budgets or modify campaigns.
      </p>
    </SectionShell>
  );
}
