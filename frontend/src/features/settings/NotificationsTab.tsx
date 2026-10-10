import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { notificationTriggerMeta } from '@/data/settings';
import { cn } from '@/lib/format';
import type { NotificationChannel, NotificationSettings, NotificationTriggerId } from '@/types/settings';
import type { SectionProps } from './GeneralTab';
import { FieldError, inputCls, MASKED_SECRET, Switch } from './settingsUi';

const channelLabels: Record<NotificationChannel, string> = { email: 'EMAIL', app: 'IN-APP', slack: 'SLACK WEBHOOK' };
const channelNames: Record<NotificationChannel, string> = { email: 'Email', app: 'In-app stream', slack: 'Slack webhook' };

const describe = (template: string, n: number) => template.replace('{n}', String(n));

function TriggerBadge({ enabled, channels }: { enabled: boolean; channels: NotificationChannel[] }) {
  return enabled ? (
    <span className="font-label-code text-label-code bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
      ACTIVE ({channels.map((c) => channelLabels[c]).join(' + ') || 'NO CHANNEL'})
    </span>
  ) : (
    <span className="font-label-code text-label-code bg-surface-card-subtle text-text-secondary px-2 py-0.5 rounded border border-border-strong whitespace-nowrap">PAUSED</span>
  );
}

