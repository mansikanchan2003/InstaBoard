import type { ReactNode } from 'react';
import { NotFoundError } from '@/lib/api/source';
import { cn } from '@/lib/format';
import type { QueryResult } from '@/hooks/useQuery';
import { Button } from './Button';
import { Icon } from './Icon';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-border-strong/70 rounded-lg animate-pulse', className)} aria-hidden />;
}

/** Generic page skeleton mirroring the export's "Skeleton Shimmer" state. */
export function PageSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-16" />
      <div className={cn('grid gap-4 grid-cols-2', kpis >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
        {Array.from({ length: kpis }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-64" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6 bg-surface-card border border-dashed border-border-strong rounded-lg', className)}>
      <div className="w-12 h-12 rounded-full bg-surface-card-subtle flex items-center justify-center mb-3">
        <Icon name={icon} className="text-[26px] text-text-tertiary" />
      </div>
      <h3 className="font-headline-sm text-headline-sm text-text-primary">{title}</h3>
      {description && <p className="text-body-sm text-text-secondary mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load data',
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: Error;
  onRetry?: () => void;
  className?: string;
}) {
  const notFound = error instanceof NotFoundError;
  return (
    <div className={cn('bg-error-container/50 border border-error/20 p-4 rounded-lg flex items-start gap-3', className)} role="alert">
      <Icon name={notFound ? 'search_off' : 'warning'} className="text-error text-[24px]" />
      <div className="flex-1">
        <h4 className="font-bold text-text-primary text-body-md">{notFound ? 'Not found' : title}</h4>
        <p className="text-body-sm text-text-secondary mt-0.5">{error?.message ?? 'Something went wrong while loading this view.'}</p>
      </div>
      {onRetry && !notFound && (
        <Button size="xs" onClick={onRetry} icon="refresh">
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Renders the right state for a query: skeleton → error → empty → content.
 * Pages pass custom `loading` / `empty` nodes to match each screen's designed states.
 */
export function QueryState<T>({
  query,
  loading,
  empty,
  error,
  children,
}: {
  query: QueryResult<T>;
  loading?: ReactNode;
  empty?: ReactNode;
  error?: (err: Error | undefined, retry: () => void) => ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.status === 'loading') return <>{loading ?? <PageSkeleton />}</>;
  if (query.status === 'error') return <>{error ? error(query.error, query.refetch) : <ErrorState error={query.error} onRetry={query.refetch} />}</>;
  if (query.status === 'empty' || query.data === undefined)
    return <>{empty ?? <EmptyState title="Nothing here yet" description="There is no data for the selected filters." />}</>;
  return <>{children(query.data)}</>;
}
