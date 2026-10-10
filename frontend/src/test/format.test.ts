import { formatCompact, formatDate, formatDateRange, formatDelta, formatPercent, initials } from '@/lib/format';

describe('format helpers', () => {
  it('formats compact numbers like the Stitch designs', () => {
    expect(formatCompact(2_840_000)).toBe('2.84M');
    expect(formatCompact(842_000)).toBe('842K');
    expect(formatCompact(94_200)).toBe('94.2K');
    expect(formatCompact(6_410)).toBe('6,410');
    expect(formatCompact(null)).toBe('—');
  });

  it('formats percents, deltas and dates', () => {
    expect(formatPercent(5.42)).toBe('5.42%');
    expect(formatDelta(18.4)).toBe('+18.4%');
    expect(formatDelta(-2)).toBe('−2.0%');
    expect(formatDate('2024-10-03')).toBe('Oct 03, 2024');
    expect(formatDateRange('2024-10-01', '2024-10-31')).toBe('Oct 01 - Oct 31');
    expect(formatDateRange(null, null)).toBe('—');
    expect(initials('Priya Sharma')).toBe('PS');
  });
});
