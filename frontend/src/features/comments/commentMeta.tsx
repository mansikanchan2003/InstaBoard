import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/format';
import type { CommentIntent, CommentSentiment, CommentStatus, InstagramComment, LeadPotential } from '@/types/comments';

/** Display metadata for Comments Intelligence (labels + exported pill class strings). */

export const sentimentMeta: Record<CommentSentiment, { label: string; pill: string; dot: string }> = {
  positive: { label: 'Positive', pill: 'bg-status-active-subtle text-status-active', dot: 'bg-status-active' },
  neutral: { label: 'Neutral', pill: 'bg-surface-card-subtle text-text-secondary', dot: 'bg-status-draft' },
  negative: { label: 'Negative', pill: 'bg-error-container/40 text-error', dot: 'bg-error' },
};

export const intentMeta: Record<CommentIntent, { label: string; short: string; pill: string; dot: string }> = {
  application: { label: 'Application / Purchase', short: 'Application', pill: 'bg-primary-container/20 text-on-primary-container font-bold', dot: 'bg-primary-container' },
  eligibility: { label: 'Eligibility Question', short: 'Eligibility', pill: 'bg-ai-subtle text-ai-accent font-semibold', dot: 'bg-ai-accent' },
  product: { label: 'Product Question', short: 'Product Question', pill: 'bg-surface-container-high text-text-primary font-semibold', dot: 'bg-tertiary' },
  information: { label: 'General Question', short: 'Information', pill: 'bg-surface-container-high text-text-primary font-semibold', dot: 'bg-secondary' },
  feedback: { label: 'Feedback', short: 'Feedback', pill: 'bg-surface-card-subtle text-text-secondary font-semibold', dot: 'bg-status-active' },
  complaint: { label: 'Complaint', short: 'Complaint', pill: 'bg-error-container/40 text-error font-semibold', dot: 'bg-error' },
  other: { label: 'Spam / Off-topic', short: 'Spam', pill: 'bg-surface-card-subtle text-text-tertiary font-semibold', dot: 'bg-text-tertiary' },
};

export const potentialMeta: Record<LeadPotential, { label: string; pill: string }> = {
  high: { label: 'High', pill: 'bg-primary-container text-on-primary-container font-bold' },
  medium: { label: 'Medium', pill: 'bg-surface-container-high text-text-primary font-semibold' },
  low: { label: 'Low', pill: 'bg-surface-card-subtle text-text-secondary' },
};

export const statusMeta: Record<CommentStatus, { label: string; pill: string }> = {
  needs_response: { label: 'Needs Response', pill: 'bg-error-container/40 text-error font-bold' },
  reviewed: { label: 'Reviewed', pill: 'bg-surface-card-subtle text-text-secondary border border-border-strong font-semibold' },
  responded: { label: 'Responded', pill: 'bg-status-active-subtle text-status-active font-semibold' },
  resolved: { label: 'Resolved', pill: 'bg-status-completed-subtle text-status-completed font-semibold' },
  lead_created: { label: 'Lead Created', pill: 'bg-ai-subtle border border-ai-border text-ai-accent font-bold' },
  archived: { label: 'Archived', pill: 'bg-surface-card-subtle text-text-tertiary font-semibold' },
};

