import { defaultNotificationPreferences, notifications } from '@/data/notifications';
import { fromSource, mutateSource } from '@/lib/api/source';
import type { NotificationItem, NotificationPreferences } from '@/types/notifications';

/**
 * Query keys used with this service must start with "notifications" so that
 * invalidateQueries('notifications') refreshes the header bell badge (`notifications:unread`) too.
 * Preferences are kept in memory only — no email / SMS / WhatsApp delivery exists in the prototype.
 */
const store: NotificationItem[] = structuredClone(notifications);
let preferences: NotificationPreferences = structuredClone(defaultNotificationPreferences);

export const notificationService = {
  list: () => fromSource(() => store, '/notifications'),

  unreadCount: () => fromSource(() => store.filter((n) => !n.read).length, '/notifications/unread-count'),

  setRead: (id: string, read: boolean) =>
    mutateSource(
      () => {
        const found = store.find((n) => n.id === id);
        if (found) found.read = read;
        return found;
      },
      { method: 'patch', path: `/notifications/${id}`, body: { read } },
    ),

  markAllRead: () =>
    mutateSource(
      () => {
        store.forEach((n) => (n.read = true));
        return store.length;
      },
      { method: 'post', path: '/notifications/mark-all-read' },
    ),

  /** Removes a notification from the in-memory inbox. */
  dismiss: (id: string) =>
    mutateSource(
      () => {
        const idx = store.findIndex((n) => n.id === id);
        if (idx >= 0) store.splice(idx, 1);
        return { id };
      },
      { method: 'delete', path: `/notifications/${id}` },
    ),

  getPreferences: () => fromSource(() => preferences, '/notifications/preferences'),

  savePreferences: (next: NotificationPreferences) =>
    mutateSource(
      () => {
        preferences = structuredClone(next);
        return preferences;
      },
      { method: 'put', path: '/notifications/preferences', body: next },
    ),
};
