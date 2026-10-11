import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { formatCompact, formatNumber } from '@/lib/format';
import type { HistorySeries, SyncJob } from '@/types/instagram';
import { formatDateTime, metricLabels } from './liveMeta';
import { stageLabel, type useSyncState } from './useSyncState';

type SyncState = ReturnType<typeof useSyncState>;

const jobTone: Record<SyncJob['status'], 'scheduled' | 'active' | 'amber' | 'error' | 'neutral'> = {
  queued: 'scheduled',
  running: 'scheduled',
  retrying: 'amber',
  succeeded: 'active',
  partially_succeeded: 'amber',
  failed: 'error',
  cancelled: 'neutral',
};
const jobLabel: Record<SyncJob['status'], string> = {
  queued: 'Queued',
  running: 'Syncing',
  retrying: 'Retrying',
  succeeded: 'Succeeded',
  partially_succeeded: 'Partial',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function JobBadge({ job }: { job: SyncJob }) {
  return <Badge tone={jobTone[job.status]} dot>{jobLabel[job.status]}{job.status === 'running' ? ` ${job.progress}%` : ''}</Badge>;
}

export function JobProgress({ job }: { job: SyncJob }) {
  return (
    <div className="w-full" role="status" aria-live="polite" aria-label={`Sync ${jobLabel[job.status]}`}>
      <div className="flex items-center justify-between text-[12px] text-text-secondary mb-1">
        <span>{stageLabel(job)}</span>
        <span className="tnum">{job.progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full transition-all ${job.status === 'retrying' ? 'bg-amber-500' : 'bg-primary-container'}`} style={{ width: `${Math.max(job.progress, 4)}%` }} />
      </div>
      {job.status === 'retrying' && job.errorMessage && <p className="text-[11px] text-text-tertiary mt-1">{job.errorMessage}</p>}
    </div>
  );
}

/** One-line sync summary for account rows and the dashboard card. */
export function SyncSummary({ sync }: { sync: SyncState }) {
  const st = sync.status.data;
  if (sync.active) return <JobProgress job={sync.active} />;
  return (
    <span className="text-[12px] text-text-secondary flex flex-wrap gap-x-3 gap-y-0.5">
      <span>Last successful sync: {st?.lastSuccessAt ? formatDateTime(st.lastSuccessAt) : 'never'}</span>
      {sync.lastJob && sync.lastJob.status !== 'succeeded' && <span>Last run: <JobBadge job={sync.lastJob} /></span>}
      <span>{st?.nextScheduledAt ? `Next scheduled: ${formatDateTime(st.nextScheduledAt)}` : st?.backgroundAvailable === false ? 'Background sync not configured' : 'Not scheduled'}</span>
    </span>
  );
}

export function SyncNowButton({ sync, disabled }: { sync: SyncState; disabled?: boolean }) {
  const busy = !!sync.active;
  return (
    <Button icon={busy ? 'progress_activity' : 'sync'} onClick={() => void sync.start()} loading={sync.starting} disabled={disabled || busy}
      className={busy ? '[&_.material-symbols-outlined]:animate-spin' : undefined}>
      {busy ? 'Syncing…' : 'Sync now'}
    </Button>
  );
}

// ------------------------------------------------------------------------------------- charts
const seriesTitle: Record<string, string> = {
  'followers_count:daily_snapshot': 'Followers (observed at each sync)',
  'media_count:daily_snapshot': 'Media count',
  'follows_count:daily_snapshot': 'Following',
  'reach:daily': 'Daily reach',
  'reach:rolling_28d': 'Reach, rolling 28 days (as observed)',
  'views:rolling_28d': 'Views, rolling 28 days (as observed)',
  'total_interactions:rolling_28d': 'Interactions, rolling 28 days (as observed)',
  'accounts_engaged:rolling_28d': 'Accounts engaged, rolling 28 days',
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: '2-digit', timeZone: 'UTC' });
}

/** Line chart that leaves days without an observation empty (connectNulls=false): gaps stay visible. */
export function HistoryChart({ series, height = 180 }: { series: HistorySeries; height?: number }) {
  const data = series.points.map((p) => ({ date: shortDate(p.date), value: p.value }));
  const title = seriesTitle[`${series.metric}:${series.kind}`] ?? metricLabels[series.metric] ?? series.metric;
  return (
    <figure className="border border-border-strong rounded-lg p-3">
      <figcaption className="flex items-center justify-between mb-1">
        <span className="text-label-sm font-semibold text-text-primary">{title}</span>
        <span className="text-[11px] text-text-tertiary">{series.observedDays} of {series.points.length} days observed</span>
      </figcaption>
      <div style={{ height }} aria-label={`${title} chart`} role="img">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v: number) => formatCompact(v)} width={44} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
              formatter={(value) => [typeof value === 'number' ? formatNumber(value) : 'no observation', title]}
            />
            <Line type="monotone" dataKey="value" stroke="#F5A623" strokeWidth={2} connectNulls={false} dot={{ r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function HistoryEmpty() {
  return (
    <EmptyState icon="timeline" title="No history yet"
      description="History builds up from each sync (Instagram does not return past follower counts). Charts appear after the first successful sync; days without a sync stay empty." />
  );
}
