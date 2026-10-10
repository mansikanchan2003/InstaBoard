import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { cn, formatNumber } from '@/lib/format';
import type { InsightTone, TimelineSegmentTone } from '@/types/content';
import { contentTypeMeta, isVideo } from '../contentMeta';
import { watchHours, type AnalyticsPageData } from './model';
import { RetentionChart } from './RetentionChart';

const segmentCls: Record<TimelineSegmentTone, { box: string; label: string }> = {
  neutral: { box: 'bg-surface-canvas border-border-strong text-text-secondary', label: 'text-text-primary' },
  drop: { box: 'bg-rose-50 border-rose-200 text-rose-800', label: '' },
  cta: { box: 'bg-sky-50 border-sky-200 text-sky-800', label: '' },
};

const insightCls: Record<InsightTone, { head: string; tag: string; icon: string }> = {
  positive: { head: 'text-emerald-700', tag: 'text-emerald-700 bg-emerald-50', icon: 'check_circle' },
  warning: { head: 'text-amber-700', tag: 'text-amber-700 bg-amber-50', icon: 'warning' },
  info: { head: 'text-blue-700', tag: 'text-blue-700 bg-blue-50', icon: 'verified' },
};

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-border-strong pb-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-headline-md font-headline-md text-text-primary">Watch Time &amp; Retention Analytics</h2>
          <span className="text-label-code font-label-code bg-surface-canvas text-text-secondary border border-border-strong px-2 py-0.5 rounded">Frame-by-Frame</span>
        </div>
        <p className="text-body-sm font-body-sm text-text-secondary mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4 text-label-sm font-label-sm">
        <div className="flex items-center gap-1.5 text-text-secondary">
          <span className="w-3 h-3 rounded-sm bg-primary-container" />
          <span>Audience Retention %</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <span className="w-3 h-0 border-t-2 border-dashed border-text-tertiary" />
          <span>Benchmark (Fintech Avg)</span>
        </div>
      </div>
    </div>
  );
}

/** Watch time stats, retention curve, timeline segments and AI retention diagnostics (video only). */
export function WatchRetentionSection({ data }: { data: AnalyticsPageData }) {
  const { item, analytics } = data;
  const watch = analytics?.watch;

  if (!isVideo(item)) {
    return (
      <section className="bg-surface-card rounded-lg border border-border-strong p-5 mb-6 shadow-sm">
        <Header subtitle="Audience attention duration curve plotted against video timeline milestones." />
        <Notice tone="info" title={`Not applicable to ${contentTypeMeta[item.type].plural.toLowerCase()}`}>
          Watch time and retention are measured for Reels and video Stories only. {contentTypeMeta[item.type].label} performance is covered by reach, saves, shares and
          engagement above.
        </Notice>
      </section>
    );
  }

  if (!watch || !item.durationSec) {
    return (
      <section className="bg-surface-card rounded-lg border border-border-strong p-5 mb-6 shadow-sm">
        <Header subtitle="Audience attention duration curve plotted against video timeline milestones." />
        <Notice tone="demo" title="Detailed analytics not available in the demo dataset">
          No frame-level retention data exists for this {contentTypeMeta[item.type].label.toLowerCase()}.
          {item.metrics.retention !== undefined && ` Its canonical completion rate is ${item.metrics.retention}%.`}
        </Notice>
      </section>
    );
  }

  const duration = item.durationSec;
  const completion = watch.retention[watch.retention.length - 1].retention;
  const hours = watchHours(item.metrics.views, watch.avgWatchSec);

  return (
    <section className="bg-surface-card rounded-lg border border-border-strong p-5 mb-6 shadow-sm">
      <Header subtitle="Audience attention duration curve plotted against video timeline milestones." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-3 bg-surface-canvas rounded-lg border border-border-strong">
        <div>
          <div className="text-label-sm font-label-sm text-text-secondary">Total Watch Time</div>
          <div className="text-metric-stat-sm font-metric-stat-sm text-text-primary tnum font-bold mt-0.5">{formatNumber(Math.round(hours))} hrs</div>
          <div className="text-label-code font-label-code text-text-tertiary mt-0.5">Equivalent to {(hours / 24).toFixed(1)} days</div>
        </div>
        <div>
          <div className="text-label-sm font-label-sm text-text-secondary">Average Watch Time</div>
          <div className="text-metric-stat-sm font-metric-stat-sm text-text-primary tnum font-bold mt-0.5">{watch.avgWatchSec.toFixed(1)} sec</div>
          <div className="text-label-code font-label-code text-emerald-700 font-semibold mt-0.5">{watch.avgWatchNote}</div>
        </div>
        <div>
          <div className="text-label-sm font-label-sm text-text-secondary">Completion Rate</div>
          <div className="text-metric-stat-sm font-metric-stat-sm text-primary tnum font-bold mt-0.5">{completion}%</div>
          <div className="text-label-code font-label-code text-emerald-700 font-semibold mt-0.5">{watch.completionNote}</div>
        </div>
        <div>
          <div className="text-label-sm font-label-sm text-text-secondary">Video Length</div>
          <div className="text-metric-stat-sm font-metric-stat-sm text-text-primary tnum font-bold mt-0.5">{duration.toFixed(1)} sec</div>
          <div className="text-label-code font-label-code text-text-tertiary mt-0.5">{watch.lengthNote}</div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden mb-6 bg-white border border-border-strong rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-label-sm font-label-sm text-text-secondary">
          <span className="font-semibold text-text-primary">Viewer Retention Drop-off Curve (0s – {duration}s)</span>
          <span className="text-text-tertiary">Hover the curve for second-by-second values</span>
        </div>
        <RetentionChart watch={watch} durationSec={duration} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-2 pt-2 border-t border-border-strong text-label-code font-label-code text-text-secondary">
          {watch.segments.map((s) => (
            <div key={s.start} className={cn('p-1 rounded border text-center', segmentCls[s.tone].box)}>
              <span className={cn('font-bold', segmentCls[s.tone].label)}>
                {s.start}s - {s.end}s:
              </span>{' '}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-ai-subtle border border-ai-border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-ai-accent text-label-code font-label-code border border-ai-border uppercase font-bold tracking-wider">
              <Icon name="auto_awesome" className="text-[12px]" />
              AI-GENERATED INSIGHT
            </span>
            <span className="text-label-md font-label-md font-bold text-text-primary">Retention Diagnostics &amp; Pacing Optimization</span>
          </div>
          <span className="text-label-sm font-label-sm text-text-secondary">Confidence: {watch.confidencePct}%</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {watch.insights.map((ins) => {
            const t = insightCls[ins.tone];
            return (
              <div key={ins.title} className="bg-white p-3 rounded border border-ai-border flex flex-col justify-between">
                <div>
                  <div className={cn('flex items-center gap-1.5 text-label-sm font-label-sm font-bold mb-1', t.head)}>
                    <Icon name={t.icon} className="text-[14px]" />
                    <span>{ins.title}</span>
                  </div>
                  <p className="text-body-sm font-body-sm text-text-secondary">{ins.body}</p>
                </div>
                <div className={cn('mt-2 text-label-code font-label-code px-2 py-1 rounded w-fit', t.tag)}>{ins.tag}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
