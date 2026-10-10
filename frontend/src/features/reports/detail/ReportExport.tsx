import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { cn, formatNumber } from '@/lib/format';
import type { ReportDetail, ReportSectionKey } from '@/types/reports';
import { reportCsvRows, toCsv } from '../reportCsv';

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

/** Component groups in the export modal → report sections they control in the print view. */
export const exportComponents: Array<{ key: string; label: (d: ReportDetail) => string; sections: ReportSectionKey[] }> = [
  { key: 'summary', label: () => 'Include Executive Performance Summary & Key Findings', sections: ['summary', 'kpis', 'recommendations'] },
  { key: 'charts', label: () => 'Include Video Retention & Pacing Telemetry Charts', sections: ['timeline', 'formats', 'audience'] },
  { key: 'tables', label: (d) => `Include Campaign & Creative Tables (${formatNumber(d.computed.totals.leads)} Leads)`, sections: ['campaigns', 'creatives'] },
];

const formats: Array<{ value: ExportFormat; icon: string; title: string; sub: string }> = [
  { value: 'pdf', icon: 'picture_as_pdf', title: 'PDF Report', sub: 'Print view → Save as PDF' },
  { value: 'csv', icon: 'csv', title: 'CSV Data', sub: 'Raw tabular data (demo)' },
  { value: 'xlsx', icon: 'table_view', title: 'Excel XLSX', sub: 'Needs backend' },
];

/** "Export Performance Report" modal from the export, with honest per-format behaviour. */
export function ExportModal({
  open,
  onClose,
  detail,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  detail: ReportDetail;
  onExport: (format: ExportFormat, excluded: ReportSectionKey[]) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [included, setIncluded] = useState<Record<string, boolean>>({ summary: true, charts: true, tables: true });
  useEffect(() => {
    if (open) setFormat('pdf');
  }, [open]);
  const csvBytes = new Blob([toCsv(reportCsvRows(detail))]).size;
  const excluded = exportComponents.filter((c) => !included[c.key]).flatMap((c) => c.sections);
  const info =
    format === 'csv'
      ? { text: `Expected file size: ${(csvBytes / 1024).toFixed(1)} KB`, status: 'Built in your browser', tone: 'text-status-active' }
      : format === 'pdf'
        ? { text: 'Opens your browser print dialog', status: 'Choose “Save as PDF”', tone: 'text-status-active' }
        : { text: 'Formatted workbooks are generated server-side', status: 'Requires the backend', tone: 'text-status-paused' };
  const action = format === 'csv' ? `Download CSV (${(csvBytes / 1024).toFixed(1)} KB)` : format === 'pdf' ? 'Open Print View' : 'Request XLSX';

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="file_download"
      title="Export Performance Report"
      subtitle={`${detail.report.code} • ${detail.report.title}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" icon={format === 'xlsx' ? 'info' : 'download'} onClick={() => onExport(format, excluded)}>
            {action}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider font-semibold">Select Output Format</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Output format">
            {formats.map((f) => {
              const on = format === f.value;
              return (
                <label
                  key={f.value}
                  className={cn(
                    'relative flex flex-col p-3 rounded-lg cursor-pointer transition-all',
                    on ? 'border-2 border-primary-container bg-amber-50/30' : 'border border-border-strong hover:border-slate-300 bg-white',
                  )}
                >
                  <input type="radio" className="sr-only" name="exportFormat" value={f.value} checked={on} onChange={() => setFormat(f.value)} />
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon name={f.icon} className={cn('text-[20px]', on ? 'text-brand-primary-hover' : 'text-text-tertiary')} />
                    {on && <span className="w-2 h-2 rounded-full bg-primary-container" />}
                  </div>
                  <span className="font-headline-sm text-xs font-bold text-text-primary">{f.title}</span>
                  <span className="font-body-sm text-[10px] text-text-secondary leading-tight mt-0.5">{f.sub}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="space-y-2.5">
          <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider font-semibold">Report Components &amp; Appendices</span>
          <div className="space-y-2 bg-surface-canvas p-3 rounded-lg border border-border-strong">
            {exportComponents.map((c) => (
              <label key={c.key} className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-text-primary focus:ring-0 w-4 h-4"
                  checked={included[c.key]}
                  onChange={(e) => setIncluded((s) => ({ ...s, [c.key]: e.target.checked }))}
                />
                <span className="font-medium">{c.label(detail)}</span>
              </label>
            ))}
            {format === 'csv' && <p className="text-[11px] text-text-tertiary">CSV always contains totals, campaign rows and creative rows.</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-surface-card-subtle border border-border-strong font-label-code text-[11px]">
          <span className="text-text-secondary">{info.text}</span>
          <span className={cn('inline-flex items-center gap-1 font-bold', info.tone)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {info.status}
          </span>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Print-friendly layout while the report page is mounted: only the report canvas prints (app chrome,
 * preview bar and action buttons are hidden), and sections unticked in the export modal are dropped.
 */
export function PrintStyles({ excluded }: { excluded: ReportSectionKey[] }) {
  const hide = excluded.map((s) => `[data-print-section="${s}"]`).join(',');
  return (
    <style>{`@media print {
  @page { margin: 12mm; }
  body * { visibility: hidden !important; }
  #report-print-root, #report-print-root * { visibility: visible !important; }
  #report-print-root { position: absolute; left: 0; top: 0; width: 100%; }
  #report-print-root .print\\:hidden { display: none !important; }
  #report-print-root > * { break-inside: avoid; }
  ${hide ? `${hide} { display: none !important; }` : ''}
}`}</style>
  );
}
