/**
 * Client-side CSV export of demo data (Blob + temporary <a download>). Nothing is sent anywhere.
 * Candidate for promotion to src/lib once other screens need it.
 */
export type CsvCell = string | number | null | undefined;

const escape = (cell: CsvCell) => {
  const s = cell === null || cell === undefined ? '' : String(cell);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
