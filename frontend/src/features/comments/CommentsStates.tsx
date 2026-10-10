import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton } from '@/components/ui/States';

/** Export "Skeleton Shimmer" state: shimmering KPI strip + bento + table placeholders. */
export function CommentsSkeleton() {
  return (
    <div className="space-y-4 mt-4" role="status" aria-label="Loading comments">
      <Skeleton className="h-28" />
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Skeleton className="lg:col-span-5 h-96" />
        <Skeleton className="lg:col-span-7 h-96" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Skeleton className="xl:col-span-8 h-[420px]" />
        <Skeleton className="xl:col-span-4 h-[420px]" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Export error banner ("Failed to synchronize comments…") with retry. */
export function CommentsErrorBanner({ error, onRetry }: { error: Error | undefined; onRetry: () => void }) {
  return (
    <div className="my-4 p-4 rounded bg-error-container/20 border border-error text-text-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
      <div className="flex items-center gap-3">
        <Icon name="error_outline" className="text-error text-[22px]" />
        <div>
          <h4 className="font-bold text-body-md font-body-md text-error">Failed to load comments</h4>
          <p className="text-body-sm font-body-sm text-text-secondary">{error?.message ?? 'Something went wrong while loading comment intelligence.'}</p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="px-3 py-1.5 bg-surface-card border border-border-strong text-label-sm font-label-sm font-bold rounded shadow-sm hover:bg-surface-canvas">
        Retry Connection
      </button>
    </div>
  );
}

export function CommentsEmpty({ onReset }: { onReset: () => void }) {
  return (
    <EmptyState
      className="mt-4"
      icon="forum"
      title="0 comments found"
      description="Filter parameters yielded an empty set. Try clearing filters, or connect an account with comment access."
      action={
        <button type="button" onClick={onReset} className="text-primary hover:underline font-semibold text-label-md">
          Reset filters
        </button>
      }
    />
  );
}

/** Small media-query hook (used to swap the inline detail panel for a Drawer below xl). */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
