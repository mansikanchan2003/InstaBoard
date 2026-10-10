import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SegmentedControl } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import type { QueryStatus } from '@/hooks/useQuery';
import { cn, formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { ContentItem } from '@/types/domain';
import { contentTypeMeta, ratio } from '../contentMeta';

export type RankMetric = 'views' | 'engagement' | 'leads';

const rankOptions: Array<{ value: RankMetric; label: string }> = [
  { value: 'views', label: 'Views' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
];

const rankValue = (c: ContentItem, m: RankMetric) => (m === 'views' ? c.metrics.views : m === 'leads' ? c.metrics.leads : c.metrics.engagementRate);

/** Ranking widget (top 4 creatives by the selected metric) from the canonical content list. */
export function TopCreativesCard({
  content,
  status,
  onViewAll,
}: {
  content: ContentItem[] | undefined;
  status: QueryStatus;
  onViewAll: (metric: RankMetric) => void;
}) {
  const [metric, setMetric] = useState<RankMetric>('views');
  const ranked = content ? [...content].sort((a, b) => rankValue(b, metric) - rankValue(a, metric)).slice(0, 4) : undefined;
  const totalLeads = content?.reduce((s, c) => s + c.metrics.leads, 0) ?? 0;
  const reelLeads = content?.filter((c) => c.type === 'reel').reduce((s, c) => s + c.metrics.leads, 0) ?? 0;

  return (
    <div className="lg:col-span-4 bg-surface-card border border-border-strong rounded-lg p-5 flex flex-col justify-between shadow-xs">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">Top Performing Creatives</h3>
            <span className="font-body-sm text-body-sm text-text-secondary">Ranked by {rankOptions.find((o) => o.value === metric)?.label.toLowerCase()}</span>
          </div>
          <Icon name="military_tech" className="text-text-tertiary" />
        </div>
        <SegmentedControl ariaLabel="Rank creatives by" options={rankOptions} value={metric} onChange={setMetric} size="xs" className="my-3 w-full [&>button]:flex-1 [&>button]:justify-center" />
        {status === 'error' || status === 'empty' ? (
          <p className="py-8 text-center text-body-sm text-text-secondary">
            {status === 'error' ? 'Unable to load creatives right now.' : 'No creatives published in this period.'}
          </p>
        ) : !ranked ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-border-subtle">
            {ranked.map((c, i) => {
              const meta = contentTypeMeta[c.type];
              return (
                <li key={c.id}>
                  <Link to={`/content/${c.id}`} className="py-2.5 flex items-center justify-between gap-3 hover:bg-surface-canvas px-1 rounded transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          'w-5 h-5 rounded-full font-bold text-label-code flex items-center justify-center shrink-0',
                          i === 0 ? 'bg-primary-container text-text-primary' : 'bg-surface-card-subtle text-text-secondary',
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-label-md text-label-md font-semibold text-text-primary truncate">{c.title}</span>
                          {i === 0 && <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1 rounded shrink-0">TOP</span>}
                        </div>
                        <span className="text-label-sm font-label-sm text-text-secondary flex items-center gap-1">
                          <Icon name={meta.icon} className="text-[13px]" /> {meta.label} • {formatPercent(c.metrics.engagementRate)} Eng
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-headline-sm text-headline-sm font-bold text-text-primary tnum">
                        {metric === 'engagement' ? formatPercent(c.metrics.engagementRate) : metric === 'leads' ? formatNumber(c.metrics.leads) : formatCompact(c.metrics.views)}
                      </div>
                      <div className="text-label-code text-status-active font-semibold tnum">
                        {metric === 'views' ? `${c.metrics.leads} Leads` : `${formatCompact(c.metrics.views)} Views`}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between gap-2 text-label-sm font-label-sm">
        <span className="text-text-secondary">
          Reels drive <strong className="text-text-primary tnum">{content ? `${Math.round(ratio(reelLeads, totalLeads))}%` : '—'}</strong> of content leads
        </span>
        <button type="button" onClick={() => onViewAll(metric)} className="text-primary hover:text-brand-primary-hover font-semibold flex items-center gap-0.5 shrink-0">
          View all <Icon name="arrow_forward" className="text-[14px]" />
        </button>
      </div>
    </div>
  );
}
