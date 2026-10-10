import { useState, type ReactNode } from 'react';
import { cn, initials as toInitials } from '@/lib/format';
import { Icon } from './Icon';

/**
 * Image that degrades to a neutral branded placeholder when a remote demo URL fails
 * (the Stitch sample images are hosted remotely and may expire).
 */
export function ImageWithFallback({ src, alt, className, fallbackIcon = 'image' }: { src?: string; alt: string; className?: string; fallbackIcon?: string }) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div className={cn('bg-gradient-to-br from-amber-50 to-slate-100 flex items-center justify-center text-text-tertiary', className)} role="img" aria-label={alt}>
        <Icon name={fallbackIcon} className="text-[22px]" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={cn('object-cover', className)} onError={() => setFailed(true)} />;
}

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = { xs: 'w-6 h-6 text-[10px]', sm: 'w-7 h-7 text-[11px]', md: 'w-8 h-8 text-xs', lg: 'w-11 h-11 text-sm' }[size];
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover border border-border-strong shrink-0', dims, className)} onError={() => setFailed(true)} />;
  }
  return (
    <div
      className={cn('rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white font-bold flex items-center justify-center border border-border-strong shrink-0', dims, className)}
      aria-label={name}
      role="img"
    >
      {toInitials(name)}
    </div>
  );
}

export function ProgressBar({ value, className, barClassName, label }: { value: number; className?: string; barClassName?: string; label?: string }) {
  return (
    <div
      className={cn('h-1.5 w-full bg-surface-card-subtle rounded-full overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full bg-primary-container', barClassName)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Small section label: "MAIN", "WHAT IS WORKING", etc. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-label-code text-label-code text-text-tertiary uppercase tracking-wider', className)}>{children}</span>;
}

/** Callout box for honest prototype disclaimers (e.g. "Meta authorization is not available here"). */
export function Notice({ tone = 'info', icon, title, children, className }: { tone?: 'info' | 'warning' | 'ai' | 'demo'; icon?: string; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: 'bg-status-completed-subtle border-status-completed/20 text-[#0369A1]',
    warning: 'bg-status-paused-subtle border-status-paused/30 text-[#92400E]',
    ai: 'bg-ai-subtle border-ai-border text-[#4338CA]',
    demo: 'bg-surface-card-subtle border-border-strong text-text-secondary',
  }[tone];
  const defaultIcon = { info: 'info', warning: 'warning', ai: 'auto_awesome', demo: 'science' }[tone];
  return (
    <div className={cn('flex items-start gap-2.5 border rounded-lg px-3 py-2.5 text-body-sm', styles, className)}>
      <Icon name={icon ?? defaultIcon} className="text-[18px] mt-px" />
      <div className="min-w-0">
        {title && <p className="font-semibold text-text-primary">{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : undefined, 'text-text-secondary')}>{children}</div>}
      </div>
    </div>
  );
}
