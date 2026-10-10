import { useNavigate } from 'react-router-dom';
import { KpiCard } from '@/components/ui/KpiCard';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { AccountOverview, Campaign } from '@/types/domain';
import { activeCampaigns, campaignsEndingSoon } from './selectors';

/** The eight primary KPI tiles (lg:grid-cols-8 in the export). */
export function DashboardKpis({ overview, campaigns }: { overview: AccountOverview; campaigns: Campaign[] | undefined }) {
  const navigate = useNavigate();
  const active = campaigns ? activeCampaigns(campaigns).length : undefined;
  const endingSoon = campaigns ? campaignsEndingSoon(campaigns).length : undefined;
  const shares = overview.shares.value;
  const saves = overview.saves.value;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      <KpiCard
        label="Active Campaigns"
        value={active ?? '—'}
        footnote={endingSoon === undefined ? undefined : endingSoon === 0 ? 'None ending this week' : `${endingSoon} ending this week`}
        onClick={() => navigate('/campaigns')}
      />
      <KpiCard label="Total Views" value={formatCompact(overview.views.value)} delta={overview.views.delta} />
      <KpiCard label="Total Reach" value={formatCompact(overview.reach.value)} delta={overview.reach.delta} />
      <KpiCard label="Engagement Rate" value={formatPercent(overview.engagementRate.value)} delta={overview.engagementRate.delta} />
      <KpiCard label="Total Likes" value={formatCompact(overview.likes.value)} delta={overview.likes.delta} deltaLabel="vs prev" />
      <KpiCard label="Total Comments" value={formatNumber(overview.comments.value)} delta={overview.comments.delta} deltaLabel="spike" />
      <KpiCard label="Shares & Saves" value={formatCompact(shares + saves)} footnote={`${formatCompact(shares)} / ${formatCompact(saves)}`} />
      <KpiCard
        label="Leads Generated"
        value={formatNumber(overview.leads.value)}
        delta={overview.leads.delta}
        icon="stars"
        highlight
        onClick={() => navigate('/leads')}
      />
    </div>
  );
}
