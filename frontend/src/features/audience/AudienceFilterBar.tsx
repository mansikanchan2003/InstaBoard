import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { formatCompact, formatNumber } from '@/lib/format';
import type { AudienceFilters, AudiencePageData } from './model';

const selectWrap =
  'flex items-center gap-1 bg-surface-card border border-border-strong pl-2.5 rounded text-text-primary font-label-md text-label-md hover:border-slate-400 focus-within:border-border-focused max-w-full';
const selectCls = 'h-7 border-0 bg-transparent py-0 pl-0.5 pr-7 font-semibold text-label-md text-text-primary cursor-pointer focus:ring-0 focus:outline-none max-w-[220px] sm:max-w-[300px] truncate';

/** Account badge, campaign/content selects, compare toggle — plus the notice explaining what the filters change. */
export function AudienceFilterBar({ data, filters, onChange }: { data: AudiencePageData | undefined; filters: AudienceFilters; onChange: (f: AudienceFilters) => void }) {
  const campaigns = data?.campaigns.filter((c) => c.metrics) ?? [];
  const content = (data?.content ?? []).filter((c) => filters.campaignId === 'all' || c.campaignId === filters.campaignId);

  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-surface-canvas border border-border-strong px-2.5 py-1 rounded text-text-primary font-label-md text-label-md">
          <Icon name="alternate_email" className="text-[16px] text-text-secondary" />
          <span className="font-semibold">ekoindia</span>
        </div>
        <label className={selectWrap}>
          <span className="text-text-secondary font-normal shrink-0">Campaign:</span>
          <select
            aria-label="Campaign"
            className={selectCls}
            value={filters.campaignId}
            onChange={(e) => onChange({ ...filters, campaignId: e.target.value, contentId: 'all' })}
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={selectWrap}>
          <span className="text-text-secondary font-normal shrink-0">Content:</span>
          <select aria-label="Content" className={selectCls} value={filters.contentId} onChange={(e) => onChange({ ...filters, contentId: e.target.value })}>
            <option value="all">All Content</option>
            {content.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none pl-2">
          <input
            type="checkbox"
            checked={filters.compare}
            onChange={(e) => onChange({ ...filters, compare: e.target.checked })}
            className="w-4 h-4 rounded border-border-strong text-border-focused focus:ring-0"
          />
          <span className="font-label-md text-label-md text-text-secondary">Compare with Prev Period (Sep 01 - Sep 30)</span>
        </label>
      </div>
      <div className="flex items-center gap-2 text-text-secondary font-label-sm text-label-sm">
        <Icon name="info" className="text-[16px]" />
        <span>Source: demo dataset modelled on Instagram Insights (daily aggregation) — not fetched from Meta</span>
      </div>
    </div>
  );
}

/** Explains the effect of a campaign / content selection (per-slice demographics are not in the demo data). */
export function AudienceFilterNotice({ data, filters }: { data: AudiencePageData; filters: AudienceFilters }) {
  const item = filters.contentId !== 'all' ? data.content.find((c) => c.id === filters.contentId) : undefined;
  const campaign = filters.campaignId !== 'all' ? data.campaigns.find((c) => c.id === filters.campaignId) : undefined;
  if (!item && !campaign) return null;
  const profile = campaign ? data.intel.campaignProfiles.find((p) => p.campaignId === campaign.id) : undefined;

  if (item) {
    return (
      <Notice tone="demo" title={`Selected content: ${item.title}`}>
        {formatCompact(item.metrics.views)} views · {formatCompact(item.metrics.reach)} reach · {formatNumber(item.metrics.leads)} leads. A per-content audience
        breakdown isn't part of the demo dataset, so the sections below keep showing account-level audience figures.{' '}
        <Link to={`/content/${item.id}`} className="text-primary font-semibold hover:underline">
          Open content analytics →
        </Link>
      </Notice>
    );
  }
  if (!campaign) return null;
  return (
    <Notice tone="demo" title={`Selected campaign: ${campaign.name}`}>
      {campaign.metrics && (
        <>
          {formatCompact(campaign.metrics.views)} views · {formatCompact(campaign.metrics.reach)} reach · {formatNumber(campaign.metrics.leads)} leads.{' '}
        </>
      )}
      {profile ? (
        <>
          Campaign profile: {profile.nonFollowerPct}% non-followers, core age {profile.coreAge.label} ({profile.coreAge.share}%), dominant state {profile.dominantState.label} (
          {profile.dominantState.share}%). The detailed breakdowns below remain account-level.{' '}
        </>
      ) : (
        <>A per-campaign audience breakdown isn't in the demo dataset, so the sections below keep showing account-level figures. </>
      )}
      <Link to={`/campaigns/${campaign.id}`} className="text-primary font-semibold hover:underline">
        View campaign →
      </Link>
    </Notice>
  );
}
