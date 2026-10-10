import type { ReactNode } from 'react';
import { cn } from '@/lib/format';
import type { CampaignHealth, CampaignStatus, LeadStatus } from '@/types/domain';
import { Icon } from './Icon';

/** Generic pill — DESIGN.md "Badges & Status Pills" (11px / 600 / rounded-full). */
export type Tone = 'active' | 'paused' | 'draft' | 'completed' | 'scheduled' | 'ai' | 'error' | 'neutral' | 'amber';

const tones: Record<Tone, { pill: string; dot: string }> = {
  active: { pill: 'bg-status-active-subtle border-status-active/30 text-[#065F46]', dot: 'bg-status-active' },
  paused: { pill: 'bg-status-paused-subtle border-status-paused/30 text-[#92400E]', dot: 'bg-status-paused' },
  draft: { pill: 'bg-status-draft-subtle border-border-strong text-status-draft', dot: 'bg-status-draft' },
  completed: { pill: 'bg-status-completed-subtle border-status-completed/30 text-[#0369A1]', dot: 'bg-status-completed' },
  scheduled: { pill: 'bg-tertiary-fixed/30 border-tertiary/20 text-tertiary', dot: 'bg-tertiary' },
  ai: { pill: 'bg-ai-subtle border-ai-border text-[#4338CA]', dot: 'bg-ai-accent' },
  error: { pill: 'bg-error-container/60 border-error/20 text-on-error-container', dot: 'bg-error' },
  neutral: { pill: 'bg-surface-card-subtle border-border-strong text-text-secondary', dot: 'bg-text-tertiary' },
  amber: { pill: 'bg-primary-container/15 border-primary-container/40 text-on-primary-container', dot: 'bg-primary-container' },
};

export function Badge({
  tone = 'neutral',
  dot,
  icon,
  iconFilled,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: string;
  iconFilled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = tones[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap', t.pill, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', t.dot)} />}
      {icon && <Icon name={icon} filled={iconFilled} className="text-[13px] -mx-0.5" />}
      {children}
    </span>
  );
}

/** "AI-INFERRED" style label (indigo, tracked uppercase, spark icon). */
export function AiBadge({ label = 'AI-INFERRED', className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] bg-ai-subtle border border-ai-border text-[#4338CA] whitespace-nowrap',
        className,
      )}
    >
      <Icon name="auto_awesome" className="text-[12px]" />
      {label}
    </span>
  );
}

/** Small uppercase "DEMO DATA" marker so sample values are never mistaken for live metrics. */
export function DemoBadge({ className, label = 'Demo data' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.06em] bg-surface-card-subtle border border-border-strong text-text-secondary whitespace-nowrap',
        className,
      )}
      title="Sample data for prototyping — not retrieved from Instagram"
    >
      <Icon name="science" className="text-[12px]" />
      {label}
    </span>
  );
}

const campaignStatus: Record<CampaignStatus, { tone: Tone; label: string }> = {
  active: { tone: 'active', label: 'Active' },
  paused: { tone: 'paused', label: 'Paused' },
  completed: { tone: 'completed', label: 'Completed' },
  scheduled: { tone: 'scheduled', label: 'Scheduled' },
  draft: { tone: 'draft', label: 'Draft' },
};

export function CampaignStatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  const s = campaignStatus[status];
  return (
    <Badge tone={s.tone} dot className={className}>
      {s.label}
    </Badge>
  );
}

const health: Record<CampaignHealth, { tone: Tone; label: string; icon: string; filled?: boolean }> = {
  excellent: { tone: 'active', label: 'Excellent', icon: 'star', filled: true },
  good: { tone: 'completed', label: 'Good', icon: 'thumb_up' },
  needs_attention: { tone: 'paused', label: 'Needs Attention', icon: 'warning' },
};

export function HealthBadge({ value, fallback }: { value: CampaignHealth | null; fallback?: string }) {
  if (!value) return <Badge tone={fallback === 'Draft' ? 'draft' : 'neutral'}>{fallback ?? '—'}</Badge>;
  const h = health[value];
  return (
    <Badge tone={h.tone} icon={h.icon} iconFilled={h.filled} className="gap-1">
      {h.label}
    </Badge>
  );
}

const leadStatus: Record<LeadStatus, { tone: Tone; label: string }> = {
  new: { tone: 'completed', label: 'New' },
  contacted: { tone: 'paused', label: 'Contacted' },
  qualified: { tone: 'ai', label: 'Qualified' },
  converted: { tone: 'active', label: 'Converted' },
  lost: { tone: 'draft', label: 'Lost' },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const s = leadStatus[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const leadStatusLabel = (s: LeadStatus) => leadStatus[s].label;
export const campaignStatusLabel = (s: CampaignStatus) => campaignStatus[s].label;
