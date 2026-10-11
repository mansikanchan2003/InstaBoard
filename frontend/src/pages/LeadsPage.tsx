import { LeadPrioritiesPanel } from '@/features/ai/LeadAiPanels';
import { isDemoMode } from '@/lib/config';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DemoBadge, leadStatusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { LeadDrawer } from '@/features/leads/LeadDrawer';
import { LeadKpis, LeadKpisSkeleton } from '@/features/leads/LeadKpis';
import { emptyLeadFilters, LeadsFilters, type LeadFilters } from '@/features/leads/LeadsFilters';
import { LeadsTable, type LeadSortKey } from '@/features/leads/LeadsTable';
import { contentSourceLabel, downloadTextFile, leadsToCsv, minutesAgo, type LeadRow } from '@/features/leads/leadUtils';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useTable } from '@/hooks/useTable';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import { leadService } from '@/services/leads';

const accessors: Record<LeadSortKey, (r: LeadRow) => string | number> = {
  name: (r) => r.name.toLowerCase(),
  score: (r) => r.score,
  /** Negated so "descending" means most recent first. */
  lastContact: (r) => -minutesAgo(r.lastContact),
};

/** Leads — "Campaign Leads Management" (view-leads + leadDrawer of the campaign-intelligence export). */
export default function LeadsPage() {
  useDocumentTitle('Leads');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const selectedLeadId = params.get('lead');
  const contentFilter = params.get('content');

  const summary = useQuery('leads:summary', leadService.summary);
  const leads = useQuery('leads:list', leadService.list);
  const campaigns = useQuery('campaigns:list', campaignService.list);
  const content = useQuery('content:list', contentService.list);

  const [filters, setFilters] = useState<LeadFilters>(() => ({ ...emptyLeadFilters, campaignId: params.get('campaign') ?? 'all' }));

  const rows = useMemo<LeadRow[]>(() => {
    const campaignNames = new Map((campaigns.data ?? []).map((c) => [c.id, c.name]));
    const contentById = new Map((content.data ?? []).map((c) => [c.id, c]));
    return (leads.data ?? []).map((l) => {
      const item = l.contentId ? contentById.get(l.contentId) : undefined;
      return { ...l, campaignName: campaignNames.get(l.campaignId) ?? l.campaignId, contentLabel: item ? contentSourceLabel(item) : null };
    });
  }, [leads.data, campaigns.data, content.data]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || r.handle.toLowerCase().includes(q) || r.location.toLowerCase().includes(q)) &&
        (filters.status === 'all' || r.status === filters.status) &&
        (filters.campaignId === 'all' || r.campaignId === filters.campaignId) &&
        (!contentFilter || r.contentId === contentFilter),
    );
  }, [rows, filters, contentFilter]);

  const table = useTable<LeadRow, LeadSortKey>(filtered, { accessors, initialSort: { key: 'lastContact', direction: 'desc' }, pageSize: 10 });

  const updateParams = (mutate: (p: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      },
      { replace: true },
    );

  const openLead = (id: string) => updateParams((p) => p.set('lead', id));
  const closeLead = () => updateParams((p) => p.delete('lead'));
  const clearContent = () => updateParams((p) => p.delete('content'));
  const resetFilters = () => {
    setFilters(emptyLeadFilters);
    updateParams((p) => {
      p.delete('content');
      p.delete('campaign');
    });
  };

  const hasActiveFilters = filters.search !== '' || filters.status !== 'all' || filters.campaignId !== 'all' || !!contentFilter;
  const contentChip = contentFilter ? (content.data?.find((c) => c.id === contentFilter)?.title ?? contentFilter) : null;

  const exportCsv = () => {
    const visible = table.allRows;
    downloadTextFile('instaboard-leads-demo.csv', leadsToCsv(visible, leadStatusLabel));
    toast({
      tone: 'demo',
      title: `Exported ${visible.length} lead${visible.length === 1 ? '' : 's'} to CSV`,
      description: 'Demo data generated in your browser from the leads currently shown — not a CRM export.',
    });
  };

  const selectedRow = selectedLeadId ? rows.find((r) => r.id === selectedLeadId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Leads Management"
        description="Track potential CSP applicants captured via Instagram video engagement"
        className="md:items-center"
        actions={
          <Button icon="download" onClick={exportCsv} disabled={leads.status !== 'success' || table.total === 0}>
            Export CSV
          </Button>
        }
      />

      <QueryState query={summary} loading={<LeadKpisSkeleton />} error={(err, retry) => <ErrorState title="Unable to load pipeline summary" error={err} onRetry={retry} />}>
        {(s) => <LeadKpis summary={s} />}
      </QueryState>
      {!isDemoMode && <LeadPrioritiesPanel />}

      <section className="bg-surface-card border border-border-strong rounded-lg overflow-hidden" aria-label="Leads">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border-strong bg-surface-canvas">
          <p className="text-body-sm text-text-secondary">
            Showing a sample of recent leads. KPI cards above are totals for the reporting period (Oct 1 – Oct 31, 2024).
          </p>
          <DemoBadge />
        </div>
        <LeadsFilters
          filters={filters}
          onChange={setFilters}
          campaigns={campaigns.data ?? []}
          contentChip={contentChip}
          onClearContent={clearContent}
          onReset={resetFilters}
          hasActive={hasActiveFilters}
        />
        <QueryState
          query={leads}
          loading={
            <div className="p-4 space-y-2" role="status" aria-label="Loading leads">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          }
          error={(err, retry) => <ErrorState className="m-4" title="Instagram Graph API Rate Limit Alert" error={err} onRetry={retry} />}
          empty={
            <EmptyState
              className="m-4"
              icon="group_off"
              title="No leads captured yet"
              description="Leads appear here when comments, DMs or bio-link forms show CSP intent. Convert high-intent comments from Comments Intelligence."
            />
          }
        >
          {() =>
            table.total === 0 ? (
              <EmptyState
                className="m-4"
                icon="search_off"
                title="No matching leads"
                description="No leads in the sample match your search and filters."
                action={
                  <Button variant="primary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <LeadsTable table={table} onManage={openLead} selectedId={selectedLeadId} />
            )
          }
        </QueryState>
      </section>

      <LeadDrawer open={!!selectedLeadId} leadId={selectedLeadId} lead={selectedRow} loading={leads.status === 'loading'} onClose={closeLead} />
    </div>
  );
}
