import type { NotificationTriggerMeta, SettingsEnvironment, SettingsSession, WorkspaceSettings } from '@/types/settings';
import { primaryAccountId } from './accounts';
import { workspace } from './workspace';

/**
 * DEMO DATA — default workspace configuration (Settings & Workspace Configuration screen).
 * Saved values live in an in-memory store for the browser session (see services/settings.ts);
 * nothing is sent to a scheduler, AI engine or notification provider.
 */
export const defaultWorkspaceSettings: WorkspaceSettings = {
  general: {
    displayName: workspace.name,
    workspaceCode: 'EKO-WS-DELHI-01',
    logoUrl: '/eko-logo.png',
    logoFileName: 'eko-logo.png',
    timezone: 'Asia/Kolkata',
    dateFormat: 'MMM DD, YYYY',
    currency: 'INR',
    numberFormat: 'en-US',
    defaultAccountId: primaryAccountId,
    denseGrid: true,
    deltaBadges: true,
  },
  sync: {
    enabled: true,
    intervalHours: 6,
    offsetMinute: 18,
    streams: { media: true, audience: true, comments: true, stories: true },
    retentionDays: 365,
    autoRetry: true,
  },
  ai: {
    enabled: true,
    categories: { campaignDiagnostics: true, fatigueAlerts: true, sentiment: true, leadAttribution: true },
    confidenceThreshold: 90,
    minSampleSize: 500,
  },
  notifications: {
    triggers: {
      tokenExpiry: { enabled: true, channels: ['email', 'app'], threshold: 5 },
      highIntentLead: { enabled: true, channels: ['app'], threshold: 85 },
      sentimentAnomaly: { enabled: true, channels: ['slack'], threshold: 15 },
    },
    digestEnabled: true,
    digestTime: '09:00',
  },
  updatedAt: 'Oct 30, 2024, 11:15 AM IST',
  updatedBy: 'Rahul Verma',
};

export const notificationTriggerMeta: NotificationTriggerMeta[] = [
  {
    id: 'tokenExpiry',
    label: 'Instagram Token Expiry Alert',
    description: 'Dispatched when Meta Page Access Tokens approach expiry within < {n} calendar days.',
    icon: 'crisis_alert',
    iconClass: 'text-amber-600',
    thresholdLabel: 'Warn when expiry is within',
    thresholdUnit: 'days',
    min: 1,
    max: 30,
  },
  {
    id: 'highIntentLead',
    label: 'High-Intent Financial Lead Ingestion',
    description: 'Instant ping when user comment scores {n}+ on agent partnership intent model.',
    icon: 'contact_mail',
    iconClass: 'text-sky-600',
    thresholdLabel: 'Minimum AI intent score',
    thresholdUnit: 'score (0–100)',
    min: 50,
    max: 100,
  },
  {
    id: 'sentimentAnomaly',
    label: 'Sentiment Anomaly Detection',
    description: 'Triggered when negative comments exceed {n}% spike baseline within 2 consecutive hours.',
    icon: 'trending_down',
    iconClass: 'text-indigo-600',
    thresholdLabel: 'Negative-comment spike above baseline',
    thresholdUnit: '%',
    min: 5,
    max: 50,
  },
];

export const settingsEnvironment: SettingsEnvironment = {
  environment: 'PROTOTYPE',
  apiHost: 'None — in-memory demo data',
  schemaVersion: 'v19.0 (Graph Core, planned)',
  plan: `${workspace.plan} Dedicated`,
};

export const settingsSession: SettingsSession = {
  device: 'This browser',
  authMethod: 'Fixed demo identity — no SSO or password sign-in in this prototype',
  startedAt: 'Oct 31, 2024, 09:15 AM IST',
  origin: 'Local prototype session',
};
