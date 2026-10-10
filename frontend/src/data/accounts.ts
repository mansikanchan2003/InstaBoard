import type { InstagramAccount } from '@/types/domain';

/**
 * DEMO DATA — sample Instagram accounts from the Accounts Overview screen.
 * No real Instagram account is connected in this prototype; statuses are illustrative.
 */
export const accounts: InstagramAccount[] = [
  {
    id: 'acc-ekoindia',
    displayName: 'Eko India Financial Services',
    handle: 'ekoindia',
    initials: 'E',
    avatarUrl: '/eko-logo.png',
    type: 'business',
    status: 'connected',
    isPrimary: true,
    verified: true,
    externalId: 'ig_biz_9482710381',
    connectedSince: '2024-09-14',
    lastSyncedAt: 'Oct 31, 2024, 10:18 AM IST',
    nextSyncLabel: 'Next sync in 5h 42m',
    followers: 86_400,
    following: 312,
    mediaCount: 128,
    dataAvailability: {
      media: { level: 'available', label: '100%', detail: 'Posts & Reels' },
      audience: { level: 'available', label: 'Available', detail: 'Demo & Geo' },
      comments: { level: 'available', label: 'Available', detail: 'AI Sentiment' },
      stories: { level: 'available', label: '24h Window', detail: 'Active Ephemeral' },
    },
    scopes: ['instagram_basic', 'instagram_manage_insights', 'instagram_manage_comments', 'pages_show_list'],
  },
  {
    id: 'acc-ekomitracare',
    displayName: 'Eko Mitra Field Stories',
    handle: 'ekomitracare',
    initials: 'EM',
    type: 'creator',
    status: 'action_required',
    isPrimary: false,
    verified: false,
    externalId: 'ig_creator_5592817',
    connectedSince: '2024-10-02',
    lastSyncedAt: 'Oct 30, 2024, 4:00 PM IST',
    statusNote: 'Renewal required in 4 days',
    followers: 8_420,
    following: 190,
    mediaCount: 46,
    dataAvailability: {
      media: { level: 'available', label: 'Available', detail: 'Last: Oct 30, 4PM' },
      audience: { level: 'partial', label: 'Partial', detail: '<100 Flw Threshold' },
      comments: { level: 'available', label: 'Available', detail: 'Stream Active' },
      stories: { level: 'inactive', label: 'Inactive', detail: 'No active stories' },
    },
    scopes: ['instagram_basic', 'instagram_manage_insights', 'instagram_manage_comments'],
  },
  {
    id: 'acc-ekoregional',
    displayName: 'Eko FinTech Regional Hub',
    handle: 'ekoregional_archive',
    initials: 'ER',
    type: 'creator',
    status: 'expired',
    isPrimary: false,
    verified: false,
    externalId: 'ig_creator_3318204',
    connectedSince: '2024-06-21',
    lastSyncedAt: 'Oct 12, 2024',
    statusNote: 'Token revoked or expired during password alteration',
    followers: 3_150,
    following: 88,
    mediaCount: 31,
    dataAvailability: {
      media: { level: 'unavailable', label: 'Unavailable', detail: 'Token expired' },
      audience: { level: 'unavailable', label: 'Unavailable', detail: 'Token expired' },
      comments: { level: 'unavailable', label: 'Unavailable', detail: 'Token expired' },
      stories: { level: 'unavailable', label: 'Unavailable', detail: 'Token expired' },
    },
    scopes: [],
  },
];

export const primaryAccountId = 'acc-ekoindia';
