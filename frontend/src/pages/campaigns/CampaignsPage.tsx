import { useMemo, useState } from 'react';
import { useAppUi } from '@/app/AppUiContext';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useTable } from '@/hooks/useTable';
import { formatDateRange } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';
import { sessionWorkspace } from '@/services/workspace';
import type { Campaign, CampaignObjective } from '@/types/domain';
import { CampaignQuickViewDrawer } from '@/features/campaigns/CampaignQuickViewDrawer';
import { CampaignsBulkBar } from '@/features/campaigns/CampaignsBulkBar';
import { CampaignsKpiSkeleton, CampaignsKpiStrip } from '@/features/campaigns/CampaignsKpiStrip';
import { CampaignStatusChips, type StatusFilter } from '@/features/campaigns/CampaignStatusChips';
import { campaignSortAccessors, CampaignsTable, CampaignsTableSkeleton, type CampaignSortKey } from '@/features/campaigns/CampaignsTable';
import { downloadCampaignsCsv, OBJECTIVES, STATUS_ORDER } from '@/features/campaigns/campaignUtils';
import { campaignStatusLabel } from '@/components/ui/Badge';
import { EditCampaignModal } from '@/features/campaigns/EditCampaignModal';
import { useCampaignActions } from '@/features/campaigns/useCampaignActions';

const SORT_PRESETS: Array<{ key: CampaignSortKey; label: string }> = [
  { key: 'reach', label: 'Sort: Highest Reach' },
  { key: 'leads', label: 'Sort: Most Leads' },
  { key: 'engagementRate', label: 'Sort: Highest Engagement' },
  { key: 'created', label: 'Sort: Recently Created' },
];

const selectCls = 'appearance-none font-medium';

