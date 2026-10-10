/** Settings & Workspace Configuration entities (owned by the Settings screen). */

export type SettingsTab = 'general' | 'workspace' | 'instagram' | 'data-sync' | 'ai' | 'notifications' | 'security';

export type TimezoneOption = 'Asia/Kolkata' | 'UTC' | 'Asia/Kathmandu';
export type DateFormatOption = 'MMM DD, YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type NumberFormatOption = 'en-IN' | 'en-US';

export interface GeneralSettings {
  displayName: string;
  /** Read-only workspace code shown as "ID: …". */
  workspaceCode: string;
  logoUrl: string;
  logoFileName: string;
  timezone: TimezoneOption;
  dateFormat: DateFormatOption;
  /** Locked for this workspace. */
  currency: 'INR';
  numberFormat: NumberFormatOption;
  defaultAccountId: string;
  denseGrid: boolean;
  deltaBadges: boolean;
}

export type SyncStream = 'media' | 'audience' | 'comments' | 'stories';
export type SyncIntervalHours = 6 | 12 | 24;
export type RetentionDays = 180 | 365 | 730;

export interface SyncSettings {
  enabled: boolean;
  intervalHours: SyncIntervalHours;
  /** Minute past the hour the cron fires at (IST). */
  offsetMinute: number;
  streams: Record<SyncStream, boolean>;
  retentionDays: RetentionDays;
  autoRetry: boolean;
}

export type AiCategory = 'campaignDiagnostics' | 'fatigueAlerts' | 'sentiment' | 'leadAttribution';

export interface AiSettings {
  enabled: boolean;
  categories: Record<AiCategory, boolean>;
  confidenceThreshold: 70 | 80 | 90;
  minSampleSize: 250 | 500 | 1000;
}

export type NotificationChannel = 'email' | 'app' | 'slack';
export type NotificationTriggerId = 'tokenExpiry' | 'highIntentLead' | 'sentimentAnomaly';

export interface NotificationTriggerSettings {
  enabled: boolean;
  channels: NotificationChannel[];
  threshold: number;
}

export interface NotificationSettings {
  triggers: Record<NotificationTriggerId, NotificationTriggerSettings>;
  digestEnabled: boolean;
  digestTime: '08:00' | '09:00' | '10:00';
}

export interface WorkspaceSettings {
  general: GeneralSettings;
  sync: SyncSettings;
  ai: AiSettings;
  notifications: NotificationSettings;
  updatedAt: string;
  updatedBy: string;
}

/** The editable sections of the settings form (each maps to one tab). */
export type SettingsSection = 'general' | 'sync' | 'ai' | 'notifications';

export interface NotificationTriggerMeta {
  id: NotificationTriggerId;
  label: string;
  /** Description with `{n}` replaced by the threshold. */
  description: string;
  icon: string;
  iconClass: string;
  thresholdLabel: string;
  thresholdUnit: string;
  min: number;
  max: number;
}

export interface SettingsEnvironment {
  environment: string;
  apiHost: string;
  schemaVersion: string;
  plan: string;
}

export interface SettingsSession {
  device: string;
  authMethod: string;
  startedAt: string;
  origin: string;
}