/** Small exported pill (`text-label-code` rounded). */
export function Pill({ className, rounded = 'rounded', children }: { className: string; rounded?: 'rounded' | 'rounded-full'; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-label-code font-label-code whitespace-nowrap', rounded, className)}>{children}</span>;
}

/** Wraps AI-highlighted phrases in <mark> (Comments export style). */
export function HighlightedText({ text, highlights, markClassName }: { text: string; highlights: string[]; markClassName: string }) {
  const phrases = highlights.filter((h) => h && text.includes(h));
  if (phrases.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return (
    <>
      {text.split(pattern).map((part, i) =>
        phrases.includes(part) ? (
          <mark key={i} className={markClassName}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

const avatarTones = ['bg-primary-fixed text-on-primary-fixed', 'bg-secondary-container text-on-secondary-container', 'bg-status-draft-subtle text-text-secondary', 'bg-surface-dim text-text-primary'];

export function CommentAvatar({ comment, size = 'sm' }: { comment: InstagramComment; size?: 'sm' | 'lg' }) {
  const idx = comment.handle.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % avatarTones.length;
  const initials = comment.authorName
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold shrink-0',
        avatarTones[idx],
        size === 'lg' ? 'w-10 h-10 text-headline-sm font-headline-sm' : 'w-7 h-7 text-label-sm font-label-sm',
      )}
      aria-hidden
    >
      {initials || '@'}
    </div>
  );
}

/* --------------------------------- Filters --------------------------------- */

export type PeriodFilter = 'all' | '7d' | '24h';

export interface CommentFilters {
  accountId: string;
  period: PeriodFilter;
  campaignId: string;
  contentId: string;
  sentiment: CommentSentiment | 'all';
  intent: CommentIntent | 'all';
  potential: LeadPotential | 'all';
  /** 'open' = everything except archived. */
  status: CommentStatus | 'open';
  search: string;
}

export const defaultFilters: CommentFilters = {
  accountId: 'all',
  period: 'all',
  campaignId: 'all',
  contentId: 'all',
  sentiment: 'all',
  intent: 'all',
  potential: 'all',
  status: 'open',
  search: '',
};

export type PresetKey = 'high-leads' | 'complaints' | 'awaiting';

export const presets: Record<PresetKey, Partial<CommentFilters>> = {
  'high-leads': { potential: 'high' },
  complaints: { intent: 'complaint' },
  awaiting: { status: 'needs_response' },
};

/** Demo "now" — the end of the reporting window snapshot (comments' relative labels are based on it). */
const SNAPSHOT_NOW = Date.parse('2024-10-31T14:46:00+05:30');

export function filterComments(rows: InstagramComment[], f: CommentFilters, contentTitle: (id: string) => string): InstagramComment[] {
  const q = f.search.trim().toLowerCase();
  const minTime = f.period === '7d' ? SNAPSHOT_NOW - 7 * 864e5 : f.period === '24h' ? SNAPSHOT_NOW - 864e5 : -Infinity;
  return rows.filter(
    (c) =>
      (f.accountId === 'all' || c.accountId === f.accountId) &&
      Date.parse(c.receivedAt) >= minTime &&
      (f.campaignId === 'all' || c.campaignId === f.campaignId) &&
      (f.contentId === 'all' || c.contentId === f.contentId) &&
      (f.sentiment === 'all' || c.sentiment === f.sentiment) &&
      (f.intent === 'all' || c.intent === f.intent) &&
      (f.potential === 'all' || c.leadPotential === f.potential) &&
      (f.status === 'open' ? c.status !== 'archived' : c.status === f.status) &&
      (!q || `${c.authorName} ${c.handle} ${c.text} ${contentTitle(c.contentId)}`.toLowerCase().includes(q)),
  );
}

/* ---------------------------------- Sorting -------------------------------- */

export type CommentSort = 'priority' | 'newest' | 'score';

export const sortLabels: Record<CommentSort, string> = { priority: 'Priority', newest: 'Newest', score: 'Intent Score' };

const statusRank: Record<CommentStatus, number> = { needs_response: 0, reviewed: 1, lead_created: 2, responded: 3, resolved: 4, archived: 5 };
const potentialRank: Record<LeadPotential, number> = { high: 0, medium: 1, low: 2 };

export function sortComments(rows: InstagramComment[], sort: CommentSort): InstagramComment[] {
  const copy = [...rows];
  if (sort === 'newest') return copy.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  if (sort === 'score') return copy.sort((a, b) => b.intentScore - a.intentScore);
  return copy.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      potentialRank[a.leadPotential] - potentialRank[b.leadPotential] ||
      Number(b.flagged) - Number(a.flagged) ||
      b.intentScore - a.intentScore,
  );
}

export function formatReceived(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Render in IST regardless of the viewer's timezone (data is IST).
  const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60_000);
  const hh = String(ist.getHours()).padStart(2, '0');
  const mm = String(ist.getMinutes()).padStart(2, '0');
  return `${months[ist.getMonth()]} ${ist.getDate()}, ${ist.getFullYear()} at ${hh}:${mm} IST`;
}

export function pct(part: number, total: number, digits = 1): string {
  return total === 0 ? '0%' : `${((part / total) * 100).toFixed(digits)}%`;
}