export function NotificationsTab({ s, update, errors }: SectionProps) {
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const n = s.notifications;
  const hasErrors = notificationTriggerMeta.some((m) => errors[`notifications.${m.id}.threshold`] || errors[`notifications.${m.id}.channels`]);

  const setTrigger = (id: NotificationTriggerId, fn: (t: NotificationSettings['triggers'][NotificationTriggerId]) => void) => update((d) => fn(d.notifications.triggers[id]));

  const demoSecret = (action: string) =>
    toast({ tone: 'demo', title: `${action} unavailable`, description: 'The prototype has no Slack integration and holds no webhook secret — the masked value is a placeholder.' });

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface-card border border-border-strong rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-border-strong">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">Notification Routing &amp; Triggers</h2>
            <p className="font-body-sm text-body-sm text-text-secondary">Summary of active delivery channels and anomaly alert thresholds.</p>
          </div>
          <button type="button" onClick={() => setDrawer(true)} className="font-label-sm text-label-sm text-primary font-semibold hover:underline flex items-center gap-1 shrink-0">
            <span>Configure Granular Rules in Drawer</span>
            <Icon name="open_in_new" className="text-[16px]" />
          </button>
        </div>
        {hasErrors && (
          <p className="mb-3 text-[12px] text-error font-medium" role="alert">
            Some trigger rules need attention — open the rules drawer to fix them.
          </p>
        )}
        <div className="space-y-3 mb-6">
          {notificationTriggerMeta.map((m) => {
            const t = n.triggers[m.id];
            return (
              <div key={m.id} className="p-3 rounded bg-surface-canvas border border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon name={m.icon} className={m.iconClass} />
                  <div>
                    <span className="font-label-md text-label-md font-semibold text-text-primary block">{m.label}</span>
                    <span className="text-xs text-text-secondary">{describe(m.description, t.threshold)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TriggerBadge enabled={t.enabled} channels={t.channels} />
                  <Switch label={`${m.label} enabled`} checked={t.enabled} onChange={(v) => setTrigger(m.id, (x) => void (x.enabled = v))} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-3 bg-surface-card rounded border border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-label-sm font-bold text-text-primary">Executive Morning Digest Summary</span>
            <span className="text-xs text-text-secondary block">
              {n.digestEnabled ? `Would be dispatched daily at ${n.digestTime} AM IST to Owner, Admin & Editor inboxes.` : 'Digest is turned off.'} (No email provider in this prototype.)
            </span>
          </div>
          <button
            type="button"
            className="h-8 px-3 rounded bg-surface-card border border-border-strong text-text-secondary font-label-sm text-label-sm hover:text-text-primary shrink-0"
            onClick={() =>
              toast({ tone: 'demo', title: 'Test dispatch not sent', description: 'There is no SendGrid or email integration in this prototype, so no digest was delivered to anyone.' })
            }
          >
            Test Dispatch Now
          </button>
        </div>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Granular Notification Rules"
        subtitle="Changes join the unsaved settings draft — use Save changes to keep them."
        width="w-full sm:w-[480px]"
        footer={
          <Button variant="primary" onClick={() => setDrawer(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          {notificationTriggerMeta.map((m) => {
            const t = n.triggers[m.id];
            const thresholdError = errors[`notifications.${m.id}.threshold`];
            return (
              <fieldset key={m.id} className="border border-border-strong rounded-lg p-4 space-y-3">
                <legend className="px-1 font-label-md text-label-md font-bold text-text-primary flex items-center gap-1.5">
                  <Icon name={m.icon} className={cn('text-[18px]', m.iconClass)} /> {m.label}
                </legend>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-text-secondary">Trigger enabled</span>
                  <Switch label={`${m.label} enabled`} checked={t.enabled} onChange={(v) => setTrigger(m.id, (x) => void (x.enabled = v))} />
                </div>
                <div>
                  <label htmlFor={`thr-${m.id}`} className="block font-label-sm text-label-sm text-text-primary mb-1">
                    {m.thresholdLabel} <span className="text-text-tertiary font-normal">({m.thresholdUnit})</span>
                  </label>
                  <input
                    id={`thr-${m.id}`}
                    type="number"
                    inputMode="numeric"
                    min={m.min}
                    max={m.max}
                    value={Number.isFinite(t.threshold) ? t.threshold : ''}
                    aria-invalid={!!thresholdError}
                    onChange={(e) => setTrigger(m.id, (x) => void (x.threshold = e.target.value === '' ? Number.NaN : Number(e.target.value)))}
                    className={cn(inputCls, 'w-32', thresholdError && 'border-error')}
                  />
                  <FieldError message={thresholdError} />
                </div>
                <div>
                  <span className="block font-label-sm text-label-sm text-text-primary mb-1">Delivery channels</span>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(channelNames) as NotificationChannel[]).map((c) => (
                      <label key={c} className="flex items-center gap-1.5 text-body-sm text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={t.channels.includes(c)}
                          onChange={(e) =>
                            setTrigger(m.id, (x) => {
                              x.channels = e.target.checked ? [...x.channels, c] : x.channels.filter((y) => y !== c);
                            })
                          }
                          className="rounded text-primary focus:ring-primary-container h-4 w-4"
                        />
                        {channelNames[c]}
                      </label>
                    ))}
                  </div>
                  <FieldError message={errors[`notifications.${m.id}.channels`]} />
                </div>
              </fieldset>
            );
          })}

          <fieldset className="border border-border-strong rounded-lg p-4 space-y-3">
            <legend className="px-1 font-label-md text-label-md font-bold text-text-primary">Executive Morning Digest</legend>
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-sm text-text-secondary">Daily digest enabled</span>
              <Switch label="Morning digest enabled" checked={n.digestEnabled} onChange={(v) => update((d) => void (d.notifications.digestEnabled = v))} />
            </div>
            <div>
              <label htmlFor="digest-time" className="block font-label-sm text-label-sm text-text-primary mb-1">
                Dispatch time (IST)
              </label>
              <select
                id="digest-time"
                disabled={!n.digestEnabled}
                className={cn(inputCls, 'w-40')}
                value={n.digestTime}
                onChange={(e) => update((d) => void (d.notifications.digestTime = e.target.value as NotificationSettings['digestTime']))}
              >
                <option value="08:00">08:00 AM</option>
                <option value="09:00">09:00 AM</option>
                <option value="10:00">10:00 AM</option>
              </select>
            </div>
          </fieldset>

          <fieldset className="border border-border-strong rounded-lg p-4 space-y-2">
            <legend className="px-1 font-label-md text-label-md font-bold text-text-primary">Slack Webhook</legend>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-[12px] bg-surface-canvas border border-border-strong rounded px-2 py-1 text-text-secondary">https://hooks.slack.com/{MASKED_SECRET}</code>
              <Button size="xs" variant="ghost" icon="visibility" onClick={() => demoSecret('Reveal')}>
                Reveal
              </Button>
              <Button size="xs" variant="ghost" icon="autorenew" onClick={() => demoSecret('Regenerate')}>
                Regenerate
              </Button>
            </div>
            <p className="text-[11px] text-text-tertiary">Placeholder only — no secrets are stored in this prototype.</p>
          </fieldset>
        </div>
      </Drawer>
    </section>
  );
}
