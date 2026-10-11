import type { Tone } from '@/components/ui/Badge';
import type { InstagramConnection } from '@/types/instagram';

/** UI connection states (the Connecting state is local while the browser is sent to Instagram). */
export type LiveUiState = 'not_connected' | 'connecting' | 'connected' | 'needs_reauth' | 'error';

export function connectionUiState(c: InstagramConnection): LiveUiState {
  if (c.status === 'needs_reauth') return 'needs_reauth';
  if (c.status === 'error') return 'error';
  return 'connected';
}

export const liveStateMeta: Record<LiveUiState, { label: string; tone: Tone; icon: string }> = {
  not_connected: { label: 'Not connected', tone: 'neutral', icon: 'link_off' },
  connecting: { label: 'Connecting…', tone: 'scheduled', icon: 'progress_activity' },
  connected: { label: 'Connected', tone: 'active', icon: 'check_circle' },
  needs_reauth: { label: 'Needs reauthorization', tone: 'amber', icon: 'key' },
  error: { label: 'Error', tone: 'error', icon: 'error' },
};

/** Messages for the callback redirect `?instagram=error&reason=…` (only these codes are ever shown). */
export const callbackReasons: Record<string, { title: string; detail: string }> = {
  access_denied: { title: 'Authorization cancelled', detail: 'Instagram did not grant access because the request was declined. Nothing was connected.' },
  authorization_failed: { title: 'Instagram returned an error', detail: 'The authorization could not be completed. Try again in a moment.' },
  invalid_state: { title: 'Connection link not recognised', detail: 'Start the connection again from this page (links are single-use and tied to your session).' },
  state_expired: { title: 'Connection attempt expired', detail: 'The authorization took longer than 10 minutes. Start again.' },
  state_used: { title: 'Already processed', detail: 'This authorization response was already used. Refresh the page to see the account.' },
  session_mismatch: { title: 'Different session', detail: 'Finish the Instagram authorization in the same browser session that started it, while signed in.' },
  forbidden: { title: 'Permission required', detail: 'Only workspace owners and admins can connect Instagram accounts.' },
  invalid_callback: { title: 'Incomplete response', detail: 'Instagram did not return an authorization code. Try again.' },
  exchange_failed: { title: 'Could not complete sign-in', detail: 'The authorization code could not be exchanged for an access token. Try again.' },
  permission_missing: { title: 'Basic permission not granted', detail: 'InstaBoard needs at least instagram_business_basic to read the account. Reconnect and allow it.' },
  not_professional: { title: 'Professional account required', detail: 'Only Instagram Business or Creator accounts can be connected.' },
  account_mismatch: { title: 'Account check failed', detail: 'The authorized account could not be verified. Nothing was connected.' },
  rate_limited: { title: 'Instagram rate limit reached', detail: 'Wait a few minutes and try again.' },
  provider_unavailable: { title: 'Instagram is unavailable', detail: 'Instagram did not respond in time. Try again shortly.' },
  integration_disabled: { title: 'Integration not configured', detail: 'The server has no Instagram app credentials configured.' },
};

export const scopeDescriptions: Record<string, string> = {
  instagram_business_basic: 'Profile (username, name, picture, follower and media counts) and your media list. Required.',
  instagram_business_manage_insights: 'Read insights: views, reach, likes, comments, shares, saves and account-level totals.',
  instagram_business_manage_comments: 'Read comments on your media. (This Meta permission also allows replying/deleting; InstaBoard only reads.)',
};

export const metricLabels: Record<string, string> = {
  views: 'Views',
  reach: 'Reach',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saved: 'Saves',
  saves: 'Saves',
  total_interactions: 'Interactions',
  accounts_engaged: 'Accounts engaged',
};

/** "Oct 11, 2026, 14:05" in the viewer's locale; '—' for null. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
