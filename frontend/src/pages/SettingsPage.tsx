import { modeText } from '@/lib/config';
import { useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { AiTab } from '@/features/settings/AiTab';
import { DataSyncTab } from '@/features/settings/DataSyncTab';
import { GeneralTab } from '@/features/settings/GeneralTab';
import { InstagramTab } from '@/features/settings/InstagramTab';
import { NotificationsTab } from '@/features/settings/NotificationsTab';
import { SecurityTab } from '@/features/settings/SecurityTab';
import { TeamTab } from '@/features/settings/TeamTab';
import { sectionLabels, useSettingsDraft } from '@/features/settings/useSettingsDraft';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { settingsService } from '@/services/settings';
import { workspaceService } from '@/services/workspace';
import type { SettingsSection, SettingsTab } from '@/types/settings';

const TAB_IDS: SettingsTab[] = ['general', 'workspace', 'instagram', 'data-sync', 'ai', 'notifications', 'security'];
const sectionForTab: Partial<Record<SettingsTab, SettingsSection>> = { general: 'general', 'data-sync': 'sync', ai: 'ai', notifications: 'notifications' };

const DirtyDot = () => <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" />;

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" role="status" aria-label="Loading settings">
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') as SettingsTab | null;
  const tab: SettingsTab = rawTab && TAB_IDS.includes(rawTab) ? rawTab : 'general';

  const settingsQ = useQuery('settings:workspace', settingsService.get);
  const envQ = useQuery('settings:environment', settingsService.environment);
  const sessionQ = useQuery('settings:session', settingsService.session);
  const accountsQ = useQuery('accounts:list', accountService.list);
  const teamQ = useQuery('workspace:team', workspaceService.team);

  const form = useSettingsDraft(settingsQ.data, (_result, changed) =>
    toast({
      title: 'Workspace settings saved',
      description: `${changed.map((c) => sectionLabels[c]).join(', ')} ${modeText("updated in this session's in-memory demo store and recorded in the Activity Log. No backend services were reconfigured.", 'saved to the InstaBoard database and recorded in the Activity Log. No scheduler, AI engine or notification provider is connected yet.')}`,
    }),
  );

  const setTab = (t: SettingsTab) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  const dirty = (t: SettingsTab) => {
    const s = sectionForTab[t];
    return !!s && form.dirtySections.includes(s);
  };
  const canSave = form.isDirty && !form.hasErrors && !form.isSaving;
  const accounts = accountsQ.data ?? [];
  const primary = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const connectedOk = accounts.some((a) => a.status === 'connected');

  const tabs = [
    { value: 'general' as const, icon: 'domain', label: <>General{dirty('general') && <DirtyDot />}</> },
    { value: 'workspace' as const, icon: 'groups', label: 'Workspace & Team', count: teamQ.data?.length },
    {
      value: 'instagram' as const,
      icon: 'hub',
      label: (
        <>
          Instagram Integrations
          <span className={cn('w-2 h-2 rounded-full', connectedOk ? 'bg-status-active' : 'bg-status-paused')} aria-hidden />
        </>
      ),
    },
    { value: 'data-sync' as const, icon: 'sync_saved_locally', label: <>Data Synchronization{dirty('data-sync') && <DirtyDot />}</> },
    {
      value: 'ai' as const,
      icon: 'auto_awesome',
      iconClassName: 'text-ai-accent',
      label: (
        <>
          AI Preferences
          <span className="px-1.5 rounded-full bg-ai-subtle text-[10px] font-bold text-ai-accent border border-ai-border">v4.2</span>
          {dirty('ai') && <DirtyDot />}
        </>
      ),
    },
    { value: 'notifications' as const, icon: 'notifications_active', label: <>Notifications{dirty('notifications') && <DirtyDot />}</> },
    { value: 'security' as const, icon: 'security', label: 'Security & Privacy' },
  ];

  return (
    <div className="pb-4">
      {/* Page header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border-strong">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: 'InstaBoard Enterprise', to: '/dashboard' }, { label: 'Settings & Workspace' }]} className="mb-1.5" />
          <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary font-bold tracking-tight">Settings &amp; Workspace Configuration</h1>
          <p className="font-body-md text-body-md text-text-secondary mt-0.5">
            Configure enterprise parameters, Meta Graph OAuth tokens, sync cadence, and operator permissions for Eko India Financial Services.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {form.isDirty ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Unsaved changes</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-status-active-subtle border border-emerald-200 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-status-active" />
              <span>{modeText('All changes saved (demo store)', 'All changes saved')}</span>
            </div>
          )}
          <button
            type="button"
            onClick={form.save}
            disabled={!canSave}
            className="h-9 px-4 rounded bg-primary-container text-text-primary font-label-md text-label-md font-bold hover:bg-brand-primary-hover shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name={form.isSaving ? 'progress_activity' : 'check'} className={cn('text-[18px]', form.isSaving && 'animate-spin')} />
            <span>{form.isSaving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Settings sections" className="mb-6" />

      <div role="tabpanel" aria-label={tab}>
        <QueryState query={settingsQ} loading={<SettingsSkeleton />}>
          {() =>
            !form.draft ? (
              <SettingsSkeleton />
            ) : (
              <>
                {tab === 'general' && (
                  <GeneralTab
                    s={form.draft}
                    update={form.update}
                    errors={form.errors}
                    accounts={accounts}
                    environment={envQ.data}
                    presentationDirty={dirty('general')}
                    onSave={form.save}
                    saving={form.isSaving}
                    canSave={canSave}
                  />
                )}
                {tab === 'workspace' && <TeamTab />}
                {tab === 'instagram' && <InstagramTab />}
                {tab === 'data-sync' && <DataSyncTab s={form.draft} update={form.update} errors={form.errors} primary={primary} />}
                {tab === 'ai' && <AiTab s={form.draft} update={form.update} errors={form.errors} />}
                {tab === 'notifications' && <NotificationsTab s={form.draft} update={form.update} errors={form.errors} />}
                {tab === 'security' && <SecurityTab session={sessionQ.data} retentionDays={form.draft.sync.retentionDays} />}
                {form.baseline && (
                  <p className="mt-4 text-[11px] text-text-tertiary">
                    Last saved {form.baseline.updatedAt} by {form.baseline.updatedBy}.
                  </p>
                )}
              </>
            )
          }
        </QueryState>
      </div>

      {/* Sticky unsaved-changes bar */}
      {form.isDirty && (
        <div className="sticky bottom-4 z-20 mt-6" role="region" aria-label="Unsaved changes">
          <div className="bg-text-primary text-white rounded-lg shadow-flyout px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Icon name="edit_note" className="text-[20px] text-primary-container mt-px" />
              <div className="min-w-0">
                <p className="text-label-md font-semibold">Unsaved changes in {form.dirtySections.map((s) => sectionLabels[s]).join(', ')}</p>
                <p className="text-body-sm text-slate-300">
                  {form.hasErrors ? 'Fix the highlighted fields before saving.' : modeText('Saving stores the configuration in memory for this browser session only.', 'Saving stores the configuration in the InstaBoard database.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" className="text-slate-200 hover:text-white hover:bg-white/10" onClick={form.discard} disabled={form.isSaving}>
                Discard
              </Button>
              <Button variant="primary" icon="check" onClick={form.save} disabled={!canSave} loading={form.isSaving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
