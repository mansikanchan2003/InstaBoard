import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cn, formatPercent } from '@/lib/format';
import { rankOf, type AnalyticsPageData } from './model';
import { UnavailableSection } from './SectionCard';

const toneCls = { positive: 'text-emerald-700', neutral: 'text-text-primary', primary: 'text-primary' } as const;

/** "Comprehensive Content Performance Audit" with score tiles and the editorial recommendation. */
export function PerformanceAuditCard({ data }: { data: AnalyticsPageData }) {
  const toast = useToast();
  const audit = data.analytics?.audit;
  if (!audit) return <UnavailableSection title="Comprehensive Content Performance Audit" className="mb-8" />;
  const { item, allContent } = data;

  const derived = (d: 'engagementRate' | 'leadsRank' | undefined) =>
    d === 'engagementRate'
      ? { detail: `(${formatPercent(item.metrics.engagementRate)})` }
      : d === 'leadsRank'
        ? { footnote: `${item.metrics.leads} leads (Rank #${rankOf(item, allContent, 'leads')})` }
        : {};

  return (
    <section className="bg-surface-card rounded-lg border border-ai-border p-5 mb-8 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-32 bg-ai-subtle rounded-bl-full pointer-events-none" />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-border-strong">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-ai-subtle border border-ai-border text-ai-accent flex items-center justify-center shrink-0">
              <Icon name="auto_awesome" filled />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-headline-sm font-headline-sm text-text-primary">Comprehensive Content Performance Audit</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ai-subtle text-ai-accent text-label-code font-label-code border border-ai-border uppercase font-bold tracking-wider">
                  AI-GENERATED INSIGHT
                </span>
              </div>
              <div className="text-body-sm font-body-sm text-text-secondary">{audit.benchmarkNote}</div>
            </div>
          </div>
          <div className="text-label-sm font-label-sm text-text-secondary">
            Analysis Confidence Score: <strong className="text-text-primary">{audit.confidencePct}%</strong>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {audit.scores.map((s) => {
            const d = derived(s.derive);
            const detail = d.detail ?? s.detail;
            return (
              <div key={s.label} className="p-3 bg-surface-canvas rounded border border-border-strong">
                <div className="text-label-sm font-label-sm text-text-secondary mb-1">{s.label}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn('text-headline-sm font-headline-sm font-bold', toneCls[s.tone])}>{s.value}</span>
                  {detail && <span className={cn('text-label-sm font-label-sm font-semibold', s.tone === 'positive' ? 'text-emerald-700' : 'text-text-secondary')}>{detail}</span>}
                </div>
                <div className={cn('text-label-code font-label-code mt-1', d.footnote ? 'text-text-primary font-semibold' : 'text-text-tertiary')}>{d.footnote ?? s.footnote}</div>
              </div>
            );
          })}
        </div>
        <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-lg flex flex-col sm:flex-row items-start gap-3.5">
          <Icon name="lightbulb" className="text-primary mt-0.5" />
          <div className="flex-1">
            <div className="text-label-md font-label-md font-bold text-text-primary mb-1">{audit.recommendation.title}</div>
            <p className="text-body-sm font-body-sm text-text-secondary leading-relaxed">{audit.recommendation.body}</p>
            <ol className="mt-2 space-y-0.5 text-body-sm list-decimal list-inside text-text-primary font-semibold">
              {audit.recommendation.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={() =>
              toast({ tone: 'demo', title: 'Script drafting needs the backend', description: 'AI script generation runs on the InstaBoard backend, which is not connected in this prototype.' })
            }
            className="px-3 py-1.5 bg-primary-container hover:bg-brand-primary-hover text-text-primary font-bold text-label-sm font-label-sm rounded shrink-0 shadow-sm transition-colors"
          >
            Generate Script Draft
          </button>
        </div>
      </div>
    </section>
  );
}

/** Bottom contextual navigation. */
export function ReelFooterNav({ data }: { data: AnalyticsPageData }) {
  const { campaign, item } = data;
  const linkCls = 'text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1';
  return (
    <footer className="mt-8 pt-5 pb-10 border-t border-border-strong flex flex-col md:flex-row items-center justify-between gap-4 text-label-md font-label-md text-text-secondary">
      <Link to="/content" className="inline-flex items-center gap-2 hover:text-text-primary transition-colors font-medium">
        <Icon name="arrow_back" className="text-[14px]" />
        <span>Back to Content Library</span>
      </Link>
      <div className="flex flex-wrap items-center justify-center gap-4 text-label-sm font-label-sm">
        {campaign && (
          <>
            <Link to={`/campaigns/${campaign.id}`} className={linkCls}>
              <span>View Campaign ({campaign.name.replace(/ Campaign$/, '')})</span>
              <Icon name="arrow_forward" className="text-[12px]" />
            </Link>
            <span className="text-border-strong hidden sm:inline">|</span>
          </>
        )}
        <Link to="/audience" className={linkCls}>
          <span>View Audience Insights</span>
          <Icon name="arrow_forward" className="text-[12px]" />
        </Link>
        <span className="text-border-strong hidden sm:inline">|</span>
        <Link to="/comments" className={linkCls}>
          <span>View Comments Intelligence</span>
          <Icon name="arrow_forward" className="text-[12px]" />
        </Link>
        <span className="text-border-strong hidden sm:inline">|</span>
        <Link to="/leads" className="text-primary hover:underline transition-colors flex items-center gap-1 font-semibold">
          <span>View Leads Pipeline ({item.metrics.leads})</span>
          <Icon name="arrow_forward" className="text-[12px]" />
        </Link>
      </div>
    </footer>
  );
}
