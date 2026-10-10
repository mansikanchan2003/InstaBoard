import type { AccountOverview, TrendMetric, TrendPoint } from '@/types/domain';

/**
 * DEMO DATA — account-level totals for @ekoindia, Oct 1–31 2024 (Dashboard + Content Library KPIs).
 * These include organic content, so they are >= the sum of campaign metrics in campaigns.ts.
 */
export const accountOverview: AccountOverview = {
  accountId: 'acc-ekoindia',
  followers: 86_400,
  totalContent: 10,
  views: { value: 2_840_000, delta: 18.4, baseline: 2_400_000 },
  reach: { value: 1_420_000, delta: 14.2, baseline: 1_240_000 },
  engagementRate: { value: 4.82, delta: 0.6, baseline: 4.2 },
  likes: { value: 94_200, delta: 9.8 },
  comments: { value: 6_410, delta: 22.1 },
  shares: { value: 18_900, delta: 12.4 },
  saves: { value: 12_400, delta: 16.0 },
  leads: { value: 482, delta: 31.2, target: 400 },
  watchTimeHours: { value: 18_420, delta: 22.1 },
  aiHealthScore: 92,
};

/* ------------------------------------------------------------------------------------------
 * Daily trend series. Generated once at module load from a fixed seed, so values are
 * deterministic and never change between renders. Each current-period series sums to the
 * KPI total above (e.g. daily views sum to 2.84M ≈ 91,612/day, peaking on Oct 18).
 * ---------------------------------------------------------------------------------------- */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildSeries(opts: { total: number; baselineTotal: number; growth: number; seed: number; peakDay?: number; decimals?: number }) {
  const days = 31;
  const rnd = seeded(opts.seed);
  const raw = Array.from({ length: days }, (_, i) => {
    const t = i / (days - 1);
    const wave = 1 + 0.12 * Math.sin(i / 2.1) + (rnd() - 0.5) * 0.18;
    const spike = opts.peakDay !== undefined ? Math.exp(-((i + 1 - opts.peakDay) ** 2) / 3) * 0.55 : 0;
    return (1 + opts.growth * t) * wave + spike;
  });
  const prevRaw = Array.from({ length: days }, (_, i) => (1 + opts.growth * 0.4 * (i / (days - 1))) * (1 + (rnd() - 0.5) * 0.1));
  const scale = opts.total / raw.reduce((a, b) => a + b, 0);
  const prevScale = opts.baselineTotal / prevRaw.reduce((a, b) => a + b, 0);
  const round = (v: number) => (opts.decimals ? Number(v.toFixed(opts.decimals)) : Math.round(v));
  return raw.map<TrendPoint>((v, i) => ({
    date: `Oct ${i + 1}`,
    current: round(v * scale),
    previous: round(prevRaw[i] * prevScale),
  }));
}

/** Engagement rate is an average, not a sum: scale so the mean equals the KPI. */
function buildRateSeries(mean: number, baselineMean: number, seed: number): TrendPoint[] {
  return buildSeries({ total: mean * 31, baselineTotal: baselineMean * 31, growth: 0.25, seed, decimals: 2 });
}

export const dailyTrends: Record<TrendMetric, TrendPoint[]> = {
  views: buildSeries({ total: 2_840_000, baselineTotal: 2_400_000, growth: 0.9, seed: 11, peakDay: 18 }),
  reach: buildSeries({ total: 1_420_000, baselineTotal: 1_240_000, growth: 0.8, seed: 23, peakDay: 18 }),
  engagement: buildRateSeries(4.82, 4.2, 37),
  leads: buildSeries({ total: 482, baselineTotal: 367, growth: 1.2, seed: 41, peakDay: 21 }),
  shares: buildSeries({ total: 18_900, baselineTotal: 16_800, growth: 0.7, seed: 53, peakDay: 18 }),
  watchTime: buildSeries({ total: 18_420, baselineTotal: 15_090, growth: 0.8, seed: 67, peakDay: 18 }),
};

/** Sidebar badge counts (Comments: comments awaiting review; Leads: qualified leads this period). */
export const navCounts = { comments: 142, leads: 482 } as const;
