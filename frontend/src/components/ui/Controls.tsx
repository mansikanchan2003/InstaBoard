import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

/* --------------------------------- Segmented ------------------------------- */

/** DESIGN.md segmented control: #F1F5F9 track, white active pill. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
  ariaLabel,
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  size?: 'xs' | 'sm';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('inline-flex items-center bg-surface-card-subtle border border-border-strong rounded-lg p-0.5 gap-0.5 overflow-x-auto no-scrollbar max-w-full', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded whitespace-nowrap transition-colors flex items-center gap-1',
              size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-label-md',
              active ? 'bg-surface-card text-text-primary font-semibold shadow-xs border border-border-strong' : 'text-text-secondary hover:text-text-primary font-medium border border-transparent',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="text-[10px] text-text-tertiary font-semibold">({o.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------- Tabs ---------------------------------- */

/** Underline tabs (Campaign Detail, Settings, Notifications). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  tabs: Array<{ value: T; label: ReactNode; icon?: string; count?: number; iconClassName?: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex items-center gap-1 border-b border-border-strong overflow-x-auto no-scrollbar', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'px-3 py-2.5 text-label-md whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 transition-colors',
              active ? 'border-primary-container text-text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary font-medium',
            )}
          >
            {t.icon && <Icon name={t.icon} className={cn('text-[16px]', t.iconClassName)} />}
            {t.label}
            {t.count !== undefined && <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-surface-card-subtle border border-border-strong text-text-secondary">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Inputs --------------------------------- */

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { containerClassName?: string }>(function SearchInput(
  { containerClassName, className, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', containerClassName)}>
      <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[18px] pointer-events-none" />
      <input
        ref={ref}
        type="search"
        className={cn(
          'w-full h-9 pl-8 pr-3 bg-surface-card border border-border-strong rounded-lg text-label-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0 focus:border-border-focused transition-all',
          className,
        )}
        {...rest}
      />
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-9 pl-3 pr-8 bg-surface-card border border-border-strong rounded-lg text-label-md text-text-primary focus:outline-none focus:ring-0 focus:border-border-focused cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full h-9 px-3 bg-surface-card border rounded-lg text-label-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0 transition-colors',
        invalid ? 'border-error focus:border-error' : 'border-slate-300 focus:border-border-focused',
        className,
      )}
      {...rest}
    />
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  required,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-label-sm text-text-primary font-semibold">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {error ? <p className="text-[11px] text-error font-medium" role="alert">{error}</p> : hint && <p className="text-[11px] text-text-tertiary">{hint}</p>}
    </div>
  );
}

/** Accessible switch. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer">
          {label && <span className="block text-label-md text-text-primary font-semibold">{label}</span>}
          {description && <span className="block text-body-sm text-text-secondary mt-0.5">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50',
          checked ? 'bg-primary-container' : 'bg-slate-300',
        )}
      >
        <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={cn('h-4 w-4 rounded border-slate-300 text-text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer', className)}
    />
  );
}

/* --------------------------------- Dropdown -------------------------------- */

/** Click-to-open menu (row actions, account switcher, date presets). Closes on outside click / Esc. */
export function Dropdown({
  trigger,
  children,
  align = 'right',
  className,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-40 mt-1 min-w-[12rem] bg-surface-card border border-slate-300 rounded-lg shadow-flyout py-1 animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, active }: { icon?: string; children: ReactNode; onClick: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-label-md text-left transition-colors',
        danger ? 'text-error hover:bg-red-50' : 'text-text-primary hover:bg-surface-canvas',
        active && 'bg-surface-container-low font-semibold',
      )}
    >
      {icon && <Icon name={icon} className="text-[16px] text-text-secondary" />}
      <span className="flex-1">{children}</span>
      {active && <Icon name="check" className="text-[16px] text-primary-container" />}
    </button>
  );
}
