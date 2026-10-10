import { contentTypeLabel } from '@/features/dashboard/selectors';
import type { ContentItem, Lead, LeadSource, LeadStatus } from '@/types/domain';

/** A lead with its campaign / content source resolved for display, filtering and export. */
export interface LeadRow extends Lead {
  campaignName: string;
  contentLabel: string | null;
}

export const leadStatuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

const sourceLabels: Record<LeadSource, string> = {
  comment: 'Instagram comment',
  dm: 'Instagram DM',
  bio_link: 'Bio link form',
  profile_visit: 'Profile visit',
};
export const leadSourceLabel = (s: LeadSource) => sourceLabels[s];

/** "Reel: Daily Income of Eko CSP Mitra" */
export const contentSourceLabel = (c: ContentItem) => `${contentTypeLabel(c.type)}: ${c.title}`;

/** Parses relative labels ("Just now", "18m ago", "2h ago", "3d ago") into minutes for sorting. */
export function minutesAgo(label: string): number {
  const m = /^(\d+)\s*([mhd])/i.exec(label.trim());
  if (!m) return /just now/i.test(label) ? 0 : Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 'm' ? n : m[2].toLowerCase() === 'h' ? n * 60 : n * 1440;
}

/** Score chip colours from the export: emerald for converted, amber for 90+, slate otherwise. */
export function scoreChipClass(score: number, status: LeadStatus): string {
  if (status === 'converted') return 'bg-emerald-100 text-status-active';
  if (score >= 90) return 'bg-amber-100 text-on-primary-container';
  if (score >= 70) return 'bg-slate-100 text-text-primary';
  return 'bg-surface-card-subtle text-text-secondary';
}

/**
 * Suggested reply template for the lead drawer. Built from the lead's own fields so it stays in
 * sync with edits; it is copied to the clipboard only — the prototype never sends messages.
 */
export function suggestedReply(lead: Lead): string {
  const firstName = lead.name.split(/\s+/)[0]?.replace(/\.$/, '') ?? lead.name;
  const city = lead.location.split(',')[0]?.trim() || lead.location;
  switch (lead.status) {
    case 'converted':
      return `Namaste ${firstName} ji! Welcome to the Eko CSP family. Our onboarding team will share your kiosk activation checklist for ${city} shortly.`;
    case 'lost':
      return `Namaste ${firstName} ji! Whenever you are ready to open your SBI CSP in ${city}, reply here and our team will guide you through the steps again.`;
    case 'contacted':
    case 'qualified':
      return `Namaste ${firstName} ji! Following up on your SBI CSP enquiry for ${city}. Please keep your Aadhaar, PAN and 10th pass certificate ready — share a convenient time in DM and our team will call you.`;
    default:
      return `Namaste ${firstName} ji! ${city} mein SBI CSP kholne ke liye minimum 10th pass aur dukaan ki jagah chahiye. Hamari team se turant baat karne ke liye DM mein apna number share karein.`;
  }
}

/* ----------------------------------- CSV ------------------------------------ */

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(rows: LeadRow[], statusLabel: (s: LeadStatus) => string): string {
  const header = ['Name', 'Handle', 'Location', 'Campaign', 'Content Source', 'AI Score', 'Status', 'Lead Source', 'Last Contact', 'First Message'];
  const lines = rows.map((r) =>
    [r.name, `@${r.handle}`, r.location, r.campaignName, r.contentLabel ?? '—', r.score, statusLabel(r.status), leadSourceLabel(r.source), r.lastContact, r.firstMessage]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\r\n');
}

/** Triggers a client-side download of `text` (demo data only — nothing leaves the browser). */
export function downloadTextFile(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
