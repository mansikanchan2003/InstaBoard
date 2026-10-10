import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { Campaign, CampaignStatus } from '@/types/domain';
import type { ReportMetricKey } from '@/types/reports';
import { metricOptions } from './reportOptions';

/** Building blocks of the "Create New Performance Report" drawer (export styling kept verbatim). */

export function FieldLabel({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('block font-label-sm text-label-sm uppercase tracking-wider text-text-secondary font-bold mb-1.5', className)}>
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] text-error font-medium mt-1" role="alert">
      {message}
    </p>
  );
}

const statusTag: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: 'ACTIVE', className: 'text-status-active font-bold' },
  completed: { label: 'COMPLETED', className: 'text-status-completed font-bold' },
  paused: { label: 'PAUSED', className: 'text-text-tertiary' },
  scheduled: { label: 'SCHEDULED · NO DATA', className: 'text-text-tertiary' },
  draft: { label: 'DRAFT · NO DATA', className: 'text-text-tertiary' },
};

export function CampaignPicker({
  campaigns,
  selected,
  onChange,
  error,
  disabled,
}: {
  campaigns: Campaign[];
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const selectable = campaigns.filter((c) => c.metrics);
  const allSelected = selectable.every((c) => selected.includes(c.id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary font-bold" id="campaign-selection-label">
          Campaign Selection
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(allSelected ? [] : selectable.map((c) => c.id))}
          className="font-label-code text-label-code text-primary font-bold hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {allSelected ? 'Clear selection' : `Select All (${selectable.length} Campaigns)`}
        </button>
      </div>
      {disabled && <p className="text-body-sm text-text-secondary mb-1.5">This report type covers the whole account (all campaigns + organic content).</p>}
      <div
        role="group"
        aria-labelledby="campaign-selection-label"
        className={cn('border rounded bg-surface-canvas p-3 space-y-2 max-h-56 overflow-y-auto custom-scrollbar', error ? 'border-error' : 'border-border-strong', disabled && 'opacity-60')}
      >
        {campaigns.map((c) => {
          const tag = statusTag[c.status];
          const noData = !c.metrics;
          return (
            <label key={c.id} className={cn('flex items-center gap-2.5 text-body-md text-text-primary', noData || disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <input
                type="checkbox"
                className="rounded border-border-strong text-text-primary focus:ring-0"
                checked={selected.includes(c.id)}
                disabled={noData || disabled}
                onChange={() => toggle(c.id)}
              />
              <span className={cn('font-medium', noData && 'text-text-tertiary')}>{c.name}</span>
              <span className={cn('ml-auto font-label-code text-label-code whitespace-nowrap', tag.className)}>{tag.label}</span>
            </label>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function MetricChips({ value, onChange, error }: { value: ReportMetricKey[]; onChange: (v: ReportMetricKey[]) => void; error?: string }) {
  return (
    <div>
      <span className="block font-label-sm text-label-sm uppercase tracking-wider text-text-secondary font-bold mb-2" id="metrics-label">
        Metrics &amp; Vectors
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="metrics-label">
        {metricOptions.map((m) => {
          const on = value.includes(m.value);
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== m.value) : [...value, m.value])}
              className={cn(
                'px-2.5 py-1 rounded text-label-sm font-semibold flex items-center gap-1 transition-colors',
                on ? 'bg-text-primary text-white' : 'bg-white border border-border-strong text-text-secondary hover:border-border-focused',
              )}
            >
              {on ? m.label : `+ ${m.label}`}
              {on && <Icon name="check" className="text-[14px]" />}
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function CheckRow({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex items-center gap-1.5 cursor-pointer', className)}>
      <input type="checkbox" className="rounded border-border-strong text-text-primary focus:ring-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
