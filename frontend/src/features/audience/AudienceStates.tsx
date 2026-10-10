import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

export function AudienceSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading audience data">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function AudienceEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className="p-16 flex flex-col items-center justify-center text-center bg-surface-card border border-dashed border-border-strong rounded-lg">
      <div className="w-16 h-16 rounded-full bg-surface-canvas border border-border-strong flex items-center justify-center mb-4 text-text-tertiary">
        <Icon name="group_off" className="text-[32px]" />
      </div>
      <h3 className="font-headline-md text-headline-md font-bold text-text-primary">No Audience Data Found</h3>
      <p className="font-body-md text-body-md text-text-secondary max-w-md mt-1 mb-6">
        There are no audience interactions recorded for this date range or filter configuration. Try expanding your date range or selecting all campaigns.
      </p>
      <button type="button" onClick={onReset} className="px-4 py-2 bg-primary-container text-text-primary font-bold text-xs rounded hover:bg-brand-primary-hover transition-colors">
        Reset All Filters
      </button>
    </div>
  );
}

export function AudienceError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const toast = useToast();
  return (
    <div className="p-16 flex flex-col items-center justify-center text-center bg-surface-card border border-border-strong rounded-lg" role="alert">
      <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
        <Icon name="error_outline" className="text-[32px]" />
      </div>
      <h3 className="font-headline-md text-headline-md font-bold text-text-primary">Instagram Graph API Connection Error</h3>
      <p className="font-body-md text-body-md text-text-secondary max-w-md mt-1 mb-6">{message ?? 'Failed to fetch demographic attribution metrics.'}</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onRetry} className="px-4 py-2 bg-border-focused text-white font-bold text-xs rounded hover:bg-slate-800 transition-colors">
          Retry Sync
        </button>
        <button
          type="button"
          onClick={() => toast({ tone: 'demo', title: 'No cached snapshot', description: 'The prototype keeps no offline cache of audience data.' })}
          className="px-4 py-2 bg-surface-card border border-border-strong text-text-primary font-semibold text-xs rounded hover:bg-surface-canvas transition-colors"
        >
          View Cached Data
        </button>
      </div>
    </div>
  );
}
