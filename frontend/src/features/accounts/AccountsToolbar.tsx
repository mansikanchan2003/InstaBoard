import { useId } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { AccountStatus, AccountType, InstagramAccount } from '@/types/domain';
import { dataLevelLabel, dataLevelOf, statusFilterLabel, type DataLevel } from './accountMeta';

export interface AccountFilters {
  search: string;
  status: AccountStatus | 'all';
  type: AccountType | 'all';
  level: DataLevel | 'all';
}

export const defaultAccountFilters: AccountFilters = { search: '', status: 'all', type: 'all', level: 'all' };

export function applyAccountFilters(accounts: InstagramAccount[], f: AccountFilters) {
  const q = f.search.trim().toLowerCase().replace(/^@/, '');
  return accounts.filter(
    (a) =>
      (f.status === 'all' || a.status === f.status) &&
      (f.type === 'all' || a.type === f.type) &&
      (f.level === 'all' || dataLevelOf(a) === f.level) &&
      (!q || a.displayName.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q) || a.externalId.toLowerCase().includes(q) || a.id.includes(q)),
  );
}

function InlineSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  const id = useId();
  return (
    <div className="flex items-center border border-border-strong rounded bg-white px-2.5 h-9 text-label-md font-label-md">
      <label htmlFor={id} className="text-text-secondary text-[12px] mr-1.5 whitespace-nowrap">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent border-0 py-0 pl-0 pr-6 text-text-primary font-semibold focus:ring-0 text-label-md cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Search + Status / Type / Data Level filters (with live counts) + "Sync All Accounts". */
export function AccountsToolbar({
  accounts,
  filters,
  onChange,
  onSyncAll,
  syncingAll,
}: {
  accounts: InstagramAccount[];
  filters: AccountFilters;
  onChange: (f: AccountFilters) => void;
  onSyncAll: () => void;
  syncingAll: boolean;
}) {
  const count = (pred: (a: InstagramAccount) => boolean) => accounts.filter(pred).length;
  const statuses: AccountStatus[] = ['connected', 'syncing', 'action_required', 'expired'];
  const levels: DataLevel[] = ['full', 'partial', 'none'];

  return (
    <section className="bg-surface-card border border-border-strong rounded p-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shadow-sm" aria-label="Filter accounts">
      <div className="relative flex-1 xl:max-w-md">
        <Icon name="search" className="absolute left-2.5 top-2 text-text-tertiary text-[18px] pointer-events-none" />
        <input
          type="search"
          aria-label="Search accounts"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full h-9 pl-8 pr-3 bg-white border border-border-strong rounded text-label-md font-label-md text-text-primary placeholder:text-text-tertiary focus:border-border-focused focus:ring-1 focus:ring-border-focused"
          placeholder="Search by @username, brand or account ID..."
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InlineSelect
          label="Status:"
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
          options={[
            { value: 'all', label: `All (${accounts.length})` },
            ...statuses.map((s) => ({ value: s, label: `${statusFilterLabel[s]} (${count((a) => a.status === s)})` })),
          ]}
        />
        <InlineSelect
          label="Type:"
          value={filters.type}
          onChange={(type) => onChange({ ...filters, type })}
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'business', label: `Business Account (${count((a) => a.type === 'business')})` },
            { value: 'creator', label: `Creator Account (${count((a) => a.type === 'creator')})` },
          ]}
        />
        <InlineSelect
          label="Data Level:"
          value={filters.level}
          onChange={(level) => onChange({ ...filters, level })}
          options={[{ value: 'all', label: 'All Availability' }, ...levels.map((l) => ({ value: l, label: `${dataLevelLabel[l]} (${count((a) => dataLevelOf(a) === l)})` }))]}
        />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onSyncAll}
          disabled={syncingAll}
          className="h-9 px-3 bg-surface-card-subtle hover:bg-slate-200 text-text-primary border border-border-strong rounded text-label-md font-label-md font-semibold flex items-center gap-1.5 transition disabled:opacity-60"
        >
          <Icon name={syncingAll ? 'progress_activity' : 'sync_alt'} className={syncingAll ? 'text-[16px] animate-spin' : 'text-[16px]'} />
          <span>Sync All Accounts</span>
        </button>
      </div>
    </section>
  );
}
