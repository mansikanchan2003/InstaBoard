import type { NotificationCategory, NotificationGroup, NotificationPriority, NotificationTone } from '@/types/notifications';

/** UI labels / class maps for the Notifications Inbox (copied from the export's markup). */

export const categoryLabels: Record<NotificationCategory, string> = {
  campaigns: 'Campaigns',
  leads: 'Leads',
  content: 'Content Performance',
  account: 'Account & Sync',
  ai: 'AI Insights',
  reports: 'Reports',
};

export const categoryOrder: NotificationCategory[] = ['campaigns', 'leads', 'content', 'account', 'ai', 'reports'];

export const groupLabels: Record<NotificationGroup, string> = {
  today: 'Today • Oct 31, 2024',
  earlier: 'Earlier Today',
  yesterday: 'Yesterday • Oct 30, 2024',
  week: 'Earlier This Week',
};

export const groupOrder: NotificationGroup[] = ['today', 'earlier', 'yesterday', 'week'];

export const priorityLabels: Record<NotificationPriority, string> = {
  urgent: 'Urgent Attention',
  high: 'High Priority',
  standard: 'Standard',
};

export const toneClasses: Record<NotificationTone, { box: string; pill: string; dot: string }> = {
  amber: { box: 'bg-status-paused-subtle border-[#FDE68A] text-[#B45309]', pill: 'bg-status-paused-subtle border-[#FDE68A] text-[#92400E]', dot: 'bg-[#D97706]' },
  emerald: { box: 'bg-status-active-subtle border-[#A7F3D0] text-[#065F46]', pill: 'bg-status-active-subtle border-[#A7F3D0] text-[#065F46]', dot: 'bg-status-active' },
  ai: { box: 'bg-ai-subtle border-ai-border text-ai-accent', pill: 'bg-ai-subtle border-ai-border text-[#4338CA]', dot: 'bg-ai-accent' },
  sky: { box: 'bg-status-completed-subtle border-[#BAE6FD] text-[#0369A1]', pill: 'bg-status-completed-subtle border-[#BAE6FD] text-[#0369A1]', dot: 'bg-status-completed' },
  slate: { box: 'bg-status-draft-subtle border-border-strong text-text-secondary', pill: 'bg-status-draft-subtle border-border-strong text-text-secondary', dot: 'bg-text-tertiary' },
};

export const neutralTag = 'bg-surface-canvas border-border-strong text-text-secondary';

export const metaToneText: Record<NotificationTone, string> = {
  amber: 'text-[#92400E] font-bold',
  emerald: 'text-[#065F46] font-bold',
  ai: 'text-[#4338CA] font-bold',
  sky: 'text-[#0369A1] font-bold',
  slate: 'text-text-secondary',
};
