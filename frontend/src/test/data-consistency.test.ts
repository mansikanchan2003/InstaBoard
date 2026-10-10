import { accounts } from '@/data/accounts';
import { audienceSummary } from '@/data/audience';
import { campaigns } from '@/data/campaigns';
import { contentItems } from '@/data/content';
import { leadPipelineSummary, leads, octoberLeadFunnel } from '@/data/leads';
import { accountOverview, dailyTrends } from '@/data/overview';

/** Guards the "no conflicting totals between related screens" requirement for the demo dataset. */
describe('demo data consistency', () => {
  const withMetrics = campaigns.filter((c) => c.metrics);
  const sum = (key: keyof NonNullable<(typeof campaigns)[number]['metrics']>) => withMetrics.reduce((acc, c) => acc + c.metrics![key], 0);

  it('campaign totals never exceed account-level totals', () => {
    expect(sum('views')).toBeLessThanOrEqual(accountOverview.views.value);
    // Reach is unique accounts, so overlapping campaign audiences make the sum exceed account reach.
    // Only require that the largest single campaign stays within it.
    expect(Math.max(...withMetrics.map((c) => c.metrics!.reach))).toBeLessThanOrEqual(accountOverview.reach.value);
    expect(sum('likes')).toBeLessThanOrEqual(accountOverview.likes.value);
    expect(sum('comments')).toBeLessThanOrEqual(accountOverview.comments.value);
    expect(sum('shares')).toBeLessThanOrEqual(accountOverview.shares.value);
    expect(sum('saves')).toBeLessThanOrEqual(accountOverview.saves.value);
    expect(sum('leads')).toBeLessThanOrEqual(accountOverview.leads.value);
  });

  it('content metrics roll up within their campaign totals', () => {
    for (const c of withMetrics) {
      const items = contentItems.filter((i) => i.campaignId === c.id);
      const total = (k: 'views' | 'reach' | 'leads' | 'likes' | 'comments') => items.reduce((a, i) => a + i.metrics[k], 0);
      for (const k of ['views', 'reach', 'leads', 'likes', 'comments'] as const) {
        expect(total(k), `${c.id} ${k}`).toBeLessThanOrEqual(c.metrics![k]);
      }
    }
  });

  it('SBI CSP October creatives sum exactly to the campaign totals shown on Campaign Detail', () => {
    const oct = campaigns.find((c) => c.id === 'sbi-csp-october')!;
    const items = contentItems.filter((i) => i.campaignId === oct.id);
    expect(items).toHaveLength(4);
    expect(items.reduce((a, i) => a + i.metrics.views, 0)).toBe(oct.metrics!.views);
    expect(items.reduce((a, i) => a + i.metrics.reach, 0)).toBe(oct.metrics!.reach);
    expect(items.reduce((a, i) => a + i.metrics.leads, 0)).toBe(oct.metrics!.leads);
    const funnel = Object.values(octoberLeadFunnel).reduce((a, b) => a + b, 0);
    expect(funnel).toBe(oct.metrics!.leads);
  });

  it('references between entities resolve', () => {
    const campaignIds = new Set(campaigns.map((c) => c.id));
    const contentIds = new Set(contentItems.map((c) => c.id));
    const accountIds = new Set(accounts.map((a) => a.id));
    contentItems.forEach((i) => i.campaignId && expect(campaignIds.has(i.campaignId), i.id).toBe(true));
    leads.forEach((l) => {
      expect(campaignIds.has(l.campaignId), l.id).toBe(true);
      if (l.contentId) expect(contentIds.has(l.contentId), l.id).toBe(true);
    });
    campaigns.forEach((c) => expect(accountIds.has(c.accountId), c.id).toBe(true));
  });

  it('daily trend series add up to the KPI totals and are deterministic', () => {
    const total = dailyTrends.views.reduce((a, p) => a + p.current, 0);
    expect(Math.abs(total - accountOverview.views.value)).toBeLessThan(100);
    expect(dailyTrends.views).toHaveLength(31);
    const leadsTotal = dailyTrends.leads.reduce((a, p) => a + p.current, 0);
    expect(Math.abs(leadsTotal - leadPipelineSummary.qualifiedLeads)).toBeLessThanOrEqual(15);
  });

  it('audience shares add up to 100%', () => {
    const g = audienceSummary.gender;
    expect(g.male + g.female + g.unknown).toBe(100);
    expect(audienceSummary.age.reduce((a, b) => a + b.share, 0)).toBe(100);
    expect(audienceSummary.topStates.reduce((a, b) => a + b.share, 0)).toBe(100);
    expect(audienceSummary.followers).toBe(accountOverview.followers);
  });
});
