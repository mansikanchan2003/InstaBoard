import { Fragment } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatNumber } from '@/lib/format';
import { formatDuration, isVideo } from '../contentMeta';
import { rankOf, type AnalyticsPageData } from './model';

/** Caption with hashtags highlighted like the export. */
function Caption({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#\w+)/g).map((part, i) =>
        part.startsWith('#') ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Left hero panel: 9:14 media preview, caption excerpt, total plays + rank. */
export function ReelPreviewCard({ data }: { data: AnalyticsPageData }) {
  const { item, analytics, account, allContent } = data;
  const toast = useToast();
  const video = isVideo(item);
  const image = analytics?.previewImage ?? (item.thumbnailUrl ? { url: item.thumbnailUrl, alt: item.thumbnailAlt } : undefined);
  const rank = rankOf(item, allContent, 'views');

  return (
    <div className="col-span-12 lg:col-span-4 bg-surface-card rounded-lg border border-border-strong p-4 flex flex-col justify-between shadow-sm">
      <div>
        <div className="relative w-full max-w-sm mx-auto lg:max-w-none aspect-[9/14] rounded-lg overflow-hidden border border-border-strong bg-slate-900 group">
          <ImageWithFallback
            src={image?.url}
            alt={image?.alt ?? item.thumbnailAlt}
            className="w-full h-full transition-transform duration-300 group-hover:scale-105"
            fallbackIcon={video ? 'movie' : 'image'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
            <span className="bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-label-sm font-label-sm flex items-center gap-1">
              {video ? (
                <>
                  <Icon name="play_arrow" filled className="text-[12px] text-primary-container" />
                  {formatDuration(item.durationSec)}s
                </>
              ) : item.type === 'carousel' ? (
                <>
                  <Icon name="photo_library" className="text-[12px]" />
                  {item.slides ?? 0} slides
                </>
              ) : (
                <>
                  <Icon name="image" className="text-[12px]" />
                  Image post
                </>
              )}
            </span>
            {analytics?.resolution && (
              <span className="bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-label-sm font-label-sm flex items-center gap-1">
                <Icon name="hd" className="text-[12px]" />
                {analytics.resolution.split('×')[0]}p
              </span>
            )}
          </div>
          {video && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                aria-label="Play preview"
                onClick={() =>
                  toast({ tone: 'demo', title: 'Playback unavailable', description: 'The demo dataset has preview frames only — no Instagram video file is connected.' })
                }
                className="w-12 h-12 rounded-full bg-white/90 text-text-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
              >
                <Icon name="play_arrow" filled className="text-2xl ml-0.5 text-text-primary" />
              </button>
            </div>
          )}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white pointer-events-none">
            {analytics?.audioLabel && (
              <div className="flex items-center gap-1.5 text-label-sm font-label-sm mb-1 text-slate-200">
                <Icon name="music_note" className="text-[12px]" />
                <span className="truncate">{analytics.audioLabel}</span>
              </div>
            )}
            <div className="text-xs text-white/90 font-medium">
              @{account?.handle ?? 'ekoindia'} • {formatDate(item.publishedAt, { year: false })}
            </div>
          </div>
        </div>
        <div className="mt-3.5">
          <div className="text-label-sm font-label-sm text-text-tertiary uppercase tracking-wider mb-1">Caption Excerpt</div>
          <p className="text-body-sm font-body-sm text-text-primary leading-relaxed bg-surface-canvas p-2.5 rounded border border-border-strong">
            <Caption text={item.caption} />
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border-strong flex flex-wrap items-center justify-between gap-2 text-label-sm font-label-sm text-text-secondary">
        <span className="flex items-center gap-1 tnum">
          <Icon name="visibility" className="text-[12px]" />
          {formatNumber(item.metrics.views)} {video ? 'Total Plays' : 'Total Views'}
        </span>
        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
          <Icon name="trending_up" className="text-[12px]" />
          Rank #{rank} of {allContent.length} by views
        </span>
      </div>
    </div>
  );
}
