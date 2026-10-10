import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiBadge } from '@/components/ui/Badge';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { formatNumber } from '@/lib/format';
import type { InsightsOverview, RecommendedAction } from '@/types/insights';
import { RichText, stripMarkup } from './insightMeta';

function Tile({ label, badge, value, sub, footLabel, footValue }: { label: string; badge: ReactNode; value: ReactNode; sub: ReactNode; footLabel: string; footValue: ReactNode }) {
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl p-4 flex flex-col justify-between hover:border-secondary transition-colors min-w-0">
      <div className="flex items-start justify-between gap-2 text-text-secondary">
        <span className="text-label-sm font-label-sm font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
        {badge}
      </div>
      <div className="my-3">
        <div className="text-metric-stat-sm md:text-metric-stat-lg font-metric-stat-lg text-text-primary font-bold tracking-tight tnum">{value}</div>
        <div className="text-body-sm font-body-sm text-text-secondary mt-0.5 truncate">{sub}</div>
      </div>
      <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-2 text-label-sm font-label-sm text-text-tertiary">
        <span>{footLabel}</span>
        {footValue}
      </div>
    </div>
  );
}

const tag = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-label-code font-label-code font-semibold whitespace-nowrap';

/** KPI summary cards (4 tiles bento). Action counts are derived from the recommended-actions store. */
export function InsightKpiTiles({ overview, actions }: { overview: InsightsOverview; actions: RecommendedAction[] }) {
  const open = actions.filter((a) => a.status === 'pending_review' || a.status === 'reviewed');
  const high = open.filter((a) => a.priority === 'high').length;
  const medium = open.filter((a) => a.priority === 'medium').length;
  const k = overview.kpis;
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Tile
        label="Action Items"
        badge={<span className={`${tag} bg-error-container text-on-error-container`}>{high} High Priority</span>}
        value={`${open.length} Pending`}
        sub={`${high} High, ${medium} Medium urgency`}
        footLabel="Resolution pace"
        footValue={<span className="text-text-primary font-semibold">{k.resolutionPaceLabel}</span>}
      />
      <Tile
        label="Synthesized Campaigns"
        badge={<span className={`${tag} bg-status-active-subtle text-status-active border border-status-active/20`}>Active Cycle</span>}
        value={`${k.synthesizedCampaigns} Analyzed`}
        sub={k.peakCampaignLabel}
        footLabel="Baseline lift"
        footValue={<span className="text-status-active font-semibold">{k.baselineLiftLabel}</span>}
      />
      <Tile
        label="Lead Signals"
        badge={
          <span className={`${tag} bg-ai-subtle text-ai-accent border border-ai-border`}>
            <Icon name="auto_awesome" className="text-[11px]" />
            AI-ESTIMATED
          </span>
        }
        value={`${formatNumber(k.leadSignals)} Inquiries`}
        sub={
          <span className="text-status-active font-medium flex items-center gap-1">
            <Icon name="trending_up" className="text-[15px]" />
            {k.leadSignalsDeltaLabel}
          </span>
        }
        footLabel="Conversion pipeline"
        footValue={<span className="text-text-primary font-semibold">{k.avgCplLabel}</span>}
      />
      <Tile
        label="Model Confidence"
        badge={<span className={`${tag} bg-status-active-subtle text-status-active`}>High Precision</span>}
        value={`${k.modelConfidence}% High`}
        sub={k.modelBasisLabel}
        footLabel="Attribution drift"
        footValue={<span className="text-text-primary font-semibold">{k.attributionDriftLabel}</span>}
      />
    </section>
  );
}

/** "Executive Performance Synthesis" card. */
export function ExecutiveSynthesis({ overview, onRegenerate, topInsightId }: { overview: InsightsOverview; onRegenerate: () => void; topInsightId: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const e = overview.executive;

  const copy = async () => {
    const text = [`Executive Performance Synthesis (${overview.periodLabel}) — AI-generated, demo data`, e.overall, e.positive, e.concern, `Recommended: ${e.recommendation}`].map(stripMarkup).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: 'Synthesis copied to clipboard' });
    } catch {
      toast({ tone: 'error', title: 'Copy failed', description: 'Clipboard access is not available in this browser.' });
    }
  };

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl shadow-xs overflow-hidden">
      <div className="bg-surface-canvas border-b border-border-strong px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
          <h2 className="text-headline-sm font-headline-sm text-text-primary font-bold">Executive Performance Synthesis</h2>
          <AiBadge label="AI-GENERATED SYNTHESIS" />
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-label-code font-label-code bg-surface-card border border-border-strong text-text-secondary font-semibold">{overview.periodLabel}</span>
          <Dropdown
            label="Synthesis options"
            trigger={({ toggle, open }) => (
              <button type="button" onClick={toggle} aria-expanded={open} aria-label="Synthesis options" className="text-text-secondary hover:text-text-primary p-1 rounded">
                <Icon name="more_horiz" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon="content_copy" onClick={() => (close(), copy())}>
                  Copy synthesis text
                </MenuItem>
                <MenuItem icon="auto_awesome" onClick={() => (close(), navigate(`/ai-insights/${topInsightId}`))}>
                  Open top insight
                </MenuItem>
                <MenuItem icon="refresh" onClick={() => (close(), onRegenerate())}>
                  Regenerate analysis
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 divide-y md:divide-y-0 md:divide-x divide-border-strong">
        <div className="space-y-4 pr-0 md:pr-4">
          <div>
            <div className="flex items-center gap-2 text-label-sm font-label-sm font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              <Icon name="insights" filled className="text-primary-container text-[16px]" />
              Overall Performance
            </div>
            <p className="text-body-md font-body-md text-text-primary leading-relaxed bg-surface-card-subtle p-3 rounded-lg border border-border-strong">
              <RichText text={e.overall} />
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-label-sm font-label-sm font-bold text-status-active uppercase tracking-wider mb-1.5">
              <Icon name="check_circle" className="text-status-active text-[16px]" />
              Key Positive Development
            </div>
            <p className="text-body-md font-body-md text-text-secondary leading-relaxed pl-1">
              <RichText text={e.positive} />
            </p>
          </div>
        </div>
        <div className="space-y-4 pt-4 md:pt-0 pl-0 md:pl-5">
          <div>
            <div className="flex items-center gap-2 text-label-sm font-label-sm font-bold text-error uppercase tracking-wider mb-1.5">
              <Icon name="warning" className="text-error text-[16px]" />
              Main Area of Concern
            </div>
            <p className="text-body-md font-body-md text-text-secondary leading-relaxed pl-1">
              <RichText text={e.concern} />
            </p>
          </div>
          <div className="bg-primary-container/10 border border-primary-container/30 rounded-lg p-3.5">
            <div className="flex items-center gap-2 text-label-sm font-label-sm font-bold text-primary uppercase tracking-wider mb-1.5">
              <Icon name="lightbulb" filled className="text-primary-container text-[16px]" />
              Most Important Recommended Action
            </div>
            <p className="text-body-md font-body-md text-text-primary font-medium leading-relaxed">{e.recommendation}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-2.5 border-t border-border-strong bg-surface-canvas flex items-start gap-2 text-body-sm font-body-sm text-text-secondary">
        <Icon name="info" className="text-[16px] mt-px" />
        <span>{overview.disclaimer}</span>
      </div>
    </section>
  );
}
