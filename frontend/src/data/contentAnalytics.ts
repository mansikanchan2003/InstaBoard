import type { ContentAnalytics, RetentionPoint } from '@/types/content';
import { media } from './media';

/**
 * DEMO DATA — per-content breakdowns for the Reel / Content Analytics screen, keyed by content id.
 * Canonical totals (views 412K, reach 210K, leads 98 … for the SBI CSP Mitra reel) live in
 * src/data/content.ts and are never repeated here: watch-time totals, funnel percentages, rates
 * and follower splits are derived from them at render time.
 *
 * Only a few items have detailed analytics. Everything else falls back to canonical KPIs plus a
 * "Detailed analytics not available in the demo dataset" notice.
 */

/**
 * Deterministic retention curve for reels without frame-level data in the export: exponential
 * decay from 100% that lands exactly on the item's canonical completion rate.
 */
function buildRetentionCurve(durationSec: number, completionPct: number, step: number, benchmarkCompletionPct: number): RetentionPoint[] {
  const curve = (t: number, final: number, k: number) => 100 - ((100 - final) * (1 - Math.exp(-k * t))) / (1 - Math.exp(-k * durationSec));
  const seconds: number[] = [];
  for (let s = 0; s < durationSec; s += step) seconds.push(s);
  seconds.push(durationSec);
  return seconds.map((s) => ({
    second: s,
    retention: Number(curve(s, completionPct, 3.2 / durationSec).toFixed(1)),
    benchmark: Number(curve(s, benchmarkCompletionPct, 4.4 / durationSec).toFixed(1)),
  }));
}

/** Frame-by-frame points from the Reel Analytics export (0–18s, 100% → 42.6%). */
const sbiMitraRetention: RetentionPoint[] = [
  { second: 0, retention: 100, benchmark: 100 },
  { second: 2, retention: 91, benchmark: 78 },
  { second: 4, retention: 82, benchmark: 62 },
  { second: 6, retention: 74, benchmark: 50 },
  { second: 8, retention: 67, benchmark: 40 },
  { second: 10, retention: 61, benchmark: 33 },
  { second: 12, retention: 56, benchmark: 28 },
  { second: 14, retention: 51, benchmark: 24 },
  { second: 16, retention: 47, benchmark: 21 },
  { second: 18, retention: 42.6, benchmark: 18 },
];

