import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { notificationService } from '@/services/notifications';
import { useAuth } from '@/app/AuthContext';
import { sessionWorkspace } from '@/services/workspace';
import { Button } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { GlobalSearch } from './GlobalSearch';

const DATE_PRESETS = [
  { id: 'last30', label: sessionWorkspace.reportingPeriod.label, covered: true },
  { id: 'last7', label: 'Last 7 Days: Oct 25 - Oct 31, 2024', covered: false },
  { id: 'last90', label: 'Last 90 Days: Aug 3 - Oct 31, 2024', covered: false },
  { id: 'qtd', label: 'Quarter to date: Oct 1 - Oct 31, 2024', covered: true },
] as const;

const statusMeta = {
  connected: { label: 'Connected', cls: 'text-status-active' },
  action_required: { label: 'Action required', cls: 'text-status-paused' },
  expired: { label: 'Expired', cls: 'text-error' },
  syncing: { label: 'Syncing', cls: 'text-status-completed' },
} as const;

/** Shared TopNavBar from the export: account pill, search, sync status, date range, Export / Sync Data, alerts, profile. */
export function TopBar() {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const signOut = async () => {
    await auth.logout();
    toast({ tone: 'success', title: 'Signed out', description: 'Your session was ended on the server.' });
    navigate('/login', { replace: true });
  };
  const { setMobileNavOpen, lastSyncedLabel, setLastSyncedLabel } = useAppUi();
  const accounts = useQuery('accounts:list', accountService.list);
  const unread = useQuery('notifications:unread', notificationService.unreadCount);
  const [preset, setPreset] = useState<(typeof DATE_PRESETS)[number]['id']>('last30');
  const primary = accounts.data?.find((a) => a.isPrimary);

  const sync = useMutation(() => accountService.requestSync(accountService.primaryId), {
    invalidate: ['accounts'],
    onSuccess: () => {
      setLastSyncedLabel('Synced just now');
      toast({
        tone: 'demo',
        title: 'Demo sync complete',
        description: 'No Instagram connection exists in this prototype — the bundled sample dataset was reloaded.',
      });
    },
  });

  const currentPreset = DATE_PRESETS.find((p) => p.id === preset)!;

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-14 z-20 bg-surface-card border-b border-border-strong flex items-center justify-between gap-3 px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button type="button" className="lg:hidden p-1.5 -ml-1 text-text-secondary hover:text-text-primary" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
          <Icon name="menu" className="text-[22px]" />
        </button>
        <img src="/eko-logo.png" alt="Eko" className="h-6 lg:hidden" />

        <Dropdown
          align="left"
          label="Instagram accounts"
          className="w-72"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-canvas border border-border-strong text-text-primary text-label-md hover:bg-surface-card-subtle transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-primary-container flex items-center justify-center font-bold text-[10px] text-text-primary">E</div>
              <span className="font-semibold text-text-primary font-headline-sm text-xs whitespace-nowrap">{primary?.displayName ?? sessionWorkspace.name}</span>
              <span className="text-text-tertiary font-normal hidden 2xl:inline">@{primary?.handle ?? 'ekoindia'}</span>
              <Icon name="verified" filled className="text-status-completed text-[16px]" />
              <Icon name="arrow_drop_down" className="text-[16px] text-text-secondary" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Instagram accounts (demo)</div>
              {(accounts.data ?? []).map((a) => (
                <MenuItem
                  key={a.id}
                  active={a.isPrimary}
                  onClick={() => {
                    close();
                    if (a.isPrimary) return;
                    navigate(`/accounts/${a.id}`);
                    toast({ tone: 'info', title: `Demo analytics are only available for @${primary?.handle ?? 'ekoindia'}`, description: `Opened @${a.handle} account details instead.` });
                  }}
                >
                  <span className="block font-semibold">{a.displayName}</span>
                  <span className={cn('block text-[11px]', statusMeta[a.status].cls)}>
                    @{a.handle} · {statusMeta[a.status].label}
                  </span>
                </MenuItem>
              ))}
              <div className="border-t border-border-strong mt-1 pt-1">
                <MenuItem
                  icon="add"
                  onClick={() => {
                    close();
                    navigate('/accounts/connect');
                  }}
                >
                  Connect Instagram account
                </MenuItem>
              </div>
            </>
          )}
        </Dropdown>

        <GlobalSearch className="flex-1 min-w-[9rem] max-w-72" />
      </div>

      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        <div className="hidden 2xl:flex items-center gap-2 px-2.5 py-1 rounded bg-surface-canvas border border-border-strong text-text-secondary font-label-sm text-label-sm whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-status-active animate-pulse" />
          <span>{lastSyncedLabel}</span>
          <button type="button" className="hover:text-text-primary ml-1 flex items-center text-text-secondary" onClick={() => sync.mutate()} title="Force sync (demo)" aria-label="Force sync (demo)">
            <Icon name="sync" className={cn('text-[16px]', sync.isPending && 'animate-spin')} />
          </button>
        </div>

        <Dropdown
          label="Date range"
          className="w-80"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-surface-canvas border border-border-strong rounded text-label-md text-text-primary hover:bg-surface-card-subtle"
            >
              <Icon name="calendar_today" className="text-[16px] text-text-secondary" />
              <span className="font-medium text-xs whitespace-nowrap hidden 2xl:inline">{currentPreset.label}</span>
              <span className="font-medium text-xs whitespace-nowrap 2xl:hidden">Oct 1 - Oct 31, 2024</span>
              <Icon name="arrow_drop_down" className="text-[16px] text-text-secondary" />
            </button>
          )}
        >
          {(close) => (
            <>
              {DATE_PRESETS.map((p) => (
                <MenuItem
                  key={p.id}
                  active={p.id === preset}
                  onClick={() => {
                    close();
                    setPreset(p.id);
                    if (!p.covered)
                      toast({ tone: 'warning', title: 'Outside the demo dataset', description: 'Sample data only covers Oct 1 – Oct 31, 2024, so figures still reflect that window.' });
                  }}
                >
                  {p.label}
                </MenuItem>
              ))}
              <p className="px-3 pt-2 pb-1 text-[11px] text-text-tertiary border-t border-border-strong mt-1">Demo dataset window: Oct 1 – Oct 31, 2024 (baseline Sep 2024).</p>
            </>
          )}
        </Dropdown>

        <Button size="sm" icon="tune" className="hidden md:inline-flex" onClick={() => navigate('/reports')}>
          Export
        </Button>
        <Button size="sm" variant="primary" icon="cloud_sync" onClick={() => sync.mutate()} loading={sync.isPending}>
          <span className="hidden sm:inline">Sync Data</span>
        </Button>
        <div className="h-5 w-px bg-border-strong mx-1 hidden sm:block" />
        <button type="button" className="relative p-1 text-text-secondary hover:text-text-primary" onClick={() => navigate('/notifications')} aria-label={`Notifications (${unread.data ?? 0} unread)`}>
          <Icon name="notifications" className="text-[22px]" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-status-paused text-[10px] font-bold text-white flex items-center justify-center tnum">{unread.data}</span>
          )}
        </button>
        <Dropdown
          label="Account"
          className="w-60"
          trigger={({ toggle, open }) => (
            <button type="button" className="flex items-center gap-2 pl-1" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu">
              <Avatar name={auth.displayName} />
              <span className="hidden xl:flex flex-col text-left">
                <span className="font-label-sm text-xs text-text-primary font-bold leading-none">{auth.displayName}</span>
                <span className="text-[10px] text-text-secondary leading-tight">{auth.displayRole}</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pt-1.5 pb-2 border-b border-border-strong">
                <p className="text-label-md font-semibold text-text-primary truncate">{auth.displayName}</p>
                <p className="text-[11px] text-text-tertiary truncate">{auth.me ? `${auth.me.user.email} · ${auth.workspaceName}` : 'Demo identity (no account)'}</p>
              </div>
              <MenuItem icon="settings" onClick={() => { close(); navigate('/settings'); }}>Settings</MenuItem>
              <MenuItem icon="shield_person" onClick={() => { close(); navigate('/settings?tab=security'); }}>Security & sessions</MenuItem>
              {auth.status === 'authenticated' ? (
                <MenuItem icon="logout" danger onClick={() => { close(); void signOut(); }}>Sign out</MenuItem>
              ) : (
                <p className="px-3 py-2 text-[11px] text-text-tertiary">Demo mode has no accounts — run in API mode to sign in.</p>
              )}
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