export default function CampaignsPage() {
  useDocumentTitle('Campaigns');
  const toast = useToast();
  const { openCreateCampaign } = useAppUi();
  const campaignsQ = useQuery('campaigns:list', campaignService.list);
  const overviewQ = useQuery('accounts:overview', accountService.overview);
  const actions = useCampaignActions();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [objective, setObjective] = useState<'all' | CampaignObjective>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const all = useMemo(() => campaignsQ.data ?? [], [campaignsQ.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (objective === 'all' || c.objective === objective) &&
        (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.hashtags.some((h) => h.toLowerCase().includes(q))),
    );
  }, [all, status, objective, search]);

  const table = useTable<Campaign, CampaignSortKey>(filtered, { accessors: campaignSortAccessors, initialSort: { key: 'reach', direction: 'desc' }, pageSize: 10 });
  const sortPreset = table.sort?.direction === 'desc' && SORT_PRESETS.some((p) => p.key === table.sort?.key) ? table.sort.key : '';

  const selectedCampaigns = all.filter((c) => selected.has(c.id));
  const drawerCampaign = all.find((c) => c.id === drawerId) ?? null;
  const editCampaign = all.find((c) => c.id === editId) ?? null;
  const filtersActive = status !== 'all' || objective !== 'all' || search.trim() !== '';

  const onSelect = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const clearFilters = () => {
    setStatus('all');
    setObjective('all');
    setSearch('');
  };

  const exportSelected = () => {
    downloadCampaignsCsv(selectedCampaigns, 'instaboard-selected-campaigns-demo.csv');
    toast({ tone: 'demo', title: `Exported ${selectedCampaigns.length} campaign${selectedCampaigns.length === 1 ? '' : 's'} to CSV`, description: 'Generated in your browser from demo data.' });
  };

  const openEdit = (c: Campaign) => {
    setDrawerId(null);
    setEditId(c.id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary">Campaigns</h1>
          <p className="font-body-md text-body-md text-text-secondary">Manage, monitor and analyze your Instagram campaigns.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border-strong text-text-primary font-label-md text-label-md shadow-sm"
            title="Reporting period (change it from the date range in the top bar)"
          >
            <Icon name="calendar_month" className="text-text-secondary text-[16px]" />
            <span className="font-semibold">
              {formatDateRange(sessionWorkspace.reportingPeriod.start, sessionWorkspace.reportingPeriod.end)}, {sessionWorkspace.reportingPeriod.end.slice(0, 4)}
            </span>
          </div>
          <Select aria-label="Filter by objective" value={objective} onChange={(e) => setObjective(e.target.value as typeof objective)} className={selectCls}>
            <option value="all">All Objectives</option>
            {OBJECTIVES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={selectCls}>
            <option value="all">All Statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {campaignStatusLabel(s)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort campaigns"
            value={sortPreset}
            onChange={(e) => {
              const key = e.target.value as CampaignSortKey;
              if (table.sort?.key === key && table.sort.direction === 'asc') table.toggleSort(key);
              else if (table.sort?.key !== key) table.toggleSort(key);
            }}
            className={selectCls}
          >
            {sortPreset === '' && (
              <option value="" disabled>
                Sort: Custom (column)
              </option>
            )}
            {SORT_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
          <Button variant="primary" size="md" icon="add" onClick={openCreateCampaign} className="font-headline-sm">
            New Campaign
          </Button>
        </div>
      </div>

      {campaignsQ.status === 'loading' || overviewQ.status === 'loading' ? (
        <CampaignsKpiSkeleton />
      ) : (
        <CampaignsKpiStrip campaigns={all} overview={overviewQ.data} />
      )}

      {/* Status chips + search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border-strong pb-3">
        <CampaignStatusChips campaigns={all} value={status} onChange={setStatus} />
        <div className="flex items-center gap-3">
          <span className="hidden xl:flex items-center gap-1.5 text-text-secondary text-xs whitespace-nowrap">
            <Icon name="filter_list" className="text-[15px]" />
            Showing <strong className="tnum">{filtered.length}</strong> of <strong className="tnum">{all.length}</strong>
          </span>
          <SearchInput
            aria-label="Search campaigns by name, code or hashtag"
            placeholder="Search name, ID or hashtag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="w-full lg:w-64"
          />
        </div>
      </div>

      {selectedCampaigns.length > 0 && (
        <CampaignsBulkBar
          selected={selectedCampaigns}
          pending={actions.statusPending}
          onPause={() => actions.setStatus(selectedCampaigns, 'paused')}
          onResume={() => actions.setStatus(selectedCampaigns, 'active')}
          onExport={exportSelected}
          onClear={() => setSelected(new Set())}
        />
      )}

      {campaignsQ.status === 'loading' ? (
        <CampaignsTableSkeleton />
      ) : campaignsQ.status === 'error' ? (
        <div className="p-4 rounded-lg bg-error-container/40 border border-error/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
          <div className="flex items-center gap-3">
            <Icon name="error" className="text-error text-2xl" />
            <div>
              <div className="font-headline-sm text-headline-sm text-error font-bold">Failed to load campaigns</div>
              <div className="font-body-sm text-body-sm text-text-secondary">{campaignsQ.error?.message ?? 'Something went wrong while loading campaigns.'}</div>
            </div>
          </div>
          <Button size="sm" icon="refresh" onClick={campaignsQ.refetch} className="bg-error text-white border-error hover:bg-error/90 hover:border-error">
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-card rounded-lg border border-border-strong p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
          <div className="h-14 w-14 rounded-full bg-surface-canvas border border-border-strong flex items-center justify-center text-text-tertiary">
            <Icon name="campaign" className="text-3xl" />
          </div>
          <div className="space-y-1">
            <h3 className="font-headline-md text-headline-md text-text-primary">No campaigns found</h3>
            <p className="font-body-md text-body-md text-text-secondary max-w-sm">
              {filtersActive ? 'No Instagram campaigns match your current filters. Try adjusting the status chips or search.' : 'Create your first campaign to start tracking it here.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {filtersActive && (
              <Button size="md" icon="filter_alt_off" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <Button variant="primary" size="md" icon="add" onClick={openCreateCampaign}>
              New Campaign
            </Button>
          </div>
        </div>
      ) : (
        <CampaignsTable
          table={table}
          selected={selected}
          onSelect={onSelect}
          onOpen={(c) => setDrawerId(c.id)}
          onEdit={openEdit}
          onToggleStatus={(c) => actions.setStatus([c], c.status === 'active' ? 'paused' : 'active')}
          onDuplicate={(c) => actions.duplicate(c)}
        />
      )}

      <CampaignQuickViewDrawer
        campaign={drawerCampaign}
        onClose={() => setDrawerId(null)}
        onEdit={openEdit}
        onDuplicate={(c) => actions.duplicate(c)}
        duplicatePending={actions.duplicatePending}
      />
      <EditCampaignModal campaign={editCampaign} onClose={() => setEditId(null)} />
    </div>
  );
}