export const contentAnalytics: Record<string, ContentAnalytics> = {
  'sbi-csp-mitra-reel': {
    contentId: 'sbi-csp-mitra-reel',
    previewImage: media.reelVideoPreviewSbiCsp,
    resolution: '1080×1920',
    audioLabel: 'Original Audio - Eko Financial Services',
    viewsDeltaPct: 19.4,
    engagementDeltaPct: 0.8,
    verdict: {
      title: 'High-Attribution Anchor Reel',
      body: 'This Reel is driving over half (52.7%) of the verified agent leads for the October campaign. Its 18-second condensed format outperforms 60-second narrative explainers by 2.4x in direct bio-link conversions.',
    },
    watch: {
      avgWatchSec: 7.8,
      avgWatchNote: '+1.4s vs industry avg',
      completionNote: '1.8x FinTech Benchmark',
      lengthNote: 'Optimal short-form bracket',
      retention: sbiMitraRetention,
      dropZone: { start: 7, end: 10, label: 'DROP ZONE: -13% (Text Screen)' },
      hookSecond: 4,
      segments: [
        { start: 0, end: 4, label: 'Hook & Kiosk Visual', tone: 'neutral' },
        { start: 4, end: 7, label: 'Monthly Earnings Pitch', tone: 'neutral' },
        { start: 7, end: 10, label: 'Eligibility Criteria Text', tone: 'drop' },
        { start: 10, end: 14, label: 'Device Demonstration', tone: 'neutral' },
        { start: 14, end: 18, label: 'Bio Link CTA Outro', tone: 'cta' },
      ],
      insights: [
        {
          tone: 'positive',
          title: 'Strong Hook (0s–4s)',
          body: 'Most viewers (82%) remain engaged through the first 4 seconds due to the clear SBI kiosk income value proposition and local shop opening shot.',
          tag: '+14% vs fintech norm',
        },
        {
          tone: 'warning',
          title: 'Drop-off Friction (7s–10s)',
          body: 'The largest drop (13%) occurs between 7–10 seconds when complex eligibility criteria text appears on screen. Recommend shifting text to voiceover.',
          tag: 'Actionable optimization point',
        },
        {
          tone: 'info',
          title: 'Completion Surge',
          body: '42.6% of viewers watched the Reel to completion, which is 1.8x above the financial services benchmark, guaranteeing high CTA exposure.',
          tag: 'Top quintile performance',
        },
      ],
      confidencePct: 96,
    },
    discovery: {
      followerSharePct: 38,
      traffic: [
        { label: 'Reels Tab (Algorithmic Recommendation)', share: 54 },
        { label: 'Explore Feed', share: 28 },
        { label: 'Home Feed (Subscribers)', share: 14 },
        { label: 'Profile Visits / Direct Shares', share: 4 },
      ],
      profileVisits: 2_355,
      newFollows: 628,
    },
    audience: {
      gender: { male: 50, female: 48, unknown: 2 },
      age: [
        { label: '25–34', share: 38, note: 'Prime CSP' },
        { label: '35–44', share: 24 },
        { label: '18–24', share: 22 },
        { label: '45–54', share: 11 },
        { label: '55+', share: 5 },
      ],
      states: [
        { label: 'Uttar Pradesh', share: 34 },
        { label: 'Haryana', share: 19 },
        { label: 'Delhi NCR', share: 16 },
        { label: 'Bihar', share: 14 },
        { label: 'Rajasthan', share: 9 },
      ],
      ruralShareLabel: '82% Rural/Semi-Urban',
      alignmentPct: 94.2,
    },
    comments: [
      {
        id: 'cmt-ramesh-csp',
        handle: 'ramesh_csp',
        name: 'Ramesh Kumar',
        location: 'Gorakhpur, UP',
        ago: '2h ago',
        text: 'How can I apply for this SBI CSP in Gorakhpur? I already have a computer shop near bus stand.',
        score: 94,
        classification: 'AI-CLASSIFIED',
        sentiment: 'Positive',
        intent: 'High Purchase Intent',
        potential: 'High',
        leadId: 'lead-ramesh-csp',
      },
      {
        id: 'cmt-anita-finance',
        handle: 'anita_finance',
        name: 'Anita Sharma',
        location: 'Lucknow, UP',
        ago: '5h ago',
        text: 'Is there any eligibility criteria or minimum kiosk space needed? Please share registration link.',
        score: 88,
        classification: 'AI-INFERRED',
        sentiment: 'Inquisitive',
        intent: 'Qualification Inquiry',
        potential: 'High',
      },
      {
        id: 'cmt-suresh-kumar-up',
        handle: 'suresh_kumar_up',
        name: 'Suresh Kumar',
        location: 'Basti, UP',
        ago: '1d ago',
        text: 'Can this be started from my village in Basti district? What documents are required?',
        score: 79,
        classification: 'AI-CLASSIFIED',
        sentiment: 'Positive',
        intent: 'Geographic Availability',
        potential: 'Medium-High',
      },
    ],
    leadAttribution: {
      channels: [
        { label: 'Comments Auto-Captured', leads: 39, dotClassName: 'bg-primary-container' },
        { label: 'Instagram Direct Messages (DMs)', leads: 35, dotClassName: 'bg-slate-700' },
        { label: 'CTA Link in Bio Application', leads: 24, dotClassName: 'bg-sky-500' },
      ],
      engagedViewers: 32_140,
      engagedThresholdLabel: 'Engaged Viewers (>6s)',
    },
    audit: {
      benchmarkNote: 'Synthesized against 45 previous fintech Reels published across FY 2024.',
      confidencePct: 98.4,
      scores: [
        { label: 'Hook Rating', value: 'Strong', detail: '(82%)', footnote: '4-second retention', tone: 'positive' },
        { label: 'Retention Index', value: 'Above Avg', detail: '(+18%)', footnote: 'Campaign comparison', tone: 'positive' },
        { label: 'Engagement Velocity', value: 'High', footnote: 'Interaction / reach', tone: 'neutral', derive: 'engagementRate' },
        { label: 'Lead Generation', value: 'Very Strong', footnote: 'Rank among all content', tone: 'primary', derive: 'leadsRank' },
      ],
      recommendation: {
        title: 'Actionable Editorial Recommendation for Next Production Cycle',
        body: 'Create 2 additional short-form follow-up Reels (< 20s) utilizing the exact same opening hook structure and localized Hindi narration. Directly address the recurring inquiry themes identified in comment clusters. This will eliminate the 7s–10s drop-off while qualifying higher intent leads before CRM ingestion.',
        highlights: ['Minimum kiosk shop square footage required', 'Basic documentation checklist (Aadhaar & PAN)'],
      },
    },
  },

  'become-an-sbi-csp-today': {
    contentId: 'become-an-sbi-csp-today',
    resolution: '1080×1920',
    audioLabel: 'Original Audio - Eko Financial Services',
    viewsDeltaPct: 6.2,
    engagementDeltaPct: 0.3,
    verdict: {
      title: 'Strong Explainer, Long Tail',
      body: 'This 58-second walkthrough holds attention well for an explainer but loses a third of viewers during the documents checklist. Its saves rate is the highest of the October creatives, suggesting viewers bookmark it as a reference guide.',
    },
    watch: {
      avgWatchSec: 24.1,
      avgWatchNote: '+3.2s vs long-form avg',
      completionNote: '1.3x FinTech Benchmark',
      lengthNote: 'Long-form explainer bracket',
      retention: buildRetentionCurve(58, 31.4, 6, 14),
      dropZone: { start: 20, end: 34, label: 'DROP ZONE: Documents checklist' },
      segments: [
        { start: 0, end: 6, label: 'Hook & Promise', tone: 'neutral' },
        { start: 6, end: 20, label: 'Application Walkthrough', tone: 'neutral' },
        { start: 20, end: 34, label: 'Documents Checklist Text', tone: 'drop' },
        { start: 34, end: 50, label: 'Kiosk Activation Demo', tone: 'neutral' },
        { start: 50, end: 58, label: 'Bio Link CTA Outro', tone: 'cta' },
      ],
      insights: [
        { tone: 'positive', title: 'Reference-style saves', body: 'Saves are 1.7% of views — viewers keep this Reel as a how-to guide for the application process.', tag: 'Highest save rate in campaign' },
        { tone: 'warning', title: 'Checklist slowdown (20s–34s)', body: 'Dense on-screen document lists cause the steepest decline. Split the checklist into a carousel and link it from the caption.', tag: 'Actionable optimization point' },
        { tone: 'info', title: 'Late CTA exposure', body: 'Only about a third of viewers reach the bio-link outro at 50s. Consider a mid-roll CTA overlay around 15s.', tag: 'CTA placement' },
      ],
      confidencePct: 91,
    },
    discovery: {
      followerSharePct: 41,
      traffic: [
        { label: 'Reels Tab (Algorithmic Recommendation)', share: 47 },
        { label: 'Explore Feed', share: 24 },
        { label: 'Home Feed (Subscribers)', share: 22 },
        { label: 'Profile Visits / Direct Shares', share: 7 },
      ],
      profileVisits: 1_480,
      newFollows: 362,
    },
  },

  'daily-income-eko-csp-mitra': {
    contentId: 'daily-income-eko-csp-mitra',
    resolution: '1080×1920',
    audioLabel: 'Original Audio - Eko CSP Mitra',
    viewsDeltaPct: 11.8,
    engagementDeltaPct: -0.2,
    verdict: {
      title: 'Earnings Proof Drives Discovery',
      body: 'Real operator earnings resonate with non-followers: 65% of reach came from accounts that do not follow @ekoindia. Engagement is slightly below format average because the commission slab text slows the middle section.',
    },
    watch: {
      avgWatchSec: 17.9,
      avgWatchNote: '+2.1s vs industry avg',
      completionNote: '1.5x FinTech Benchmark',
      lengthNote: 'Mid-length short-form bracket',
      retention: buildRetentionCurve(38, 38.2, 4, 16),
      dropZone: { start: 14, end: 22, label: 'DROP ZONE: Commission slab text' },
      segments: [
        { start: 0, end: 5, label: 'Operator Intro', tone: 'neutral' },
        { start: 5, end: 14, label: 'Commission Breakdown', tone: 'neutral' },
        { start: 14, end: 22, label: 'Transaction Slab Text', tone: 'drop' },
        { start: 22, end: 32, label: 'Day-end Earnings Reveal', tone: 'neutral' },
        { start: 32, end: 38, label: 'Apply CTA', tone: 'cta' },
      ],
      insights: [
        { tone: 'positive', title: 'Authentic operator hook', body: 'Opening with a real CSP operator keeps retention above benchmark for the first 10 seconds.', tag: '+11% vs fintech norm' },
        { tone: 'warning', title: 'Slab text friction (14s–22s)', body: 'The commission slab table is hard to read on mobile. Replace it with spoken highlights and one simple number.', tag: 'Actionable optimization point' },
        { tone: 'info', title: 'Earnings reveal re-engages', body: 'The day-end earnings reveal flattens the drop-off curve — viewers who reach 22s mostly stay to the CTA.', tag: 'Retain structure' },
      ],
      confidencePct: 89,
    },
    discovery: {
      followerSharePct: 35,
      traffic: [
        { label: 'Reels Tab (Algorithmic Recommendation)', share: 58 },
        { label: 'Explore Feed', share: 25 },
        { label: 'Home Feed (Subscribers)', share: 13 },
        { label: 'Profile Visits / Direct Shares', share: 4 },
      ],
      profileVisits: 1_910,
      newFollows: 540,
    },
  },

  'digital-banking-rural-india': {
    contentId: 'digital-banking-rural-india',
    resolution: '1080×1350',
    viewsDeltaPct: 4.1,
    engagementDeltaPct: 0.4,
    verdict: {
      title: 'Useful Safety Carousel',
      body: 'The 4-slide security carousel earns steady shares from existing followers. Slide-level swipe-through data is not part of the demo dataset, so only discovery and engagement are analysed here.',
    },
    discovery: {
      followerSharePct: 54,
      traffic: [
        { label: 'Home Feed (Subscribers)', share: 46 },
        { label: 'Explore Feed', share: 31 },
        { label: 'Profile Visits', share: 15 },
        { label: 'Direct Shares', share: 8 },
      ],
      profileVisits: 640,
      newFollows: 118,
    },
  },
};
