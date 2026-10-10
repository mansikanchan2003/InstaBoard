import { modeText } from '@/lib/config';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { accountService } from '@/services/accounts';
import { reportService } from '@/services/reports';
import { ReportConfigDrawer } from '@/features/reports/ReportConfigDrawer';
import { downloadLibraryCsv, downloadReportCsv } from '@/features/reports/reportCsv';
import { blankConfig, defaultSections, pickConfig } from '@/features/reports/reportOptions';
import { ReportsAiBanner } from '@/features/reports/ReportsAiBanner';
import { defaultReportFilters, ReportsFilterBar, type ReportFilters } from '@/features/reports/ReportsFilters';
import { ReportsKpis } from '@/features/reports/ReportsKpis';
import { canDownload, ReportsTable } from '@/features/reports/ReportsTable';
import type { Report, ReportConfig, ReportListItem } from '@/types/reports';

const headerBtn = 'flex items-center gap-1.5 bg-white hover:bg-surface-canvas border border-border-strong text-text-primary font-label-md text-label-md font-semibold px-3 py-2 rounded transition-colors shadow-xs';

function TableSkeleton() {
  return (
    <section className="bg-surface-card rounded border border-border-strong shadow-xs p-6 space-y-4 animate-pulse" role="status" aria-label="Loading reports">
      <div className="h-6 bg-slate-200 rounded w-1/4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded w-full" />
        ))}
      </div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-4 bg-slate-200 rounded w-32" />
        <div className="h-6 bg-slate-200 rounded w-24" />
      </div>
    </section>
  );
}

function EmptyReports({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="bg-surface-card rounded border border-border-strong shadow-xs p-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-surface-canvas border border-border-strong flex items-center justify-center text-text-tertiary mb-3">
        <Icon name="description" className="text-[28px]" />
      </div>
      <h3 className="font-headline-sm text-headline-sm font-bold text-text-primary">No reports generated for this filter</h3>
      <p className="font-body-md text-body-md text-text-secondary max-w-sm mx-auto mt-1 mb-4">
        There are no reports matching your selected criteria. Try adjusting your date range or create a new one.
      </p>
      <button type="button" onClick={onCreate} className="inline-flex items-center gap-2 bg-primary-container hover:bg-brand-primary-hover text-text-primary font-bold px-4 py-2 rounded shadow-xs text-label-md">
        <Icon name="add" className="text-[18px]" /> Create New Report
      </button>
    </section>
  );
}

function matches(r: ReportListItem, f: ReportFilters) {
  const q = f.search.trim().toLowerCase();
  if (q && ![r.title, r.code, r.summary.primary, r.summary.secondary].some((s) => s.toLowerCase().includes(q))) return false;
  if (f.type !== 'all' && r.type !== f.type) return false;
  if (f.status !== 'all' && r.status !== f.status) return false;
  if (f.account !== 'all' && r.accountId !== f.account) return false;
  return true;
}

