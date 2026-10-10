import { contentItems } from './content';

/**
 * Headline of the AI Insight Detail export, derived from canonical content metrics so the
 * insight, notifications, activity log and report pages quote the same figure.
 * (The Stitch export said "3.8x in Lead Conversion", which the demo dataset does not support.)
 */
const leadsOf = (id: string) => contentItems.find((c) => c.id === id)?.metrics.leads ?? 0;

export const hindiReelsLeadMultiple = leadsOf('sbi-csp-mitra-reel') / Math.max(1, leadsOf('digital-banking-rural-india'));

export const HINDI_REELS_INSIGHT_TITLE = `Short-Form Hindi Reels Generate ${hindiReelsLeadMultiple.toFixed(1)}x More Leads Than Carousels`;
