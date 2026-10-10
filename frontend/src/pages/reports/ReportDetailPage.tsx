import { modeText } from '@/lib/config';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { LinkButton } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton, QueryState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { NotFoundError } from '@/lib/api/source';
import { reportService } from '@/services/reports';
import { ReportDetailHeader } from '@/features/reports/detail/ReportDetailHeader';
import { ExecutiveSummary } from '@/features/reports/detail/ExecutiveSummary';
import { KpiStrip } from '@/features/reports/detail/KpiStrip';
import { FormatEfficiencyCard, TimelineCard } from '@/features/reports/detail/ReportCharts';
import { CampaignBreakdownTable, CreativesTable } from '@/features/reports/detail/ReportTables';
import { AiRecommendations, AudienceSection } from '@/features/reports/detail/ReportInsights';
import { ExportModal, PrintStyles, type ExportFormat } from '@/features/reports/detail/ReportExport';
import { ReportConfigDrawer } from '@/features/reports/ReportConfigDrawer';
import { downloadReportCsv } from '@/features/reports/reportCsv';
import { pickConfig } from '@/features/reports/reportOptions';
import type { ReportConfig, ReportDetail, ReportSectionKey } from '@/types/reports';

function StatusNotice({ detail, onRegenerate }: { detail: ReportDetail; onRegenerate: () => void }) {
  const { report } = detail;
  if (report.status === 'generating')
    return <Notice tone="warning" icon="progress_activity" title="This report is still generating (sample state)">The figures below are a live preview computed from current demo data.</Notice>;
  if (report.status === 'scheduled')
    return (
      <Notice tone="info" icon="schedule" title={`Scheduled — next run ${report.nextRunLabel ?? 'not set'}`}>
        Preview computed from current demo data. Scheduled delivery to {report.recipients.join(', ') || 'recipients'} requires the backend — saved as a configuration only.
      </Notice>
    );
  if (report.status === 'failed')
    return (
      <Notice tone="warning" icon="error" title="Last generation failed">
        {report.failureReason}{' '}
        <button type="button" onClick={onRegenerate} className="underline font-semibold text-text-primary">
          Regenerate now
        </button>
      </Notice>
    );
  if (report.status === 'archived') return <Notice tone="demo" icon="archive" title="Archived report">Kept for reference; figures are recomputed from current demo data.</Notice>;
  return null;
}

function ReportBody({ detail }: { detail: ReportDetail }) {
  const toast = useToast();
  const { openCreateCampaign } = useAppUi();
  const { report } = detail;
  const has = (s: ReportSectionKey) => report.sections.includes(s);
  const [progress, setProgress] = useState<number | null>(null);
  const [editing, setEditing] = useState<ReportConfig | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [printExcluded, setPrintExcluded] = useState<ReportSectionKey[]>([]);
  const timer = useRef<number>();
  useEffect(() => () => window.clearInterval(timer.current), []);

  const regenerate = useMutation(reportService.regenerate, {
    invalidate: ['reports'],
    onSuccess: () => toast({ tone: 'demo', title: 'Report regenerated (demo)', description: 'Recomputed from canonical demo data — no Instagram data was fetched.' }),
  });

  const startRegenerate = () => {
    if (progress !== null) return;
    let value = 0;
    setProgress(0);
    timer.current = window.setInterval(() => {
      value += 12.5;
      setProgress(Math.min(100, value));
      if (value >= 100) {
        window.clearInterval(timer.current);
        void regenerate.mutate(report.id).finally(() => setProgress(null));
      }
    }, 150);
  };

  const csv = () => {
    downloadReportCsv(detail);
    toast({ tone: 'demo', title: `Downloaded ${report.id}-demo.csv`, description: 'Built in your browser from demo data.' });
  };
  const print = (excluded: ReportSectionKey[] = []) => {
    setPrintExcluded(excluded);
    window.setTimeout(() => window.print(), 50);
  };
  const xlsx = () => toast({ tone: 'demo', title: 'XLSX export needs the backend', description: 'Formatted workbooks are generated server-side. Use CSV or Print → Save as PDF in this prototype.' });

  const onExport = (format: ExportFormat, excluded: ReportSectionKey[]) => {
    setExportOpen(false);
    if (format === 'csv') csv();
    else if (format === 'pdf') print(excluded);
    else xlsx();
  };

  return (
    <div id="report-print-root" className="space-y-6">
      <PrintStyles excluded={printExcluded} />
      <ReportDetailHeader
        detail={detail}
        progress={progress}
        actions={{ onEdit: () => setEditing(pickConfig(report)), onRegenerate: startRegenerate, onCsv: csv, onPrint: () => print(), onXlsx: xlsx, onExportOptions: () => setExportOpen(true) }}
      />
      <StatusNotice detail={detail} onRegenerate={startRegenerate} />
      {has('summary') && <ExecutiveSummary detail={detail} cplBenchmark={detail.cplBenchmarkInr} />}
      {has('kpis') && <KpiStrip detail={detail} cplBenchmark={detail.cplBenchmarkInr} />}
      {(has('timeline') || has('formats')) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {has('timeline') && (
            <div className={has('formats') ? 'lg:col-span-8 min-w-0' : 'lg:col-span-12 min-w-0'}>
              <TimelineCard detail={detail} />
            </div>
          )}
          {has('formats') && (
            <div className={has('timeline') ? 'lg:col-span-4' : 'lg:col-span-12'}>
              <FormatEfficiencyCard detail={detail} />
            </div>
          )}
        </div>
      )}
      {has('audience') && <AudienceSection detail={detail} />}
      {(has('campaigns') || has('creatives')) && (
        <div className="space-y-6">
          {has('campaigns') && <CampaignBreakdownTable detail={detail} />}
          {has('creatives') && <CreativesTable detail={detail} />}
        </div>
      )}
      {has('recommendations') && (
        <AiRecommendations
          detail={detail}
          onApply={() => {
            openCreateCampaign();
            toast({ tone: 'demo', title: 'Opened the New Campaign wizard', description: 'Auto-applying AI recommendations is not wired up in the prototype — use them as a brief.' });
          }}
        />
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} detail={detail} onExport={onExport} />
      <ReportConfigDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing ?? pickConfig(report)}
        reportId={report.id}
        onSaved={(r) => {
          setEditing(null);
          toast({ tone: 'demo', title: `${r.code} configuration saved`, description: modeText('Report recomputed from demo data (in-memory only).', 'Configuration saved; figures are recomputed from campaign data.') });
        }}
      />
    </div>
  );
}

export default function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const query = useQuery(`reports:detail:${reportId}`, () => reportService.get(reportId));
  useDocumentTitle(query.data ? query.data.report.title : 'Report');
  return (
    <QueryState
      query={query}
      loading={<PageSkeleton kpis={8} />}
      empty={<EmptyState icon="description" title="No report data" description="This report has nothing to show in the current preview state." action={<LinkButton to="/reports" icon="arrow_back">Back to Reports</LinkButton>} />}
      error={(err, retry) =>
        err instanceof NotFoundError ? (
          <EmptyState
            icon="search_off"
            title="Report not found"
            description={`There is no report with the id "${reportId}". It may have been removed from this demo session.`}
            action={<LinkButton to="/reports" icon="arrow_back">Back to Reports</LinkButton>}
          />
        ) : (
          <ErrorState error={err} onRetry={retry} />
        )
      }
    >
      {(detail) => <ReportBody detail={detail} />}
    </QueryState>
  );
}
