import { defaultWorkspaceSettings, notificationTriggerMeta, settingsEnvironment, settingsSession } from '@/data/settings';
import { fromSource, mutateSource } from '@/lib/api/source';
import { recordActivity } from '@/services/activity';
import { sessionUser } from '@/services/workspace';
import type { ActivityDiff } from '@/types/activity';
import type { SettingsTab, WorkspaceSettings } from '@/types/settings';

/**
 * Workspace settings. Demo mode keeps the saved configuration in memory for this browser
 * session only — no scheduler, AI engine or notification provider is reconfigured.
 * Query keys must start with "settings".
 */
let store: WorkspaceSettings = structuredClone(defaultWorkspaceSettings);

const labels: Record<string, string> = {
  'general.displayName': 'Workspace display name',
  'general.timezone': 'Time zone',
  'general.dateFormat': 'Date format',
  'general.numberFormat': 'Number format',
  'general.defaultAccountId': 'Default Instagram account',
  'general.denseGrid': 'Dense enterprise data grid',
  'general.deltaBadges': 'Period-over-period delta badges',
  'sync.enabled': 'Automated ingestion',
  'sync.intervalHours': 'Sync interval (hours)',
  'sync.streams.media': 'Stream: Media telemetry',
  'sync.streams.audience': 'Stream: Audience demographics',
  'sync.streams.comments': 'Stream: Comments & NLP',
  'sync.streams.stories': 'Stream: 24h Story telemetry',
  'sync.retentionDays': 'Telemetry retention (days)',
  'sync.autoRetry': 'Automatic retry on 429',
  'ai.enabled': 'AI synthesis engine',
  'ai.categories.campaignDiagnostics': 'AI: Campaign diagnostics',
  'ai.categories.fatigueAlerts': 'AI: Reel fatigue alerts',
  'ai.categories.sentiment': 'AI: Sentiment & intent',
  'ai.categories.leadAttribution': 'AI: Lead attribution',
  'ai.confidenceThreshold': 'Minimum confidence (%)',
  'ai.minSampleSize': 'Minimum sample size',
  'notifications.digestEnabled': 'Morning digest',
  'notifications.digestTime': 'Morning digest time',
};
notificationTriggerMeta.forEach((t) => {
  labels[`notifications.triggers.${t.id}.enabled`] = `${t.label}`;
  labels[`notifications.triggers.${t.id}.channels`] = `${t.label} channels`;
  labels[`notifications.triggers.${t.id}.threshold`] = `${t.label} threshold`;
});

const sectionTab: Record<string, SettingsTab> = { general: 'general', sync: 'data-sync', ai: 'ai', notifications: 'notifications' };

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k, out));
  } else {
    out[prefix] = Array.isArray(obj) ? obj.join(' + ') || 'None' : typeof obj === 'boolean' ? (obj ? 'On' : 'Off') : String(obj);
  }
  return out;
}

export function diffSettings(before: WorkspaceSettings, after: WorkspaceSettings): Array<ActivityDiff & { key: string }> {
  const a = flatten({ general: before.general, sync: before.sync, ai: before.ai, notifications: before.notifications });
  const b = flatten({ general: after.general, sync: after.sync, ai: after.ai, notifications: after.notifications });
  return Object.keys(b)
    .filter((k) => a[k] !== b[k])
    .map((k) => ({ key: k, field: labels[k] ?? k, before: a[k] ?? '—', after: b[k] }));
}

export const settingsService = {
  get: () => fromSource(() => store, '/settings'),
  environment: () => fromSource(() => settingsEnvironment, '/settings/environment'),
  session: () => fromSource(() => settingsSession, '/me/session'),
  defaults: (): WorkspaceSettings => structuredClone(defaultWorkspaceSettings),

  save: (next: WorkspaceSettings) =>
    mutateSource(
      () => {
        const diff = diffSettings(store, next);
        store = { ...structuredClone(next), updatedAt: 'Oct 31, 2024 · just now (this session)', updatedBy: sessionUser.name };
        if (diff.length) {
          const firstTab = sectionTab[diff[0].key.split('.')[0]] ?? 'general';
          recordActivity({
            category: 'settings',
            kind: 'Config Change',
            kindIcon: 'settings',
            kindTone: 'neutral',
            kindIconClass: 'text-text-secondary',
            title: 'Workspace Settings Updated',
            summary: `Updated ${diff.length} setting${diff.length === 1 ? '' : 's'}: ${diff
              .slice(0, 3)
              .map((d) => d.field)
              .join(', ')}${diff.length > 3 ? '…' : ''}.`,
            narrative: `${sessionUser.name} saved workspace configuration changes. Saved to this browser session's in-memory demo store only — no backend services were reconfigured.`,
            target: { label: 'Sys/Settings', to: `/settings?tab=${firstTab}`, module: 'Settings' },
            actorId: sessionUser.id,
            outcome: 'success',
            payload: { type: 'SETTINGS_UPDATED', changed_fields: diff.map((d) => d.key) },
            diff: diff.map(({ field, before, after }) => ({ field, before, after })),
          });
        }
        return store;
      },
      { method: 'put', path: '/settings', body: next },
    ),
};
