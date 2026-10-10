import { Link } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { Insight } from '@/types/insights';
import { categoryMeta, priorityMeta } from './insightMeta';

/** Breadcrumbs + "Top Insight Command Header" (back, export, dismiss, review, badges, governance notice). */
export function InsightDetailHeader({
  insight,
  disclaimer,
  busy,
  onExport,
  onDismiss,
  onRestore,
  onToggleReviewed,
}: {
  insight: Insight;
  disclaimer: string;
  busy: boolean;
  onExport: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onToggleReviewed: () => void;
}) {
  const p = priorityMeta[insight.priority];
  const reviewed = insight.status === 'reviewed';
  const dismissed = insight.status === 'dismissed';
  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'AI Insights', to: '/ai-insights' },
          { label: categoryMeta[insight.category].label, to: '/ai-insights' },
          { label: insight.title },
        ]}
        className="font-label-md text-label-md"
      />
      <div className="bg-surface-card border border-border-strong rounded-lg p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/ai-insights" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-label-md text-label-md font-semibold transition-colors">
            <Icon name="arrow_back" className="text-[18px]" />
            <span>Back to AI Insights</span>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Button icon="picture_as_pdf" onClick={onExport} className="rounded font-medium" title="Opens a printable brief — choose 'Save as PDF' in the print dialog">
              Export PDF Brief
            </Button>
            {dismissed ? (
              <Button icon="visibility" onClick={onRestore} disabled={busy} className="rounded font-medium">
                Restore Insight
              </Button>
            ) : (
              <Button variant="danger" icon="visibility_off" onClick={onDismiss} disabled={busy} className="rounded font-medium">
                Dismiss Insight
              </Button>
            )}
            <button
              type="button"
              onClick={onToggleReviewed}
              disabled={busy || dismissed}
              aria-pressed={reviewed}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 border text-text-primary font-label-md text-label-md font-semibold rounded shadow-sm transition-opacity disabled:opacity-50',
                reviewed ? 'bg-status-active border-status-active text-white' : 'bg-status-active-subtle border-status-active hover:opacity-90',
              )}
            >
              <Icon name="check_circle" filled className={cn('text-[18px]', reviewed ? 'text-white' : 'text-status-active')} />
              <span>{reviewed ? 'Reviewed' : 'Mark as Reviewed'}</span>
            </button>
          </div>
        </div>

        {dismissed && (
          <div className="flex items-center gap-2 bg-surface-card-subtle border border-border-strong rounded px-3 py-2 text-body-sm text-text-secondary" role="status">
            <Icon name="visibility_off" className="text-[16px]" />
            This insight is dismissed and hidden from the AI Insights feed. Restore it to bring it back.
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label-sm border', insight.priority === 'high' ? 'bg-red-50 text-error border-red-200' : p.pill)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', p.dot)} />
              {p.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-ai-subtle border border-ai-border text-ai-accent font-semibold">
              <Icon name="auto_awesome" filled className="text-[13px]" />
              AI-CONFIDENCE: {insight.confidence}% {insight.confidence >= 89 ? 'HIGH' : 'MODERATE'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-card-subtle border border-border-strong text-text-secondary uppercase">
              Category: {categoryMeta[insight.category].label}
            </span>
            <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-text-tertiary md:ml-auto">
              <Icon name="schedule" className="text-[14px]" />
              Generated {insight.generatedAt}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary tracking-tight">{insight.title}</h1>
        </div>

        <div className="flex items-start gap-3 bg-surface-canvas border border-border-strong rounded p-3 text-text-secondary">
          <Icon name="info" className="text-[18px] text-text-secondary mt-0.5" />
          <p className="font-body-sm text-body-sm leading-relaxed">
            <span className="font-semibold text-text-primary">Notice:</span> {disclaimer}
          </p>
        </div>
      </div>
    </>
  );
}
