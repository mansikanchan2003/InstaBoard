import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import { contentService } from '@/services/content';
import type { ContentItem } from '@/types/domain';
import { ContentQuickViewDrawer } from './ContentQuickViewDrawer';
import { contentMediaLabel, contentTypeIcon, topContentByViews } from './selectors';

/** Top Performing Content: the three highest-viewed items; a card opens the quick-view drawer. */
export function TopContent() {
  const content = useQuery('content:list', contentService.list);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const top = useMemo(() => (content.data ? topContentByViews(content.data) : []), [content.data]);
  const selected = top.find((c) => c.id === selectedId) ?? null;

  return (
    <section className="lg:col-span-2 bg-surface-card border border-border-strong rounded-lg p-5 min-w-0" aria-labelledby="dash-content-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 id="dash-content-title" className="font-headline-sm text-headline-sm text-text-primary">
            Top Performing Content
          </h3>
          <p className="text-body-sm text-text-secondary">Content ranked by views, with attributed agent inquiries</p>
        </div>
        <Link to="/content" className="text-label-md text-text-primary hover:text-primary-container font-semibold shrink-0">
          View Library →
        </Link>
      </div>
      <QueryState
        query={content}
        loading={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        }
        empty={<p className="text-body-sm text-text-secondary py-8 text-center border border-dashed border-border-strong rounded-lg">No content published in this period.</p>}
      >
        {() => (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {top.map((item) => (
              <ContentCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
            ))}
          </div>
        )}
      </QueryState>
      <ContentQuickViewDrawer item={selected} onClose={() => setSelectedId(null)} />
    </section>
  );
}

function ContentCard({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-surface-canvas border border-border-strong rounded-lg p-3 cursor-pointer hover:border-primary-container transition-all group focus-visible:outline-2 focus-visible:outline-text-primary"
      aria-label={`Quick view: ${item.title}`}
    >
      <div className="relative h-32 rounded bg-slate-200 overflow-hidden mb-2.5 flex items-center justify-center">
        <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
        <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
          <Icon name={contentTypeIcon(item.type)} className="text-[12px]" /> {contentMediaLabel(item)}
        </span>
        <span className="absolute bottom-2 right-2 bg-primary-container text-text-primary text-[10px] font-bold px-1.5 py-0.5 rounded tnum">
          {formatNumber(item.metrics.leads)} Leads
        </span>
      </div>
      <h4 className="font-bold text-xs text-text-primary line-clamp-1 group-hover:text-primary-container">{item.title}</h4>
      <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary mt-1.5 pt-1.5 border-t border-border-strong">
        <span className="tnum">{formatCompact(item.metrics.views)} Views</span>
        {item.metrics.retention !== undefined ? (
          <span className="text-status-active font-semibold tnum">{formatPercent(item.metrics.retention, 1)} Avg. Retention</span>
        ) : (
          <span className="text-status-active font-semibold tnum">{formatPercent(item.metrics.engagementRate, 1)} Eng.</span>
        )}
      </div>
    </button>
  );
}
