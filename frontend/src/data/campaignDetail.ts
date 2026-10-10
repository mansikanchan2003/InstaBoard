import type { CampaignDetailExtras, CampaignProgression } from '@/types/campaigns';
import type { TrendPoint } from '@/types/domain';

/**
 * DEMO DATA — campaign-specific detail (Campaign Detail screen + Campaigns quick-view drawer).
 * Only SBI CSP October is fully populated, as in the Stitch export; other campaigns carry a
 * quick-view recommendation at most and the UI shows "not available in the demo dataset" states.
 */

const DAYS = 31;

/**
 * Deterministic cumulative series: daily increments follow a smooth wave (no randomness) and are
 * scaled so the last point equals the period total (e.g. Oct views end at 842K vs Sep 705K).
 */
function cumulative(total: number, baselineTotal: number, opts: { launchBoost?: number; phase?: number } = {}): TrendPoint[] {
  const boost = opts.launchBoost ?? 0.5;
  const phase = opts.phase ?? 0;
  const current = Array.from({ length: DAYS }, (_, i) => 1 + 0.18 * Math.sin(i / 1.9 + phase) + boost * Math.exp(-((i - 3) ** 2) / 6) + 0.25 * (i / DAYS));
  const previous = Array.from({ length: DAYS }, (_, i) => 1 + 0.1 * Math.sin(i / 2.4 + phase + 1) + 0.15 * (i / DAYS));
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const cs = total / sum(current);
  const ps = baselineTotal / sum(previous);
  let c = 0;
  let p = 0;
  return current.map((v, i) => {
    c += v * cs;
    p += previous[i] * ps;
    return { date: `Oct ${String(i + 1).padStart(2, '0')}`, current: Math.round(c), previous: Math.round(p) };
  });
}

/** Running engagement-rate average converging on the period value (5.42% vs 4.62%). */
function runningRate(final: number, baselineFinal: number): TrendPoint[] {
  return Array.from({ length: DAYS }, (_, i) => {
    const t = i / (DAYS - 1);
    const settle = 1 - Math.exp(-4 * t);
    const cur = final * (0.86 + 0.14 * settle) + 0.06 * Math.sin(i / 1.7) * (1 - t);
    const prev = baselineFinal * (0.9 + 0.1 * settle) + 0.04 * Math.sin(i / 2.2 + 1) * (1 - t);
    const last = i === DAYS - 1;
    return { date: `Oct ${String(i + 1).padStart(2, '0')}`, current: last ? final : Number(cur.toFixed(2)), previous: last ? baselineFinal : Number(prev.toFixed(2)) };
  });
}

/** SBI CSP October: Oct 1–31 vs Sep 1–30 baseline (totals match src/data/campaigns.ts metrics / baseline). */
const octoberProgression: CampaignProgression = {
  views: cumulative(842_000, 705_000, { launchBoost: 0.6 }),
  reach: cumulative(421_000, 360_000, { launchBoost: 0.5, phase: 0.6 }),
  engagement: runningRate(5.42, 4.62),
  leads: cumulative(186, 138, { launchBoost: 0.4, phase: 1.2 }),
};

export const campaignDetailExtras: CampaignDetailExtras[] = [
  {
    campaignId: 'sbi-csp-october',
    progression: octoberProgression,
    analysis: [
      { kind: 'working', text: "The campaign's strongest performance is coming from short-form Reels targeting 25–34 year-old viewers in Uttar Pradesh." },
      { kind: 'attention', text: 'Reach is growing faster than engagement, indicating that recent content is generating visibility but weaker interaction.' },
      { kind: 'opportunity', text: 'Questions about CSP eligibility are showing strong lead intent and should receive faster follow-up.' },
      { kind: 'recommendation', text: 'Produce more eligibility-focused Reels using the same opening structure as the highest-retention video.' },
    ],
    comments: {
      sentiment: { positive: 72, neutral: 21, negative: 7 },
      items: [
        {
          id: 'cc-ramesh-csp',
          handle: 'ramesh_csp',
          ago: '2h ago',
          contentRef: 'Reel #1',
          contentId: 'sbi-csp-mitra-reel',
          text: 'How can I apply for this SBI CSP in Gorakhpur?',
          aiInferred: true,
          intentLabel: 'High Application Intent',
          intentTone: 'emerald',
          note: 'Lead Potential: High',
          noteTone: 'primary',
          action: 'reply',
        },
        {
          id: 'cc-anita-finance',
          handle: 'anita_finance',
          ago: '5h ago',
          contentRef: 'Reel #2',
          contentId: 'become-an-sbi-csp-today',
          text: 'What is the minimum qualification and kiosk space needed?',
          aiInferred: true,
          intentLabel: 'High Lead Potential',
          intentTone: 'amber',
          note: 'Sentiment: Neutral / Inquisitive',
          noteTone: 'secondary',
          action: 'reply',
        },
        {
          id: 'cc-deepak-v',
          handle: 'deepak_v',
          ago: '1d ago',
          contentRef: 'Carousel #1',
          contentId: 'digital-banking-rural-india',
          text: 'Great initiative for rural banking coverage!',
          aiInferred: false,
          intentLabel: 'Positive Sentiment',
          intentTone: 'emerald',
          note: 'General Engagement',
          noteTone: 'tertiary',
          action: 'archive',
        },
      ],
    },
    quickViewRecommendation:
      'Reels creative #04 in Hindi generated 64% of total rural CSP signups. Recommend reallocating ₹15,000 ad spend to Reels formats.',
  },
  {
    campaignId: 'sbi-csp-mitra-recruitment',
    quickViewRecommendation: '"Daily Income" Reel drives 58% of this campaign\'s leads. Pin it to the profile grid and reuse its hook in the next creative.',
  },
  {
    campaignId: 'digital-banking-awareness',
    quickViewRecommendation: 'Completed with 64 leads. The AePS commission explainer Reel produced most of them — reuse its format for upcoming awareness pushes.',
  },
  {
    campaignId: 'financial-literacy-week',
    quickViewRecommendation: 'Highest engagement rate of all campaigns this period (5.84%). Consider turning the literacy tips into a recurring monthly series.',
  },
  {
    campaignId: 'rural-banking-access',
    quickViewRecommendation: 'Engagement is below the account benchmark. Refresh the creative with a Hindi voice-over Reel before resuming.',
  },
];
