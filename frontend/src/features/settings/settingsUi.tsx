import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { cn } from '@/lib/format';

/** Export field styles (Settings screen inputs use 4px radius + focus ring). */
export const inputCls =
  'w-full h-9 px-3 text-sm rounded bg-surface-card border border-border-strong text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focused font-medium';
export const labelCls = 'block font-label-sm text-label-sm text-text-primary mb-1';

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('bg-surface-card border border-border-strong rounded-lg p-5', className)}>{children}</div>;
}

/** Export-styled switch (brand amber or AI indigo track). */
export function Switch({
  checked,
  onChange,
  label,
  tone = 'brand',
  size = 'sm',
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: 'brand' | 'ai';
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const track = size === 'md' ? 'w-11 h-6' : 'w-10 h-5';
  const knob = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const shift = size === 'md' ? 'translate-x-5' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary',
        track,
        checked ? (tone === 'ai' ? 'bg-ai-accent' : 'bg-primary-container') : 'bg-slate-300',
      )}
    >
      <span className={cn('absolute top-[2px] left-[2px] bg-white border rounded-full transition-transform', knob, checked ? `${shift} border-white` : 'border-slate-300')} />
    </button>
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

/** Confirmation dialog for destructive / irreversible-looking actions. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  icon = 'warning',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={icon}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body-sm text-text-secondary space-y-2">{children}</div>
    </Modal>
  );
}

/** Masked secret placeholder — the prototype holds no real tokens or keys. */
export const MASKED_SECRET = '•••• demo';
