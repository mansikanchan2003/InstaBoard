import type { AccountStatus, AccountType, DataAvailability, InstagramAccount } from '@/types/domain';

export const accountTypeLabel: Record<AccountType, string> = {
  business: 'Instagram Business Account',
  creator: 'Instagram Creator Account',
};

export type DataLevel = 'full' | 'partial' | 'none';

/** Collapses the four data-availability categories into one filterable level. */
export function dataLevelOf(account: InstagramAccount): DataLevel {
  const levels = Object.values(account.dataAvailability).map((d) => d.level);
  if (levels.every((l) => l === 'available')) return 'full';
  if (levels.every((l) => l === 'unavailable')) return 'none';
  return 'partial';
}

export const dataLevelLabel: Record<DataLevel, string> = {
  full: '100% Full Telemetry',
  partial: 'Partial Insights',
  none: 'No Data (Expired)',
};

export const statusFilterLabel: Record<AccountStatus, string> = {
  connected: 'Connected',
  syncing: 'Syncing',
  action_required: 'Action Required',
  expired: 'Expired',
};

export const availabilityCategories = [
  { key: 'media', label: 'Media Telemetry' },
  { key: 'audience', label: 'Audience Insights' },
  { key: 'comments', label: 'Comments & NLP' },
  { key: 'stories', label: 'Story Insights' },
] as const;

export const availabilityIcon: Record<DataAvailability, { icon: string; cls: string; valueCls: string }> = {
  available: { icon: 'check_circle', cls: 'text-status-active', valueCls: 'text-text-primary' },
  partial: { icon: 'info', cls: 'text-status-paused', valueCls: 'text-amber-800' },
  inactive: { icon: 'remove_circle_outline', cls: 'text-text-tertiary', valueCls: 'text-text-secondary' },
  unavailable: { icon: 'cancel', cls: 'text-error', valueCls: 'text-text-secondary' },
};

export const canSync = (a: InstagramAccount) => a.status === 'connected' || a.status === 'action_required';
