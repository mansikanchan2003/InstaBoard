import { cn } from '@/lib/format';

/** Horizontal labelled bars (age brackets, geographies, lead channels…). */
export function BarList({
  items,
  barClassName = 'bg-primary-container',
  valueSuffix = '%',
  max,
  className,
}: {
  items: Array<{ label: string; value: number; display?: string; sublabel?: string }>;
  barClassName?: string;
  valueSuffix?: string;
  max?: number;
  className?: string;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
            <span className="text-text-primary font-medium truncate">
              {i.label}
              {i.sublabel && <span className="text-text-tertiary font-normal ml-1">{i.sublabel}</span>}
            </span>
            <span className="text-text-primary font-semibold tnum">{i.display ?? `${i.value}${valueSuffix}`}</span>
          </div>
          <div className="h-1.5 w-full bg-surface-card-subtle rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', barClassName)} style={{ width: `${(i.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
