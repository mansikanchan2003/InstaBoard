import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Client-side sorting + pagination for demo tables.
 * `accessors` maps a sort key to a comparable value (null sorts last).
 */
export function useTable<T, K extends string>(
  rows: T[],
  options: {
    accessors: Record<K, (row: T) => string | number | null | undefined>;
    initialSort?: SortState<K>;
    pageSize?: number;
  },
) {
  const [sort, setSort] = useState<SortState<K> | undefined>(options.initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options.pageSize ?? 10);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = options.accessors[sort.key];
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return va > vb ? dir : -dir;
    });
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize]);

  const toggleSort = (key: K) => {
    setSort((prev) => (prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' }));
    setPage(1);
  };

  return {
    rows: pageRows,
    allRows: sorted,
    sort,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
    pageCount,
    total: sorted.length,
    rangeStart: sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, sorted.length),
  };
}
