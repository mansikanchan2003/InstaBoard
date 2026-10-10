/** Formatting helpers shared by every screen. Keep number display consistent with the Stitch designs. */

/** 842000 -> "842K", 2840000 -> "2.84M", 6410 -> "6,410" (below 10K keeps separators). */
export function formatCompact(value: number | null | undefined, opts: { fullBelow?: number } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const fullBelow = opts.fullBelow ?? 10_000;
  const abs = Math.abs(value);
  if (abs < fullBelow) return formatNumber(value);
  if (abs >= 1_000_000) return `${trim((value / 1_000_000).toFixed(2))}M`;
  if (abs >= 100_000) return `${trim((value / 1_000).toFixed(0))}K`;
  return `${trim((value / 1_000).toFixed(1))}K`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US');
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatDelta(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-10-03" -> "Oct 03, 2024" */
export function formatDate(iso: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const base = `${MONTHS[m - 1]} ${String(d).padStart(2, '0')}`;
  return opts.year === false ? base : `${base}, ${y}`;
}

/** Range label used by campaign tables: "Oct 01 - Oct 31". */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  return `${formatDate(start, { year: false })} - ${formatDate(end, { year: false })}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
