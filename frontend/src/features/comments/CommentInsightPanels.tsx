import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary } from '@/types/comments';
import type { Campaign, ContentItem } from '@/types/domain';

const barColors = ['bg-primary-container', 'bg-tertiary', 'bg-secondary', 'bg-status-draft', 'bg-text-tertiary'];

/** Section 5 of the export: secondary analytical panels (derived from canonical content + campaign data). */
export function CommentInsightPanels({
  summary,
  content,
  campaigns,
  onStartTriage,
  onQueueBucket,
}: {
  summary: CommentSummary;
  content: ContentItem[];
  campaigns: Campaign[];
  onStartTriage: () => void;
  onQueueBucket: (intent: string) => void;
}) {
  const topContent = [...content].sort((a, b) => b.metrics.comments - a.metrics.comments).slice(0, 3);
  const campaignRows = campaigns
    .filter((c) => (c.metrics?.comments ?? 0) > 0)
    .sort((a, b) => (b.metrics?.comments ?? 0) - (a.metrics?.comments ?? 0));
  const attributed = campaignRows.reduce((s, c) => s + (c.metrics?.comments ?? 0), 0);
  const attributedPct = Math.round((attributed / summary.totalComments) * 100);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const intelTone = { positive: 'text-status-active', primary: 'text-primary', negative: 'text-error' } as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <div className="bg-surface-card border border-border-strong rounded p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-headline-sm font-headline-sm text-text-primary">Top Conversational Content</h3>
            <Icon name="forum" className="text-text-tertiary" />
          </div>
          <ul className="space-y-3">
            {topContent.map((c, i) => (
              <li key={c.id} className={cn('flex items-center justify-between', i < topContent.length - 1 ? 'pb-2 border-b border-border-strong' : 'pb-1')}>
                <div className="min-w-0 pr-2">
                  <Link to={`/content/${c.id}`} className="font-bold text-label-md font-label-md text-text-primary truncate block hover:underline">
                    {i + 1}. {c.title}
                  </Link>
                  <div className="text-label-code font-label-code text-text-secondary tnum">{formatNumber(c.metrics.comments)} comments</div>
                </div>
                <span
                  className={cn(
                    'text-label-code font-label-code px-1.5 py-0.5 rounded font-bold shrink-0 tnum',
                    i < 2 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-card-subtle text-text-primary',
                  )}
                >
                  {c.metrics.leads} LEADS
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Link to="/content" className="pt-3 border-t border-border-strong mt-3 text-label-sm font-label-sm text-primary font-semibold hover:underline block text-center">
          View Content Performance Breakdown →
        </Link>
      </div>

      <div className="bg-surface-card border border-border-strong rounded p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-headline-sm font-headline-sm text-text-primary">Campaign Performance</h3>
            <Icon name="pie_chart" className="text-text-tertiary" />
          </div>
          <ul className="space-y-2.5 text-body-sm font-body-sm">
            {campaignRows.map((c, i) => {
              const n = c.metrics?.comments ?? 0;
              const share = Math.round((n / summary.totalComments) * 100);
              return (
                <li key={c.id}>
                  <div className="flex justify-between gap-2 text-label-sm font-label-sm mb-1">
                    <Link to={`/campaigns/${c.id}`} className={cn('truncate hover:underline', i === 0 ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary')}>
                      {c.name}
                    </Link>
                    <span className={cn('tnum shrink-0', i === 0 ? 'font-bold text-text-primary' : 'font-semibold text-text-secondary')}>
                      {formatNumber(n)} ({share}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-canvas h-1.5 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', barColors[i] ?? 'bg-text-tertiary')} style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="pt-3 border-t border-border-strong mt-3 text-label-sm font-label-sm text-text-secondary flex justify-between">
          <span>Active Campaigns: {activeCampaigns}</span>
          <span className="text-text-primary font-semibold">{attributedPct}% Attributed</span>
        </div>
      </div>

      <div className="bg-surface-card border border-border-strong rounded p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-headline-sm font-headline-sm text-text-primary">Response Queue</h3>
            <span className="px-2 py-0.5 rounded-full text-label-code font-label-code bg-error-container/40 text-error font-bold tnum">{formatNumber(summary.needsResponse)} OPEN</span>
          </div>
          <ul className="space-y-2">
            {summary.responseQueue.map((b) => (
              <li key={b.label}>
                <button
                  type="button"
                  onClick={() => onQueueBucket(b.intent)}
                  className="w-full p-2 rounded bg-surface-canvas border border-border-strong flex items-center justify-between text-left hover:border-primary-container transition-colors"
                >
                  <div>
                    <div className="text-label-sm font-label-sm font-bold text-text-primary">{b.label}</div>
                    <div className="text-label-code font-label-code text-text-secondary">{b.sublabel}</div>
                  </div>
                  <span className={cn('text-label-sm font-label-sm font-bold tnum', b.tone === 'primary' ? 'text-primary' : b.tone === 'ai' ? 'text-ai-accent' : 'text-text-secondary font-semibold')}>
                    {b.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-label-code font-label-code text-text-tertiary">Queue breakdown as of the Oct 31 snapshot.</p>
        </div>
        <button
          type="button"
          onClick={onStartTriage}
          className="w-full mt-3 py-1.5 px-3 bg-surface-card border border-border-strong hover:bg-surface-canvas rounded text-label-sm font-label-sm font-bold text-text-primary flex items-center justify-center gap-1"
        >
          <Icon name="play_arrow" className="text-[16px]" />
          <span>Start Fast Triage Mode</span>
        </button>
      </div>

      <div className="bg-surface-card border border-ai-border rounded p-4 flex flex-col justify-between relative overflow-hidden isolate">
        <div className="absolute top-0 right-0 w-24 h-24 bg-ai-subtle rounded-full blur-xl -z-10 opacity-60" />
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-headline-sm font-headline-sm text-text-primary">
              <Icon name="auto_awesome" className="text-ai-accent" />
              <span>AI Strategic Intel</span>
            </div>
            <span className="text-label-code font-label-code bg-ai-subtle text-ai-accent px-1.5 py-0.5 rounded font-bold uppercase whitespace-nowrap">AI-GENERATED INSIGHT</span>
          </div>
          <ul className="space-y-2 text-body-sm font-body-sm">
            {summary.strategicIntel.map((item) => {
              const [before, after] = item.text.split('{e}');
              return (
                <li key={item.label}>
                  <span className={cn('text-label-code font-label-code font-bold', intelTone[item.tone])}>• {item.label}</span>
                  <p className="text-text-primary text-label-sm font-label-sm mt-0.5">
                    {before}
                    <strong>{item.emphasis}</strong>
                    {after}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="pt-2 border-t border-border-strong mt-2 flex items-center justify-between text-label-code font-label-code text-text-tertiary">
          <span>Confidence: {summary.strategicIntelConfidence}%</span>
          <Link to="/ai-insights/ins-eligibility-response-delay" className="text-ai-accent font-bold hover:underline">
            Generate Action Plan →
          </Link>
        </div>
      </div>
    </div>
  );
}
