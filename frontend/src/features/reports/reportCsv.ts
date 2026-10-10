import type { ReportDetail, ReportListItem } from '@/types/reports';
import { reportStatusMeta, reportTypeLabel } from './reportOptions';

/**
 * Client-side CSV exports built from the in-memory demo data (no backend involved).
 * Every file starts with a "demo data" disclaimer row so it is never mistaken for live metrics.
 */
type Cell = string | number | null | undefined;

const escape = (v: Cell) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Cell[][]) {
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob.size;
}

const DISCLAIMER = 'DEMO DATA - generated in the browser from InstaBoard sample data; not retrieved from Instagram / Meta Graph API.';
const r1 = (v: number | null) => (v === null ? '' : Math.round(v));
const r2 = (v: number | null) => (v === null ? '' : v.toFixed(2));

export function reportCsvRows({ report, computed }: ReportDetail): Cell[][] {
  const t = computed.totals;
  return [
    [DISCLAIMER],
    ['Report', report.title],
    ['Report ID', report.code],
    ['Type', reportTypeLabel(report.type)],
    ['Status', reportStatusMeta[report.status].label],
    ['Period', computed.periodLabel],
    ['Generated', report.generatedLabel],
    [],
    ['Totals', 'Views', 'Reach', 'Engagement rate %', 'Likes', 'Comments', 'Shares', 'Saves', 'Leads', 'Boost spend INR', 'CPL INR', 'Watch time hrs'],
    ['All included', t.views, t.reach, r2(t.engagementRate), t.likes, t.comments, t.shares, t.saves, t.leads, r1(t.spendInr), r1(t.cpl), r1(t.watchTimeHours)],
    [],
    ['Campaign', 'Code', 'Status', 'Views', 'Reach', 'Engagement rate %', 'Comments', 'Leads', 'CPL INR', 'Health'],
    ...computed.campaignRows.map((row) => [
      row.campaign.name,
      row.campaign.code,
      row.campaign.status,
      row.views,
      row.reach,
      r2(row.engagementRate),
      row.comments,
      row.leads,
      r1(row.cpl),
      row.campaign.health ?? '',
    ]),
    [],
    ['Creative', 'Format', 'Published', 'Views', 'Reach', 'Avg watch sec', 'Engagement rate %', 'Leads'],
    ...computed.creatives.map(({ content, avgWatchSec }) => [
      content.title,
      content.type,
      content.publishedAt,
      content.metrics.views,
      content.metrics.reach,
      avgWatchSec === null ? '' : avgWatchSec.toFixed(1),
      r2(content.metrics.engagementRate),
      content.metrics.leads,
    ]),
  ];
}

export function downloadReportCsv(detail: ReportDetail) {
  return downloadCsv(`${detail.report.id}-demo.csv`, reportCsvRows(detail));
}

export function downloadLibraryCsv(items: ReportListItem[]) {
  return downloadCsv('instaboard-reports-index-demo.csv', [
    [DISCLAIMER],
    ['Report ID', 'Title', 'Type', 'Status', 'Period start', 'Period end', 'Scope', 'Summary', 'Views', 'Leads', 'Generated'],
    ...items.map((r) => [
      r.code,
      r.title,
      reportTypeLabel(r.type),
      reportStatusMeta[r.status].label,
      r.period.start,
      r.period.end,
      r.scope === 'account' ? 'Account (campaigns + organic)' : 'Selected campaigns',
      `${r.summary.primary} — ${r.summary.secondary}`,
      r.totals.views,
      r.totals.leads,
      r.generatedLabel,
    ]),
  ]);
}
