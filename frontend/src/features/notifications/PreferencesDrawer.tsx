import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { notificationService } from '@/services/notifications';
import type { NotificationCategory, NotificationPreferences } from '@/types/notifications';

const categoryRows: Array<{ key: NotificationCategory; label: string }> = [
  { key: 'account', label: 'Account & Graph Sync' },
  { key: 'leads', label: 'Leads & High-Intent Comments' },
  { key: 'content', label: 'Content Performance Anomalies' },
  { key: 'ai', label: 'AI Strategic Insight Generation' },
  { key: 'reports', label: 'Scheduled Report Compilations' },
  { key: 'campaigns', label: 'Campaign Status & Drift Alerts' },
];

const SectionLabel = ({ children }: { children: ReactNode }) => <span className="text-label-code font-label-code text-text-tertiary uppercase tracking-wider">{children}</span>;

function ThresholdRow({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border-strong bg-surface-card">
      <div className="flex flex-col min-w-0">
        <span className="text-label-md font-label-md font-medium text-text-primary">{title}</span>
        <span className="text-body-sm font-body-sm text-text-secondary">{hint}</span>
      </div>
      {children}
    </div>
  );
}

const pillSelect = 'text-label-sm font-label-sm font-bold px-2 py-1 rounded border cursor-pointer focus:outline-none focus:ring-0';

/** Notification Preferences drawer — saved to the in-memory store via notificationService. */
export function PreferencesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const query = useQuery('notifications:preferences', notificationService.getPreferences, { enabled: open });
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  useEffect(() => {
    if (open && query.data) setDraft(query.data);
  }, [open, query.data]);
  const save = useMutation(notificationService.savePreferences, {
    invalidate: ['notifications'],
    onSuccess: () => {
      toast({ title: 'Alert preferences saved', description: 'Stored in this demo session only. Email, SMS and WhatsApp delivery are not wired up in the prototype.' });
      onClose();
    },
  });

  const set = (fn: (p: NotificationPreferences) => NotificationPreferences) => setDraft((d) => (d ? fn(d) : d));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-surface-canvas border border-border-strong flex items-center justify-center text-text-primary">
            <Icon name="tune" className="text-[20px]" />
          </span>
          Notification Preferences
        </span>
      }
      subtitle="Configure alerts, channels & frequency"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" disabled={!draft} loading={save.isPending} onClick={() => draft && save.mutate(draft)}>
            Save Preferences
          </Button>
        </>
      }
    >
      {!draft ? (
        <div className="space-y-3" role="status" aria-label="Loading preferences">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionLabel>Delivery Channels</SectionLabel>
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border-strong bg-surface-canvas cursor-pointer">
              <span className="flex flex-col">
                <span className="text-label-md font-label-md font-semibold text-text-primary">In-App Live Stream</span>
                <span className="text-body-sm font-body-sm text-text-secondary">Notification badges and toasts inside InstaBoard</span>
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-text-primary focus:ring-0 border-border-strong cursor-pointer"
                checked={draft.channels.inApp}
                onChange={(e) => set((p) => ({ ...p, channels: { ...p.channels, inApp: e.target.checked } }))}
              />
            </label>
            <div className="p-3 rounded-lg border border-border-strong bg-surface-canvas flex flex-col gap-2">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex flex-col">
                  <span className="text-label-md font-label-md font-semibold text-text-primary">Email Digest Summary</span>
                  <span className="text-body-sm font-body-sm text-text-secondary">Daily at 09:00 AM IST</span>
                </span>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-text-primary focus:ring-0 border-border-strong cursor-pointer"
                  checked={draft.channels.emailDigest}
                  onChange={(e) => set((p) => ({ ...p, channels: { ...p.channels, emailDigest: e.target.checked } }))}
                />
              </label>
              <div className="flex items-start gap-1.5 text-[11px] text-[#0284C7] bg-status-completed-subtle px-2 py-1 rounded border border-[#BAE6FD]">
                <Icon name="info" className="text-[13px] mt-px" />
                <span>Prototype: email, SMS and WhatsApp delivery are not connected — this choice is saved as a preference only.</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Critical Alert Thresholds</SectionLabel>
            <ThresholdRow title="Token Expiry Window" hint="Warn before an Instagram access token expires">
              <select
                aria-label="Token expiry window"
                className={cn(pillSelect, 'text-text-primary bg-surface-canvas border-border-strong')}
                value={draft.thresholds.tokenExpiryDays}
                onChange={(e) => set((p) => ({ ...p, thresholds: { ...p.thresholds, tokenExpiryDays: Number(e.target.value) } }))}
              >
                {[3, 5, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    &lt; {d} Days
                  </option>
                ))}
              </select>
            </ThresholdRow>
            <ThresholdRow title="Lead Potential Filter" hint="Only alert on comments scored by AI">
              <select
                aria-label="Lead potential filter"
                className={cn(pillSelect, 'text-[#065F46] bg-status-active-subtle border-[#A7F3D0]')}
                value={draft.thresholds.leadScore}
                onChange={(e) => set((p) => ({ ...p, thresholds: { ...p.thresholds, leadScore: e.target.value as NotificationPreferences['thresholds']['leadScore'] } }))}
              >
                <option value="high">Score = High</option>
                <option value="medium">Score ≥ Medium</option>
                <option value="any">Any score</option>
              </select>
            </ThresholdRow>
            <ThresholdRow title="Sentiment Anomaly Surge" hint="Trigger alert if negative feedback drifts">
              <select
                aria-label="Sentiment anomaly threshold"
                className={cn(pillSelect, 'text-[#92400E] bg-status-paused-subtle border-[#FDE68A]')}
                value={draft.thresholds.sentimentSpikePct}
                onChange={(e) => set((p) => ({ ...p, thresholds: { ...p.thresholds, sentimentSpikePct: Number(e.target.value) } }))}
              >
                {[10, 15, 25].map((v) => (
                  <option key={v} value={v}>
                    &gt; {v}% Spike
                  </option>
                ))}
              </select>
            </ThresholdRow>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionLabel>Categories Monitored</SectionLabel>
            {categoryRows.map((c) => (
              <label key={c.key} className="flex items-center justify-between text-body-md font-body-md py-1 cursor-pointer">
                <span className="text-text-primary">{c.label}</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-text-primary focus:ring-0 border-border-strong"
                  checked={draft.categories[c.key]}
                  onChange={(e) => set((p) => ({ ...p, categories: { ...p.categories, [c.key]: e.target.checked } }))}
                />
              </label>
            ))}
            <p className="text-body-sm text-text-tertiary">Category settings apply to new alerts; existing inbox items stay visible.</p>
          </section>
        </div>
      )}
    </Drawer>
  );
}
