import { campaignBoostSpendInr, cplBenchmarkInr, reports } from '@/data/reports';
import { computeReport, summarizeReport } from '@/features/reports/reportMetrics';
import { pickConfig } from '@/features/reports/reportOptions';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { Report, ReportConfig, ReportContext, ReportDetail, ReportListItem, ReportType } from '@/types/reports';
import { accountService } from './accounts';
import { audienceService } from './audience';
import { campaignService } from './campaigns';
import { contentService } from './content';

/**
 * Reports store only their configuration; figures are derived on read from the canonical
 * services so they always agree with the rest of the app. Query keys must start with "reports".
 * Nothing here contacts Instagram/Meta or sends email — "generate" recomputes from demo data.
 */
const store: Report[] = structuredClone(reports);

const typeIcon: Record<ReportType, string> = {
  campaign_performance: 'description',
  content_reel: 'movie',
  audience: 'pie_chart',
  comments_sentiment: 'forum',
  lead_generation: 'contact_page',
  executive_summary: 'summarize',
};

let generation = 0;
/** Sortable timestamp that places prototype-generated reports after the seeded Oct 31 ones. */
const demoNow = () => `2024-10-31T23:${String(Math.min(59, 10 + generation++)).padStart(2, '0')}:00`;

/** Paid-boost spend per campaign and the CPL benchmark (used for cost-per-lead figures). */
const referenceData = () =>
  fromSource(() => ({ boostSpendInr: campaignBoostSpendInr, cplBenchmarkInr }), '/reports/reference');

async function loadContext(): Promise<ReportContext> {
  const [campaigns, content, overview, trends, audience, reference] = await Promise.all([
    campaignService.list(),
    contentService.list(),
    accountService.overview(),
    accountService.trends(),
    audienceService.summary(),
    referenceData(),
  ]);
  return { campaigns, content, overview, trends, audience, ...reference };
}

function find(id: string) {
  const found = store.find((r) => r.id === id);
  if (!found) throw new NotFoundError('Report', id);
  return found;
}

function nextNumber() {
  return Math.max(...store.map((r) => Number(r.code.replace(/\D/g, '').slice(-3)))) + 1;
}

export const reportService = {
  /** Canonical inputs (used by the configuration form's live preview). */
  context: loadContext,

  list: async (): Promise<ReportListItem[]> => {
    const [raw, ctx] = await Promise.all([fromSource(() => store, '/reports'), loadContext()]);
    return raw
      .map((r) => {
        const computed = computeReport(r, ctx);
        return { ...r, totals: computed.totals, summary: summarizeReport(r, computed, ctx) };
      })
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  },

  get: async (id: string): Promise<ReportDetail> => {
    const [report, ctx] = await Promise.all([fromSource(() => find(id), `/reports/${id}`), loadContext()]);
    return { report, computed: computeReport(report, ctx), cplBenchmarkInr: ctx.cplBenchmarkInr, audience: ctx.audience };
  },

  /** "Generate Report": adds a report computed from canonical demo data (status "Ready (demo)"). */
  create: (config: ReportConfig) =>
    mutateSource(
      () => {
        const n = nextNumber();
        const report: Report = {
          ...pickConfig(config),
          id: `rep-2024-${n}`,
          code: `#REP-2024-${n}`,
          status: 'ready_demo',
          icon: typeIcon[config.type],
          generatedAt: demoNow(),
          generatedLabel: 'Just now (demo)',
          createdBy: 'Priya Sharma',
          nextRunLabel: config.schedule === 'weekly' ? 'Mon, Nov 04, 2024 09:00 AM IST' : config.schedule === 'monthly' ? 'Fri, Nov 01, 2024 09:00 AM IST' : undefined,
        };
        store.unshift(report);
        return report;
      },
      { method: 'post', path: '/reports', body: config },
    ),

  /** "Edit Configuration" → save. Figures are recomputed on the next read. */
  update: (id: string, config: ReportConfig) =>
    mutateSource(
      () => {
        const found = find(id);
        const keepScheduled = found.status === 'scheduled' && config.schedule !== 'none';
        Object.assign(found, pickConfig(config), {
          icon: found.status === 'archived' ? found.icon : typeIcon[config.type],
          status: keepScheduled || found.status === 'archived' ? found.status : 'ready_demo',
          generatedAt: keepScheduled ? found.generatedAt : demoNow(),
          generatedLabel: keepScheduled ? found.generatedLabel : 'Updated just now (demo)',
          failureReason: undefined,
        });
        return found;
      },
      { method: 'put', path: `/reports/${id}`, body: config },
    ),

  /** "Regenerate": recomputes from demo data and refreshes the generated-at label. */
  regenerate: (id: string) =>
    mutateSource(
      () => {
        const found = find(id);
        found.status = 'ready_demo';
        found.failureReason = undefined;
        found.icon = typeIcon[found.type];
        found.generatedAt = demoNow();
        found.generatedLabel = 'Regenerated just now (demo)';
        return found;
      },
      { method: 'post', path: `/reports/${id}/regenerate` },
    ),

  duplicate: (id: string) =>
    mutateSource(
      () => {
        const source = find(id);
        const n = nextNumber();
        const copy: Report = {
          ...structuredClone(source),
          id: `rep-2024-${n}`,
          code: `#REP-2024-${n}`,
          title: `${source.title} (Copy)`,
          status: 'ready_demo',
          icon: typeIcon[source.type],
          generatedAt: demoNow(),
          generatedLabel: 'Just now (demo)',
          createdBy: 'Priya Sharma',
          failureReason: undefined,
        };
        store.unshift(copy);
        return copy;
      },
      { method: 'post', path: `/reports/${id}/duplicate` },
    ),

  setArchived: (id: string, archived: boolean) =>
    mutateSource(
      () => {
        const found = find(id);
        found.status = archived ? 'archived' : 'ready';
        found.icon = archived ? 'archive' : typeIcon[found.type];
        return found;
      },
      { method: 'patch', path: `/reports/${id}`, body: { archived } },
    ),
};
