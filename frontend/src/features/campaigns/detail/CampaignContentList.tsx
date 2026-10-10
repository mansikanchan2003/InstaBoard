import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { cn, formatCompact, formatDate } from '@/lib/format';
import type { Campaign, ContentItem } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

const formatLabel: Record<ContentItem['type'], string> = { reel: 'Reel Format', carousel: 'Carousel Post', post: 'Image Post', story: 'Story' };

const duration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function MediaBadge({ item }: { item: ContentItem }) {
  const video = item.type === 'reel' || item.type === 'story';
  const icon = video ? 'play_arrow' : item.type === 'carousel' ? 'view_carousel' : 'image';
  const text = video ? (item.durationSec ? duration(item.durationSec) : '') : item.type === 'carousel' ? String(item.slides ?? '') : '1';
  return (
    <span className="absolute bottom-1 right-1 bg-black/75 text-white font-label-code text-label-code px-1 py-0.5 rounded flex items-center">
      <Icon name={icon} filled={video} className="text-[10px] mr-0.5" />
      {text}
    </span>
  );
}

/** Export: "CAMPAIGN CONTENT & TOP PERFORMING CONTENT" list. Rows link to the Reel / Content analytics page. */
export function CampaignContentList({ campaign, query }: { campaign: Campaign; query: QueryResult<ContentItem[]> }) {
  const items = [...(query.data ?? [])].sort((a, b) => b.metrics.views - a.metrics.views);
  return (
    <SectionCard
      icon="movie"
      title="Campaign Content"
      addon={
        query.status === 'success' && (
          <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-card-subtle text-text-secondary border border-border-strong">
            {items.length} creative{items.length === 1 ? '' : 's'}
          </span>
        )
      }
      link={{ to: '/content', label: 'View All Content' }}
    >
      {query.status === 'loading' ? (
        <div className="divide-y divide-border-strong">
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-4 flex gap-3">
              <Skeleton className="w-16 h-20" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : query.status === 'error' ? (
        <UnavailableNote icon="warning">Content could not be loaded. {query.error?.message}</UnavailableNote>
      ) : items.length === 0 ? (
        <UnavailableNote icon="movie">
          {campaign.metrics
            ? 'No individual creatives for this campaign are included in the demo dataset.'
            : `No content is linked yet. Posts using ${campaign.hashtags.length ? campaign.hashtags.join(' ') : "the campaign's tracking hashtags"} will appear here once the campaign is live.`}
        </UnavailableNote>
      ) : (
        <div className="divide-y divide-border-strong">
          {items.map((item) => {
            const isReel = item.type === 'reel' || item.type === 'story';
            return (
              <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Link to={`/content/${item.id}`} className="relative w-16 h-20 rounded bg-slate-100 overflow-hidden shrink-0 border border-border-strong" aria-label={`Open ${item.title}`}>
                    <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
                    <MediaBadge item={item} />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/content/${item.id}`} className="font-headline-sm text-headline-sm text-text-primary font-bold hover:text-primary transition-colors">
                        {item.title}
                      </Link>
                      {item.isTopPerformer && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-primary-container/20 text-[#644000] border border-amber-300 font-bold">
                          <Icon name="star" filled className="text-[12px]" />
                          Top Performer
                        </span>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                      Published {formatDate(item.publishedAt)} · {formatLabel[item.type]}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-text-tertiary font-label-sm text-label-sm flex-wrap">
                      <span className="text-text-primary font-semibold tnum">
                        {formatCompact(item.metrics.views)} <span className="text-text-secondary font-normal">Views</span>
                      </span>
                      <span>•</span>
                      <span className="text-text-primary font-semibold tnum">
                        {formatCompact(item.metrics.reach)} <span className="text-text-secondary font-normal">Reach</span>
                      </span>
                      <span>•</span>
                      <span className="text-text-primary font-semibold tnum">
                        {item.metrics.engagementRate}% <span className="text-text-secondary font-normal">Eng.</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border-subtle shrink-0">
                  <div className="text-right">
                    <span className="font-metric-stat-sm text-metric-stat-sm text-text-primary font-bold tnum">{item.metrics.leads}</span>
                    <span className={cn('block font-label-sm text-label-sm', item.isTopPerformer ? 'text-primary font-semibold' : 'text-text-secondary font-medium')}>Leads Gen.</span>
                  </div>
                  <Link to={`/content/${item.id}`} className="font-label-md text-label-md text-text-primary hover:text-primary font-semibold flex items-center gap-1">
                    {isReel ? 'Reel Detail' : 'Post Detail'} <Icon name="chevron_right" className="text-[14px]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
