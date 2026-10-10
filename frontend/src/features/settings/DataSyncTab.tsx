import { modeText } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { InstagramAccount } from '@/types/domain';
import type { RetentionDays, SyncIntervalHours, SyncStream } from '@/types/settings';
import type { SectionProps } from './GeneralTab';
import { FieldError, inputCls, labelCls, SettingsCard, Switch } from './settingsUi';

const streams: Array<{ id: SyncStream; icon: string; label: string; detail: string }> = [
  { id: 'media', icon: 'movie', label: 'Media Telemetry (Posts & Reels)', detail: 'Likes, video views, watch time, shares, and saves' },
  { id: 'audience', icon: 'group', label: 'Audience Demographics', detail: 'Follower geo distribution, age cohorts, gender splits' },
  { id: 'comments', icon: 'chat', label: 'Comments & NLP Ingestion', detail: 'Text threads, keyword tags, sentiment extraction' },
  { id: 'stories', icon: 'history_toggle_off', label: '24h Story Telemetry', detail: 'Replies, taps forward/back, exits, sticker clicks' },
];

/** Anchor run of the demo schedule: Oct 31, 10:18 IST (the last completed sync). */
const ANCHOR_HOUR = 10;

const fmt12 = (h: number, m: number) => `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

export function scheduleTimes(interval: SyncIntervalHours, minute: number) {
  const runs = 24 / interval;
  return Array.from({ length: runs }, (_, i) => (ANCHOR_HOUR + i * interval) % 24)
    .sort((a, b) => a - b)
    .map((h) => `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

export function DataSyncTab({ s, update, errors, primary }: SectionProps & { primary?: InstagramAccount }) {
  const sync = s.sync;
  const nextHour = ANCHOR_HOUR + sync.intervalHours;
  const nextLabel = nextHour >= 24 ? `Nov 01, ${fmt12(nextHour - 24, sync.offsetMinute)}` : `Today, ${fmt12(nextHour, sync.offsetMinute)}`;

  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <div className="flex items-start sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-border-strong">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">Automated Ingestion Cadence</h2>
            <p className="font-body-sm text-body-sm text-text-secondary">Orchestrate periodic Meta API sync routines to update impressions, engagement, and reach metrics.</p>
          </div>
          <Switch size="md" label="Automated ingestion" checked={sync.enabled} onChange={(v) => update((d) => void (d.sync.enabled = v))} />
        </div>

        <div className={cn('transition-opacity', !sync.enabled && 'opacity-60')}>
          {!sync.enabled && (
            <p className="mb-4 text-body-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
              <Icon name="pause_circle" className="text-[18px]" /> Automated ingestion is paused — dashboards would keep showing the last synced values.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-surface-canvas rounded border border-border-strong">
              <label htmlFor="sync-interval" className="text-xs text-text-secondary block mb-1">
                Scheduled Intervals
              </label>
              <select
                id="sync-interval"
                disabled={!sync.enabled}
                value={sync.intervalHours}
                onChange={(e) => update((d) => void (d.sync.intervalHours = Number(e.target.value) as SyncIntervalHours))}
                className="w-full bg-transparent border-0 p-0 pr-6 font-headline-sm text-headline-sm font-bold text-text-primary focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
              >
                <option value={6}>Every 6 Hours</option>
                <option value={12}>Every 12 Hours</option>
                <option value={24}>Every 24 Hours</option>
              </select>
              <span className="text-[11px] text-text-tertiary block mt-0.5">{scheduleTimes(sync.intervalHours, sync.offsetMinute).join(', ')} IST</span>
            </div>
            <div className="p-3 bg-surface-canvas rounded border border-border-strong">
              <span className="text-xs text-text-secondary block mb-1">Last Completed Sync</span>
              <span className="font-headline-sm text-headline-sm font-bold text-emerald-700">{primary?.lastSyncedAt ?? '—'}</span>
              <span className="text-[11px] text-text-tertiary block mt-0.5">@{primary?.handle ?? 'ekoindia'} • sample record</span>
            </div>
            <div className="p-3 bg-surface-canvas rounded border border-border-strong">
              <span className="text-xs text-text-secondary block mb-1">Next Scheduled Execution</span>
              <span className="font-headline-sm text-headline-sm font-bold text-text-primary">{sync.enabled ? nextLabel : 'Paused'}</span>
              <span className="text-[11px] text-text-tertiary block mt-0.5">Simulated — no scheduler runs in this prototype</span>
            </div>
          </div>

          <h3 className="font-label-md text-label-md font-bold text-text-primary mb-3">Synchronized Data Streams:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            {streams.map((st) => (
              <label key={st.id} className="flex items-center justify-between gap-3 p-3 rounded border border-border-strong bg-surface-card cursor-pointer hover:border-text-secondary transition-colors">
                <div className="flex items-center gap-2.5">
                  <Icon name={st.icon} className="text-primary text-[20px]" />
                  <div>
                    <span className="font-label-sm text-label-sm font-bold text-text-primary block">{st.label}</span>
                    <span className="text-xs text-text-secondary">{st.detail}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!sync.enabled}
                  checked={sync.streams[st.id]}
                  onChange={(e) => update((d) => void (d.sync.streams[st.id] = e.target.checked))}
                  className="rounded text-primary focus:ring-primary-container h-4 w-4 cursor-pointer"
                />
              </label>
            ))}
          </div>
          <FieldError message={errors['sync.streams']} />

          <div className="pt-4 mt-4 border-t border-border-strong grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sync-retention" className={labelCls}>
                Telemetry Data Retention Policy
              </label>
              <select
                id="sync-retention"
                className={inputCls}
                value={sync.retentionDays}
                onChange={(e) => update((d) => void (d.sync.retentionDays = Number(e.target.value) as RetentionDays))}
              >
                <option value={365}>365 Days (Rolling audit telemetry)</option>
                <option value={180}>180 Days (Semi-annual retention)</option>
                <option value={730}>730 Days (2-Year Enterprise compliance)</option>
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 p-2.5 rounded bg-surface-canvas border border-border-strong cursor-pointer">
              <div>
                <span className="font-label-sm text-label-sm font-bold text-text-primary block">Automatic Retry on Rate Limit (429)</span>
                <span className="text-xs text-text-secondary">Exponential backoff with jitter up to 3 retries</span>
              </div>
              <input
                type="checkbox"
                disabled={!sync.enabled}
                checked={sync.autoRetry}
                onChange={(e) => update((d) => void (d.sync.autoRetry = e.target.checked))}
                className="rounded text-primary focus:ring-primary-container h-4 w-4 cursor-pointer"
              />
            </label>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-text-tertiary mt-4 italic">
          {modeText('Disclaimer: Background scheduling would be managed via backend cron services. In this prototype these controls only update the in-memory settings store.', 'Disclaimer: these settings are saved in the InstaBoard database, but no scheduler or Instagram ingestion is running in this phase.')}
        </p>
      </SettingsCard>
    </section>
  );
}
