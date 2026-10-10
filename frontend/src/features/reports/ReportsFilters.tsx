import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { InstagramAccount } from '@/types/domain';
import type { ReportStatus, ReportType } from '@/types/reports';
import { reportStatusMeta, reportTypeOptions } from './reportOptions';

export interface ReportFilters {
  search: string;
  type: 'all' | ReportType;
  status: 'all' | ReportStatus;
  account: string;
}

export const defaultReportFilters: ReportFilters = { search: '', type: 'all', status: 'all', account: 'acc-ekoindia' };

function LabeledSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 bg-white border border-border-strong rounded px-2.5 py-1.5">
      <span className="font-label-sm text-label-sm text-text-secondary">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-label-md text-label-md font-semibold text-text-primary bg-transparent border-0 p-0 pr-4 focus:ring-0 focus:outline-none cursor-pointer"
      >
        {children}
      </select>
    </label>
  );
}

export function ReportsFilterBar({ filters, onChange, accounts }: { filters: ReportFilters; onChange: (f: ReportFilters) => void; accounts: InstagramAccount[] }) {
  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => onChange({ ...filters, [key]: value });
  return (
    <section className="bg-surface-card p-3 rounded border border-border-strong shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      <div className="relative flex-1 lg:min-w-[280px]">
        <Icon name="search" className="absolute left-3 top-2.5 text-text-tertiary text-[18px] pointer-events-none" />
        <input
          type="search"
          aria-label="Search reports"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-body-md font-body-md bg-white border border-border-strong rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focused"
          placeholder="Search report name, ID, or campaign..."
        />
      </div>
      <div className="flex items-center flex-wrap gap-2.5">
        <LabeledSelect label="Type" value={filters.type} onChange={(v) => set('type', v as ReportFilters['type'])}>
          <option value="all">All Types</option>
          {reportTypeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Status" value={filters.status} onChange={(v) => set('status', v as ReportFilters['status'])}>
          <option value="all">All Statuses</option>
          {(Object.keys(reportStatusMeta) as ReportStatus[]).map((s) => (
            <option key={s} value={s}>
              {reportStatusMeta[s].filterLabel}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Account" value={filters.account} onChange={(v) => set('account', v)}>
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.handle}
              {a.isPrimary ? ' (Official)' : ''}
            </option>
          ))}
        </LabeledSelect>
        <button
          type="button"
          onClick={() => onChange(defaultReportFilters)}
          className="p-1.5 rounded hover:bg-surface-canvas text-text-secondary border border-border-strong"
          title="Reset Filters"
          aria-label="Reset filters"
        >
          <Icon name="restart_alt" className="text-[18px]" />
        </button>
      </div>
    </section>
  );
}