export default function ReportsPage() {
  useDocumentTitle('Reports');
  const navigate = useNavigate();
  const toast = useToast();
  const list = useQuery('reports:list', reportService.list);
  const ctx = useQuery('reports:context', reportService.context);
  const accounts = useQuery('reports:accounts', accountService.list);
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const [drawer, setDrawer] = useState<{ open: boolean; initial: ReportConfig; reportId?: string }>({ open: false, initial: blankConfig() });

  const filtered = useMemo(() => (list.data ?? []).filter((r) => matches(r, filters)), [list.data, filters]);
  const withData = ctx.data?.campaigns.filter((c) => c.metrics).map((c) => c.id) ?? [];

  const openCreate = (overrides: Partial<ReportConfig> = {}) => setDrawer({ open: true, initial: blankConfig(overrides) });
  const duplicate = useMutation(reportService.duplicate, { invalidate: ['reports'], onSuccess: (r) => toast({ tone: 'demo', title: `Duplicated as ${r.code}`, description: modeText('Copy saved to the in-memory demo library.', 'Copy saved to the InstaBoard database.') }) });
  const archive = useMutation(reportService.setArchived, {
    invalidate: ['reports'],
    onSuccess: (r) => toast({ title: r.status === 'archived' ? `${r.code} archived` : `${r.code} restored`, tone: 'success' }),
  });

  const handleDownload = async (r: ReportListItem) => {
    if (!canDownload(r)) {
      toast({ tone: 'info', title: 'Not available yet', description: `${r.code} is ${r.status === 'failed' ? 'in a failed state — regenerate it first' : 'not generated yet'}.` });
      return;
    }
    downloadReportCsv(await reportService.get(r.id));
    toast({ tone: 'demo', title: `Downloaded ${r.id}-demo.csv`, description: 'CSV built in your browser from demo data. PDF/XLSX files need the backend.' });
  };

  const handleSaved = (report: Report, config: ReportConfig) => {
    const editing = !!drawer.reportId;
    setDrawer((d) => ({ ...d, open: false }));
    toast({
      tone: 'demo',
      title: editing ? `${report.code} updated` : `${report.code} generated (demo)`,
      description:
        config.schedule !== 'none'
          ? 'Figures computed from demo data. Scheduled delivery requires the backend — saved as a configuration only.'
          : 'Figures computed from canonical demo data — nothing was fetched from Instagram.',
    });
    if (!editing) navigate(`/reports/${report.id}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-label-code text-label-code text-text-tertiary uppercase tracking-wider mb-1">
            <span>Reporting</span>
            <Icon name="chevron_right" className="text-[12px]" />
            <span className="text-text-secondary font-bold" aria-current="page">
              Reports
            </span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg font-bold text-text-primary tracking-tight">Reports</h1>
          <p className="font-body-md text-body-md text-text-secondary mt-0.5">Create, review, and export Instagram campaign performance reports.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            className={headerBtn}
            onClick={() => openCreate({ title: 'Weekly Performance Digest', type: 'executive_summary', scope: 'account', campaignIds: withData, sections: defaultSections.executive_summary, schedule: 'weekly', formats: ['pdf'] })}
          >
            <Icon name="schedule" className="text-[18px]" />
            <span>Schedule Reports</span>
          </button>
          <button
            type="button"
            className={headerBtn}
            disabled={!list.data}
            onClick={() => {
              downloadLibraryCsv(filtered);
              toast({ tone: 'demo', title: `Exported index of ${filtered.length} reports`, description: 'CSV of the filtered library (demo data). Batch PDF/XLSX bundles need the backend.' });
            }}
          >
            <Icon name="layers" className="text-[18px]" />
            <span>Batch Export</span>
          </button>
          <button
            type="button"
            onClick={() => openCreate()}
            className="flex items-center gap-2 bg-primary-container hover:bg-brand-primary-hover text-text-primary font-headline-sm text-label-md font-bold px-4 py-2 rounded shadow-sm transition-colors duration-150"
          >
            <Icon name="add" className="text-[20px]" />
            <span>Create Report</span>
          </button>
        </div>
      </section>

      {list.status === 'success' && ctx.data && list.data ? (
        <ReportsKpis items={list.data} ctx={ctx.data} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      <ReportsFilterBar filters={filters} onChange={setFilters} accounts={accounts.data ?? []} />

      <QueryState query={list} loading={<TableSkeleton />} empty={<EmptyReports onCreate={() => openCreate()} />}>
        {() =>
          filtered.length === 0 ? (
            <EmptyReports onCreate={() => openCreate()} />
          ) : (
            <ReportsTable
              items={filtered}
              totalCount={list.data?.length ?? 0}
              actions={{
                onDownload: handleDownload,
                onDuplicate: (r) => duplicate.mutate(r.id),
                onToggleArchive: (r) => archive.mutate(r.id, r.status !== 'archived'),
                onEdit: (r) => setDrawer({ open: true, initial: pickConfig(r), reportId: r.id }),
              }}
            />
          )
        }
      </QueryState>

      {ctx.data && (
        <ReportsAiBanner
          ctx={ctx.data}
          onDraft={() =>
            openCreate({
              title: 'Hindi Reel Conversions — Executive Brief',
              campaignIds: ['sbi-csp-october', 'sbi-csp-mitra-recruitment'],
              sections: ['summary', 'kpis', 'formats', 'creatives', 'recommendations'],
              formats: ['pdf'],
            })
          }
        />
      )}

      <ReportConfigDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        initial={drawer.initial}
        reportId={drawer.reportId}
        onSaved={handleSaved}
      />
    </div>
  );
}
