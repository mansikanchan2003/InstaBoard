import { modeText } from '@/lib/config';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout/PageHeader';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ActivityDetailModal } from '@/features/activity/ActivityDetailModal';
import { ActivityFilters } from '@/features/activity/ActivityFilters';
import { ActivityKpiSkeleton, ActivityKpiStrip, type KpiQuickFilter } from '@/features/activity/ActivityKpiStrip';
import { ActivityTable } from '@/features/activity/ActivityTable';
import { dateScopes, defaultFilters, downloadActivityCsv, type ActivityFilterState } from '@/features/activity/activityUi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { activityService } from '@/services/activity';
import { notificationService } from '@/services/notifications';
import type { ActivityActor, ActivityEntry } from '@/types/activity';

function applyFilters(entries: ActivityEntry[], f: ActivityFilterState, actorOf: (id: string) => ActivityActor | undefined) {
  const scope = dateScopes[f.date];
  const q = f.search.trim().toLowerCase();
  return entries.filter((e) => {
    const day = e.timestamp.slice(0, 10);
    if (scope.from && day < scope.from) return false;
    if (scope.to && day > scope.to) return false;
    if (f.category && e.category !== f.category) return false;
    if (f.account && e.accountId !== f.account) return false;
    if (f.outcome === 'issues') {
      if (!['warning', 'failed', 'resolved'].includes(e.outcome)) return false;
    } else if (f.outcome && e.outcome !== f.outcome) return false;
    const actor = actorOf(e.actorId);
    if (f.actor === 'kind:member' && actor?.kind !== 'member') return false;
    if (f.actor === 'kind:automated' && actor?.kind === 'member') return false;
    if (f.actor && !f.actor.startsWith('kind:') && e.actorId !== f.actor) return false;
    if (q) {
      const hay = [e.id, e.title, e.summary, e.kind, e.target.label, actor?.name ?? '', actor?.shortLabel ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function TableSkeleton() {
  return (
    <div className="bg-surface-card border border-border-strong rounded-xl p-4 space-y-3 mb-4" role="status" aria-label="Loading audit events">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

export default function ActivityLogPage() {
  useDocumentTitle('Activity Log');
  const toast = useToast();
  const entriesQ = useQuery('activity:list', activityService.list);
  const actorsQ = useQuery('activity:actors', activityService.actors);
  const summaryQ = useQuery('activity:summary', activityService.summary);
  const accountsQ = useQuery('accounts:list', accountService.list);
  const unreadQ = useQuery('notifications:unread', notificationService.unreadCount);

  const [filters, setFilters] = useState<ActivityFilterState>(defaultFilters);
  const [live, setLive] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const actorMap = useMemo(() => new Map((actorsQ.data ?? []).map((a) => [a.id, a])), [actorsQ.data]);
  const actorOf = (id: string) => actorMap.get(id);
  const filtered = useMemo(() => applyFilters(entriesQ.data ?? [], filters, (id) => actorMap.get(id)), [entriesQ.data, filters, actorMap]);
  const openEntry = entriesQ.data?.find((e) => e.id === openId) ?? null;

  const patch = (p: Partial<ActivityFilterState>) => setFilters((f) => ({ ...f, ...p }));
  const quick: KpiQuickFilter =
    filters.actor === 'kind:automated' ? 'automated' : filters.actor === 'kind:member' ? 'operator' : filters.outcome === 'issues' ? 'issues' : null;
  const onQuick = (q: KpiQuickFilter) => {
    if (q === 'automated') patch({ actor: 'kind:automated', outcome: '' });
    else if (q === 'operator') patch({ actor: 'kind:member', outcome: '' });
    else if (q === 'issues') patch({ outcome: 'issues', actor: '' });
    else patch({ actor: '', outcome: '' });
  };

  const exportCsv = () => {
    downloadActivityCsv(filtered, actorOf);
    toast({ title: `Exported ${filtered.length} audit events`, description: 'CSV generated in your browser from demo data (filters applied). Nothing was requested from a server.' });
  };

  const toggleLive = (next: boolean) => {
    setLive(next);
    toast({
      tone: 'demo',
      title: next ? 'Live feed resumed (simulated)' : 'Live feed paused',
      description: modeText('This prototype has no event stream — new entries only appear when you change settings or team members in this session.', 'There is no live event stream yet — new entries appear when settings or team members are changed through the API.'),
    });
  };

  return (
    <div>
      {/* Breadcrumb & sub-navigation */}
      <div className="pt-2 pb-4">
        <Breadcrumbs items={[{ label: 'System' }, { label: 'Activity Log' }]} className="mb-2" />
        <div className="flex items-center gap-6 border-b border-border-strong overflow-x-auto no-scrollbar">
          <Link to="/notifications" className="pb-3 px-1 text-label-md font-label-md text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2 whitespace-nowrap">
            <span>Notifications Inbox</span>
            {unreadQ.data !== undefined && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-card-subtle text-text-secondary tnum">{unreadQ.data}</span>
            )}
          </Link>
          <span aria-current="page" className="pb-3 px-1 text-label-md font-label-md font-bold text-text-primary border-b-2 border-primary-container flex items-center gap-2 whitespace-nowrap">
            <Icon name="history" className="text-[18px] text-primary" />
            <span>Activity Log</span>
            {entriesQ.data && <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-container text-text-primary tnum">{entriesQ.data.length}</span>}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary font-bold">Activity Log &amp; Audit Trail</h1>
            <DemoBadge />
          </div>
          <p className="font-body-md text-body-md text-text-secondary mt-1">
            Audit-ready chronological record of automated synchronization, user actions, campaign milestones, and system events.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-strong bg-white cursor-pointer">
            <span className="relative flex h-2.5 w-2.5">
              {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-active opacity-75" />}
              <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', live ? 'bg-status-active' : 'bg-text-tertiary')} />
            </span>
            <span className="font-label-sm text-label-sm font-semibold text-text-primary">Live Feed</span>
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => toggleLive(e.target.checked)}
              className="form-checkbox h-4 w-4 text-primary-container rounded border-border-strong focus:ring-0 cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!entriesQ.data || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-strong bg-white hover:bg-surface-canvas text-text-primary font-label-md text-label-md font-semibold transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="download_for_offline" className="text-[18px]" />
            <span>Export Audit Log</span>
            <span className="font-label-code text-label-code text-text-tertiary">CSV</span>
          </button>
        </div>
      </div>

      <QueryState query={summaryQ} loading={<ActivityKpiSkeleton />} empty={<></>} error={() => null}>
        {(summary) => <ActivityKpiStrip summary={summary} active={quick} onQuickFilter={onQuick} />}
      </QueryState>

      <ActivityFilters filters={filters} onChange={patch} actors={actorsQ.data ?? []} accounts={accountsQ.data ?? []} matchCount={filtered.length} />

      <QueryState
        query={entriesQ}
        loading={<TableSkeleton />}
        empty={<EmptyState icon="history" title="No audit events yet" description="Synchronization runs, operator actions and system alerts will appear here once they are recorded." className="mb-4" />}
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState
              icon="filter_alt_off"
              title="No events match these filters"
              description="Try widening the date scope or clearing the category, outcome and actor filters."
              action={
                <Button size="sm" onClick={() => setFilters(defaultFilters)}>
                  Clear filters
                </Button>
              }
              className="mb-4"
            />
          ) : (
            <ActivityTable entries={filtered} actorLookup={actorOf} onOpen={(e) => setOpenId(e.id)} resetKey={JSON.stringify(filters)} />
          )
        }
      </QueryState>

      {/* Retention & compliance — honest about the prototype */}
      <div className="p-3 bg-white border border-border-strong rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-body-sm text-text-secondary">
        <div className="flex items-start sm:items-center gap-2">
          <Icon name="verified_user" className="text-primary text-[18px]" />
          <span>
            {modeText(
              'In production, audit logs would be tamper-evident and retained for 365 days under Eko data governance. This prototype stores nothing server-side — entries are sample records held in memory for this browser session.',
              'Entries are stored in the InstaBoard database (sample records plus changes made through the API). Tamper-evidence and retention policies are not implemented yet.',
            )}
          </span>
        </div>
        <Link to="/settings?tab=data-sync" className="text-primary hover:text-brand-primary-hover font-semibold text-label-sm flex items-center gap-1 shrink-0">
          Retention Policies <Icon name="open_in_new" className="text-[14px]" />
        </Link>
      </div>

      <ActivityDetailModal entry={openEntry} actor={openEntry ? actorOf(openEntry.actorId) : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}
