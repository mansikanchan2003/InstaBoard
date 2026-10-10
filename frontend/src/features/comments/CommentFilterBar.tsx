import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary } from '@/types/comments';
import type { Campaign, ContentItem, InstagramAccount } from '@/types/domain';
import { defaultFilters, pct, presets, type CommentFilters, type PresetKey } from './commentMeta';

const selectCls = 'w-full h-8 text-label-sm font-label-sm bg-surface-card border border-border-strong rounded text-text-primary px-2 pr-7 focus:outline-none focus:border-border-focused cursor-pointer';

function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-label-code font-label-code text-text-secondary uppercase mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Section 1.1 of the export: deep filter bar + quick presets. */
export function CommentFilterBar({
  filters,
  onChange,
  summary,
  campaigns,
  content,
  accounts,
  matching,
  sampleSize,
}: {
  filters: CommentFilters;
  onChange: (next: CommentFilters) => void;
  summary: CommentSummary;
  campaigns: Campaign[];
  content: ContentItem[];
  accounts: InstagramAccount[];
  matching: number;
  sampleSize: number;
}) {
  const set = <K extends keyof CommentFilters>(key: K, value: CommentFilters[K]) => onChange({ ...filters, [key]: value });
  const total = summary.totalComments;
  const commentCampaigns = campaigns.filter((c) => (c.metrics?.comments ?? 0) > 0);
  const contentOptions = content.filter((c) => c.metrics.comments > 0 && (filters.campaignId === 'all' || c.campaignId === filters.campaignId));
  const complaints = summary.intents.find((i) => i.intent === 'complaint')?.comments ?? 0;

  const presetActive = (key: PresetKey) => Object.entries(presets[key]).every(([k, v]) => filters[k as keyof CommentFilters] === v);
  const applyPreset = (key: PresetKey) => onChange(presetActive(key) ? { ...defaultFilters, search: filters.search } : { ...defaultFilters, search: filters.search, ...presets[key] });

  const presetButtons: Array<{ key: PresetKey; label: string }> = [
    { key: 'high-leads', label: `High Lead Inquiries (${formatNumber(summary.potentialLeads)})` },
    { key: 'complaints', label: `Negative Complaints (${formatNumber(complaints)})` },
    { key: 'awaiting', label: `Awaiting Staff Response (${formatNumber(summary.needsResponse)})` },
  ];

  return (
    <div className="bg-surface-card border border-border-strong rounded p-3 my-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <FilterField id="cf-account" label="Account">
          <select id="cf-account" className={selectCls} value={filters.accountId} onChange={(e) => set('accountId', e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.handle}
                {a.isPrimary ? ' (Official)' : ''}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id="cf-period" label="Date Range">
          <select id="cf-period" className={selectCls} value={filters.period} onChange={(e) => set('period', e.target.value as CommentFilters['period'])}>
            <option value="all">Oct 01 - Oct 31, 2024</option>
            <option value="7d">Last 7 days (to Oct 31)</option>
            <option value="24h">Last 24 hours</option>
          </select>
        </FilterField>
        <FilterField id="cf-campaign" label="Campaign">
          <select id="cf-campaign" className={selectCls} value={filters.campaignId} onChange={(e) => onChange({ ...filters, campaignId: e.target.value, contentId: 'all' })}>
            <option value="all">All Campaigns ({commentCampaigns.length})</option>
            {commentCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id="cf-content" label="Content">
          <select id="cf-content" className={selectCls} value={filters.contentId} onChange={(e) => set('contentId', e.target.value)}>
            <option value="all">All Reels &amp; Posts ({contentOptions.length})</option>
            {contentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id="cf-sentiment" label="Sentiment">
          <select id="cf-sentiment" className={selectCls} value={filters.sentiment} onChange={(e) => set('sentiment', e.target.value as CommentFilters['sentiment'])}>
            <option value="all">All Sentiments (100%)</option>
            <option value="positive">Positive ({pct(summary.sentiment.positive, total)})</option>
            <option value="neutral">Neutral ({pct(summary.sentiment.neutral, total)})</option>
            <option value="negative">Negative ({pct(summary.sentiment.negative, total)})</option>
          </select>
        </FilterField>
        <FilterField id="cf-intent" label="Intent Category">
          <select id="cf-intent" className={selectCls} value={filters.intent} onChange={(e) => set('intent', e.target.value as CommentFilters['intent'])}>
            <option value="all">All Intents ({summary.intents.length})</option>
            <option value="application">Application / Purchase</option>
            <option value="eligibility">Eligibility Question</option>
            <option value="product">Product Question</option>
            <option value="information">General Question</option>
            <option value="feedback">Feedback</option>
            <option value="complaint">Complaint</option>
            <option value="other">Spam / Off-topic</option>
          </select>
        </FilterField>
        <FilterField id="cf-potential" label="Lead Potential">
          <select id="cf-potential" className={selectCls} value={filters.potential} onChange={(e) => set('potential', e.target.value as CommentFilters['potential'])}>
            <option value="all">All Potential Levels</option>
            <option value="high">High (AI-Estimated)</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </FilterField>
        <FilterField id="cf-status" label="Response Status">
          <select id="cf-status" className={selectCls} value={filters.status} onChange={(e) => set('status', e.target.value as CommentFilters['status'])}>
            <option value="open">All Statuses (open)</option>
            <option value="needs_response">Needs Response ({formatNumber(summary.needsResponse)})</option>
            <option value="reviewed">Reviewed</option>
            <option value="responded">Responded ({formatNumber(summary.responded)})</option>
            <option value="resolved">Resolved ({formatNumber(summary.resolved)})</option>
            <option value="lead_created">Lead Created</option>
            <option value="archived">Archived</option>
          </select>
        </FilterField>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-2 border-t border-border-strong/60 text-body-sm font-body-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-label-sm font-label-sm text-text-secondary font-medium">Quick Preset:</span>
          {presetButtons.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={presetActive(p.key)}
              onClick={() => applyPreset(p.key)}
              className={cn(
                'px-2 py-0.5 rounded text-label-sm font-label-sm border transition-colors',
                presetActive(p.key)
                  ? 'bg-primary-container/20 text-on-primary-container font-semibold border-primary-container/40'
                  : 'bg-surface-card-subtle text-text-secondary hover:text-text-primary border-border-strong',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-text-tertiary flex-wrap">
          <Icon name="science" className="text-[14px]" />
          <span>
            Active filter set: <strong className="text-text-secondary tnum">{matching}</strong> of {sampleSize} sample comments ({formatNumber(total)} in period)
          </span>
          <button type="button" onClick={() => onChange(defaultFilters)} className="text-primary hover:underline font-semibold text-label-sm font-label-sm">
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
