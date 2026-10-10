import type { ReactNode } from 'react';
import { Notice } from '@/components/ui/Misc';
import { cn } from '@/lib/format';

/** Card shell used by the analytics sections (export: rounded-lg, p-5, header with bottom border). */
export function SectionCard({
  title,
  subtitle,
  addon,
  right,
  className,
  children,
  as: Tag = 'div',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  addon?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section';
}) {
  return (
    <Tag className={cn('bg-surface-card rounded-lg border border-border-strong p-5 shadow-sm min-w-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-border-strong">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-headline-sm font-headline-sm text-text-primary">{title}</h3>
            {addon}
          </div>
          {subtitle && <div className="text-body-sm font-body-sm text-text-secondary">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </Tag>
  );
}

/** Placeholder for sections without detailed analytics in the demo dataset. */
export function UnavailableSection({ title, className, reason }: { title: string; className?: string; reason?: ReactNode }) {
  return (
    <SectionCard title={title} className={className}>
      <Notice tone="demo" title="Detailed analytics not available in the demo dataset">
        {reason ?? 'This breakdown exists only for a few showcase creatives. Canonical totals for this item are shown in the KPI cards above.'}
      </Notice>
    </SectionCard>
  );
}
