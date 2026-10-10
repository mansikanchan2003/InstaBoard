/** Notifications Inbox entities. (Owned by the Notifications screen.) */
export type NotificationCategory = 'campaigns' | 'leads' | 'content' | 'account' | 'ai' | 'reports';
export type NotificationPriority = 'urgent' | 'high' | 'standard';
export type NotificationGroup = 'today' | 'earlier' | 'yesterday' | 'week';
export type NotificationTone = 'amber' | 'emerald' | 'ai' | 'sky' | 'slate';

export interface NotificationTag {
  label: string;
  tone?: NotificationTone;
}

export interface NotificationAction {
  label: string;
  /** In-app route; `download-report` builds the report CSV client-side. */
  href?: string;
  kind?: 'link' | 'download-report' | 'dismiss' | 'details';
  icon?: string;
}

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  /** Phrases inside `body` rendered in bold. */
  emphasis?: string[];
  /** Quoted comment text inside `body`, rendered italic. */
  quote?: string;
  /** Relative time label as designed, e.g. "14m ago". */
  timeLabel: string;
  /** Full timestamp for the detail modal. */
  timestampLabel: string;
  group: NotificationGroup;
  read: boolean;
  /** In-app route to open when the notification is clicked. */
  href?: string;
  icon: string;
  tone: NotificationTone;
  badge: { label: string; tone: NotificationTone; icon?: string; dot?: boolean };
  tags: NotificationTag[];
  primaryAction: NotificationAction;
  secondaryAction?: NotificationAction;
  /** Rows of the "Inspect Detail" modal metadata box. */
  meta: Array<{ label: string; value: string; tone?: NotificationTone }>;
  /** Related report id for `download-report` actions. */
  reportId?: string;
}

export interface NotificationPreferences {
  channels: { inApp: boolean; emailDigest: boolean };
  thresholds: { tokenExpiryDays: number; leadScore: 'high' | 'medium' | 'any'; sentimentSpikePct: number };
  categories: Record<NotificationCategory, boolean>;
}
