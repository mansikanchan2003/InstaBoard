import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 font-label-sm text-label-sm text-text-secondary flex-wrap', className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            {c.to && !last ? (
              <Link to={c.to} className="hover:text-text-primary hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className={cn(last && 'text-text-primary font-semibold')} aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            )}
            {!last && <Icon name="chevron_right" className="text-[14px] text-text-tertiary" />}
          </span>
        );
      })}
    </nav>
  );
}

/** Standard page title block: optional breadcrumbs, title (+ addon badges), description, actions. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  titleAddon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  titleAddon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary">{title}</h1>
          {titleAddon}
        </div>
        {description && <p className="text-body-md text-text-secondary mt-1 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
