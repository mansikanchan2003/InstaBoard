import { campaignStatusLabel } from '@/components/ui/Badge';
import { cn } from '@/lib/format';
import type { Campaign, CampaignStatus } from '@/types/domain';
import { STATUS_DOT, STATUS_ORDER } from './campaignUtils';

export type StatusFilter = 'all' | CampaignStatus;

/** Export: "CAMPAIGN STATUS FILTER CHIPS" with live counts. */
export function CampaignStatusChips({ campaigns, value, onChange }: { campaigns: Campaign[]; value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const count = (s: CampaignStatus) => campaigns.filter((c) => c.status === s).length;
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" role="tablist" aria-label="Filter by status">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'all'}
        onClick={() => onChange('all')}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors',
          value === 'all' ? 'bg-text-primary text-white shadow-sm' : 'bg-surface-card border border-border-strong text-text-secondary hover:text-text-primary hover:bg-surface-canvas',
        )}
      >
        <span>All</span>
        <span className={cn('px-1.5 rounded-full text-[10px]', value === 'all' ? 'bg-white/20' : 'text-text-tertiary')}>{campaigns.length}</span>
      </button>
      {STATUS_ORDER.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors',
              active ? 'bg-text-primary text-white shadow-sm' : 'bg-surface-card border border-border-strong text-text-secondary hover:text-text-primary hover:bg-surface-canvas',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[s])} />
            <span>{campaignStatusLabel(s)}</span>
            <span className={cn('text-[10px]', active ? 'px-1.5 rounded-full bg-white/20' : 'text-text-tertiary')}>{count(s)}</span>
          </button>
        );
      })}
    </div>
  );
}
