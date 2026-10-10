import type { ContentItem, ContentType } from '@/types/domain';

/** Display metadata per content format (badge colours copied from the Content Library export). */
export const contentTypeMeta: Record<ContentType, { label: string; plural: string; icon: string; badge: string }> = {
  reel: { label: 'Reel', plural: 'Reels', icon: 'movie', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  post: { label: 'Post', plural: 'Posts', icon: 'image', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  carousel: { label: 'Carousel', plural: 'Carousels', icon: 'photo_library', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  story: { label: 'Story', plural: 'Stories', icon: 'amp_stories', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const contentTypeOrder: ContentType[] = ['reel', 'post', 'carousel', 'story'];

/** Video formats have watch time / retention; images and carousels do not. */
export const isVideo = (item: Pick<ContentItem, 'type'>) => item.type === 'reel' || item.type === 'story';

/** 18 -> "0:18", 75 -> "1:15". */
export function formatDuration(sec: number | undefined): string {
  if (sec === undefined) return '—';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Small overlay label on thumbnails: duration for video, slide count for carousels. */
export function thumbnailLabel(item: ContentItem): string {
  if (item.type === 'carousel') return `${item.slides ?? 0} slides`;
  if (item.type === 'post') return 'Image';
  return formatDuration(item.durationSec);
}

/** Percentage helper that tolerates zero denominators. */
export const ratio = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

/** Long caption -> first ~60 chars with an ellipsis (table excerpt). */
export function captionExcerpt(caption: string, max = 60): string {
  return caption.length > max ? `${caption.slice(0, max).trimEnd()}...` : caption;
}
