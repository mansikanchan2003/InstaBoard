import { leadStatusLabel } from '@/components/ui/Badge';
import { SearchInput, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import type { Campaign, LeadStatus } from '@/types/domain';
import { leadStatuses } from './leadUtils';

export interface LeadFilters {
  search: string;
  status: LeadStatus | 'all';
  campaignId: string;
}

export const emptyLeadFilters: LeadFilters = { search: '', status: 'all', campaignId: 'all' };

/** Search + status + campaign filters, plus an optional "content source" chip from `?content=`. */
export function LeadsFilters({
  filters,
  onChange,
  campaigns,
  contentChip,
  onClearContent,
  onReset,
  hasActive,
}: {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  campaigns: Campaign[];
  contentChip: string | null;
  onClearContent: () => void;
  onReset: () => void;
  hasActive: boolean;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2 p-3 border-b border-border-strong">
      <SearchInput
        containerClassName="w-full lg:w-72"
        placeholder="Search name, handle or location"
        aria-label="Search leads by name, handle or location"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Filter by pipeline status" value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as LeadFilters['status'] })}>
          <option value="all">All statuses</option>
          {leadStatuses.map((s) => (
            <option key={s} value={s}>
              {leadStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by campaign" value={filters.campaignId} onChange={(e) => onChange({ ...filters, campaignId: e.target.value })} className="max-w-[240px]">
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {contentChip && (
          <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-primary-container/15 border border-primary-container/40 text-[12px] font-semibold text-on-primary-container max-w-full">
            <span className="truncate">Source: {contentChip}</span>
            <button type="button" onClick={onClearContent} className="p-0.5 rounded-full hover:bg-primary-container/30" aria-label="Remove content source filter">
              <Icon name="close" className="text-[14px]" />
            </button>
          </span>
        )}
        {hasActive && (
          <button type="button" onClick={onReset} className="text-label-md font-semibold text-text-secondary hover:text-text-primary px-2">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
