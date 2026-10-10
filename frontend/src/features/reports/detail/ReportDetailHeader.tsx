import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { DemoBadge } from '@/components/ui/Badge';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Misc';
import type { ReportDetail } from '@/types/reports';
import { ReportStatusBadge } from '../ReportBadges';
import { reportTypeLabel } from '../reportOptions';

const outlineBtn =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border-strong bg-white hover:bg-surface-canvas text-text-primary font-label-md text-label-md font-semibold transition-colors duration-150 disabled:opacity-75 disabled:cursor-not-allowed';

export interface ReportHeaderActions {
  onEdit: () => void;
  onRegenerate: () => void;
  onCsv: () => void;
  onPrint: () => void;
  onXlsx: () => void;
  onExportOptions: () => void;
}

export function ReportDetailHeader({ detail, progress, actions }: { detail: ReportDetail; progress: number | null; actions: ReportHeaderActions }) {
  const { report, computed } = detail;
  const regenerating = progress !== null;
  return (
    <div className="bg-surface-card rounded-xl border border-border-strong p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-strong pb-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-text-secondary font-label-sm text-label-sm min-w-0">
          <span>Reporting</span>
          <span className="text-text-tertiary">/</span>
          <Link className="hover:text-text-primary hover:underline font-medium" to="/reports">
            Reports
          </Link>
          <span className="text-text-tertiary">/</span>
          <span className="text-text-primary font-bold" aria-current="page">
            {report.title} ({report.code})
          </span>
        </nav>
        <Link className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary font-label-md text-label-md font-semibold transition-colors" to="/reports">
          <Icon name="arrow_back" className="text-[16px]" />
          <span>Back to Reports</span>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary tracking-tight">{report.title}</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-status-draft-subtle border border-border-strong font-label-sm text-[11px] font-semibold text-text-secondary">
              {reportTypeLabel(report.type)}
            </span>
            <ReportStatusBadge status={report.status} prefix="Status: " className="text-[11px]" />
            <DemoBadge label="Demo data · not verified via Meta Graph API" />
          </div>
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 font-body-sm text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <strong className="text-text-primary font-medium">{report.status === 'scheduled' ? 'Created:' : 'Generated on:'}</strong> {report.generatedLabel}
            </span>
            <span className="text-text-tertiary" aria-hidden>
              •
            </span>
            <span className="inline-flex items-center gap-1">
              <strong className="text-text-primary font-medium">Period:</strong> {computed.periodLabel}
              {report.compareBaseline && (computed.periodShare === 1 ? ' (vs Sep 01 – Sep 30 baseline)' : ' (vs equivalent Sep window)')}
            </span>
            <span className="text-text-tertiary" aria-hidden>
              •
            </span>
            <span className="inline-flex items-center gap-1">
              <strong className="text-text-primary font-medium">Target:</strong>
              <Link to={`/accounts/${report.accountId}`} className="hover:text-text-primary hover:underline">
                @ekoindia
              </Link>
            </span>
            <span className="text-text-tertiary" aria-hidden>
              •
            </span>
            <span className="inline-flex flex-wrap items-center gap-1">
              <strong className="text-text-primary font-medium">{report.scope === 'account' ? 'Scope:' : 'Included Campaigns:'}</strong>
              {report.scope === 'account' && <span>Whole account incl. organic ·</span>}
              {computed.campaigns.map((c, i) => (
                <Fragment key={c.id}>
                  <Link to={`/campaigns/${c.id}`} className="underline decoration-border-strong hover:text-text-primary">
                    {c.name}
                  </Link>
                  {i < computed.campaigns.length - 1 && ','}
                </Fragment>
              ))}
              {computed.campaigns.length === 0 && <span>None with data</span>}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
          <button type="button" className={outlineBtn} onClick={actions.onEdit} disabled={regenerating}>
            <Icon name="tune" className="text-[17px]" />
            <span>Edit Configuration</span>
          </button>
          <button type="button" className={outlineBtn} onClick={actions.onRegenerate} disabled={regenerating} aria-busy={regenerating}>
            <Icon name={regenerating ? 'sync' : 'refresh'} className={regenerating ? 'text-[17px] animate-spin' : 'text-[17px]'} />
            <span>{regenerating ? 'Regenerating...' : 'Regenerate'}</span>
          </button>
          <Dropdown
            label="Export report"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container hover:bg-brand-primary-hover text-text-primary font-label-md text-label-md font-bold transition-colors duration-150 shadow-xs"
              >
                <Icon name="download" className="text-[18px]" />
                <span>Export Report</span>
                <Icon name="expand_more" className="text-[18px]" />
              </button>
            )}
            className="min-w-[16rem]"
          >
            {(close) => (
              <>
                <MenuItem icon="csv" onClick={() => (close(), actions.onCsv())}>
                  Download CSV (demo data)
                </MenuItem>
                <MenuItem icon="picture_as_pdf" onClick={() => (close(), actions.onPrint())}>
                  Print / Save as PDF
                </MenuItem>
                <MenuItem icon="table_view" onClick={() => (close(), actions.onXlsx())}>
                  Excel XLSX (needs backend)
                </MenuItem>
                <div className="border-t border-border-subtle my-1" />
                <MenuItem icon="tune" onClick={() => (close(), actions.onExportOptions())}>
                  Export options…
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>
      {regenerating && (
        <div className="space-y-1 print:hidden" aria-live="polite">
          <div className="flex justify-between text-[11px] font-label-code text-text-secondary">
            <span>Recomputing from demo data…</span>
            <span className="tnum">{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} label="Regeneration progress" />
        </div>
      )}
    </div>
  );
}
