import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { notificationService } from '@/services/notifications';
import { reportService } from '@/services/reports';
import { NotificationCard } from '@/features/notifications/NotificationCard';
import { NotificationDetailModal } from '@/features/notifications/NotificationDetailModal';
import { categoryLabels, categoryOrder, groupLabels, groupOrder, priorityLabels } from '@/features/notifications/notificationMeta';
import { PreferencesDrawer } from '@/features/notifications/PreferencesDrawer';
import { downloadReportCsv } from '@/features/reports/reportCsv';
import type { NotificationAction, NotificationCategory, NotificationItem, NotificationPriority } from '@/types/notifications';

type TabKey = 'all' | 'unread' | NotificationCategory;
const headerBtn =
  'h-8 px-3 rounded-lg border border-border-strong bg-surface-card hover:bg-surface-canvas text-text-primary text-label-md font-label-md font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50';

function AllCaughtUp({ onReset, onRules }: { onReset: () => void; onRules: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-surface-card border border-border-strong rounded-xl text-center">
      <div className="w-16 h-16 rounded-full bg-surface-canvas border border-border-strong flex items-center justify-center text-text-tertiary mb-4">
        <Icon name="notifications_off" className="text-[32px]" />
      </div>
      <h2 className="text-headline-md font-headline-md font-bold text-text-primary">All Caught Up!</h2>
      <p className="text-body-md font-body-md text-text-secondary max-w-md mt-1 mb-6">There are no unread notifications or active telemetry alerts matching your current filter set.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onReset} className="h-9 px-4 rounded-lg bg-primary-container text-text-primary font-label-md text-label-md font-bold hover:bg-brand-primary-hover transition-colors">
          Reset Filters
        </button>
        <button
          type="button"
          onClick={onRules}
          className="h-9 px-4 rounded-lg border border-border-strong bg-surface-card text-text-primary font-label-md text-label-md font-medium hover:bg-surface-canvas transition-colors"
        >
          Review Alert Rules
        </button>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-label="Loading notifications">
      <Skeleton className="h-4 w-48" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const toast = useToast();
  const query = useQuery('notifications:list', notificationService.list);
  const [tab, setTab] = useState<TabKey>('all');
  const [priority, setPriority] = useState<'all' | NotificationPriority>('all');
  const [search, setSearch] = useState('');
  const [inspect, setInspect] = useState<NotificationItem | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const items = useMemo(() => query.data ?? [], [query.data]);
  const unread = items.filter((n) => !n.read).length;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (n) =>
        (tab === 'all' || (tab === 'unread' ? !n.read : n.category === tab)) &&
        (priority === 'all' || n.priority === priority) &&
        (!q || [n.title, n.body, categoryLabels[n.category], ...n.tags.map((t) => t.label)].some((s) => s.toLowerCase().includes(q))),
    );
  }, [items, tab, priority, search]);

  const setRead = useMutation(notificationService.setRead, { invalidate: ['notifications'] });
  const markAll = useMutation(notificationService.markAllRead, { invalidate: ['notifications'], onSuccess: () => toast({ title: 'All notifications marked as read' }) });
  const dismiss = useMutation(notificationService.dismiss, { invalidate: ['notifications'], onSuccess: () => toast({ title: 'Notification dismissed' }) });

  const resetFilters = () => {
    setTab('all');
    setPriority('all');
    setSearch('');
  };

  const open = (n: NotificationItem, href = n.href) => {
    if (!n.read) void setRead.mutate(n.id, true);
    setInspect(null);
    if (href) navigate(href);
  };

  const runAction = async (n: NotificationItem, a: NotificationAction) => {
    if (a.kind === 'dismiss') {
      setInspect(null);
      void dismiss.mutate(n.id);
    } else if (a.kind === 'details') {
      setInspect(n);
    } else if (a.kind === 'download-report' && n.reportId) {
      if (!n.read) void setRead.mutate(n.id, true);
      downloadReportCsv(await reportService.get(n.reportId));
      toast({ tone: 'demo', title: `Downloaded ${n.reportId}-demo.csv`, description: 'CSV built in your browser from demo data. PDF delivery needs the backend.' });
    } else {
      open(n, a.href ?? n.href);
    }
  };

  const toggleRead = async (n: NotificationItem) => {
    await setRead.mutate(n.id, !n.read);
    toast({ title: n.read ? 'Notification marked as unread' : 'Notification marked as read' });
  };

  const counts = (key: TabKey) => (key === 'all' ? items.length : key === 'unread' ? unread : items.filter((n) => n.category === key).length);
  const tabs: TabKey[] = ['all', 'unread', ...categoryOrder];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-label-sm font-label-sm text-text-secondary">
          <span>System</span>
          <Icon name="chevron_right" className="text-[14px]" />
          <span className="text-text-primary font-semibold" aria-current="page">
            Notifications
          </span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <div className="flex items-center gap-3">
            <h1 className="text-headline-lg font-headline-lg font-bold text-text-primary tracking-tight">Notifications</h1>
            <span className="h-5 px-2.5 rounded-full bg-status-active-subtle border border-[#A7F3D0] text-[#065F46] text-label-sm font-label-sm font-semibold flex items-center gap-1.5" aria-live="polite">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
              <span className="tnum">{unread} Unread</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={headerBtn} onClick={() => markAll.mutate()} disabled={unread === 0 || markAll.isPending}>
              <Icon name="done_all" className="text-[16px]" />
              <span>Mark All as Read</span>
            </button>
            <button type="button" className={headerBtn} onClick={() => setPrefsOpen(true)}>
              <Icon name="settings" className="text-[16px]" />
              <span>Notification Preferences</span>
            </button>
          </div>
        </div>
        <p className="text-body-md font-body-md text-text-secondary -mt-1">Stay informed about campaign performance, new leads, and account health.</p>
      </div>

      <div className="bg-surface-card border border-border-strong rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 text-label-md font-label-md max-w-full" role="tablist" aria-label="Notification categories">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors duration-150',
                tab === t ? 'bg-text-primary text-white font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas font-medium',
              )}
            >
              {t === 'all' ? 'All' : t === 'unread' ? 'Unread' : categoryLabels[t]} ({counts(t)})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="h-8 pl-2.5 pr-8 bg-surface-canvas font-label-md text-text-primary rounded-lg border border-border-strong focus:outline-none focus:border-border-focused text-xs cursor-pointer appearance-none"
            >
              <option value="all">Priority: All</option>
              {(Object.keys(priorityLabels) as NotificationPriority[]).map((p) => (
                <option key={p} value={p}>
                  {priorityLabels[p]}
                </option>
              ))}
            </select>
            <Icon name="expand_more" className="text-[14px] text-text-secondary pointer-events-none absolute right-2 top-2" />
          </div>
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <input
              type="search"
              aria-label="Search notifications"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full h-8 pl-8 pr-3 font-label-md bg-surface-canvas rounded-lg border border-border-strong text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focused text-xs"
            />
            <Icon name="search" className="text-[16px] text-text-tertiary absolute left-2.5 top-2 pointer-events-none" />
          </div>
        </div>
      </div>

      <QueryState query={query} loading={<FeedSkeleton />} empty={<AllCaughtUp onReset={resetFilters} onRules={() => setPrefsOpen(true)} />}>
        {() =>
          visible.length === 0 ? (
            <AllCaughtUp onReset={resetFilters} onRules={() => setPrefsOpen(true)} />
          ) : (
            <div className="flex flex-col gap-6">
              {groupOrder.map((g) => {
                const groupItems = visible.filter((n) => n.group === g);
                if (groupItems.length === 0) return null;
                return (
                  <section key={g} className="flex flex-col gap-2.5" aria-label={groupLabels[g]}>
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-label-sm font-label-sm font-bold text-text-secondary uppercase tracking-wider">{groupLabels[g]}</h2>
                      <span className="text-label-code font-label-code text-text-tertiary">
                        {groupItems.length} update{groupItems.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {groupItems.map((n) => (
                      <NotificationCard
                        key={n.id}
                        item={n}
                        onOpen={() => open(n)}
                        onInspect={() => setInspect(n)}
                        onToggleRead={() => toggleRead(n)}
                        onAction={(a) => runAction(n, a)}
                      />
                    ))}
                  </section>
                );
              })}
            </div>
          )
        }
      </QueryState>

      <NotificationDetailModal item={inspect} onClose={() => setInspect(null)} onAction={(a) => inspect && runAction(inspect, a)} />
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}
