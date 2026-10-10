import { cn } from '@/lib/format';

/**
 * Material Symbols Outlined icon (the icon set used throughout the Stitch export).
 * Size with Tailwind text-[NNpx] classes, exactly like the exported markup.
 */
export function Icon({ name, className, filled, label }: { name: string; className?: string; filled?: boolean; label?: string }) {
  return (
    <span
      className={cn('material-symbols-outlined', filled && 'icon-filled', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}
