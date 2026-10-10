import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';

/** Campaign Detail section shell: white card, icon + title row with a bottom rule and an optional "View all →" link. */
export function SectionCard({
  icon,
  iconClassName,
  iconFilled,
  title,
  titleSize = 'md',
  addon,
  link,
  className,
  headerClassName,
  children,
}: {
  icon: string;
  iconClassName?: string;
  iconFilled?: boolean;
  title: string;
  titleSize?: 'sm' | 'md';
  addon?: ReactNode;
  link?: { to: string; label: string };
  className?: string;
  headerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('bg-surface-card border border-border-strong rounded p-5', className)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b border-border-strong', titleSize === 'md' ? 'pb-4' : 'pb-3', headerClassName)}>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Icon name={icon} filled={iconFilled} className={cn('text-text-primary', iconClassName)} />
          <h2 className={cn('text-text-primary font-bold', titleSize === 'md' ? 'font-headline-md text-headline-md' : 'font-headline-sm text-headline-sm')}>{title}</h2>
          {addon}
        </div>
        {link && (
          <Link to={link.to} className="font-label-md text-label-md text-primary font-semibold hover:underline flex items-center gap-1">
            {link.label}
            <Icon name="arrow_forward" className="text-[14px]" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Inline "not available" message used inside sections when the demo dataset has no breakdown. */
export function UnavailableNote({ icon = 'info', children, className, flush }: { icon?: string; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cn(!flush && 'mt-4', 'flex items-start gap-2.5 p-3 rounded border border-dashed border-border-strong bg-surface-canvas text-body-sm text-text-secondary', className)}>
      <Icon name={icon} className="text-[18px] text-text-tertiary mt-px" />
      <div>{children}</div>
    </div>
  );
}
