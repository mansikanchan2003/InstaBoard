import { modeText } from '@/lib/config';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { formatNumber } from '@/lib/format';
import { settingsService } from '@/services/settings';
import type { InstagramAccount } from '@/types/domain';
import type { DateFormatOption, NumberFormatOption, SettingsEnvironment, TimezoneOption, WorkspaceSettings } from '@/types/settings';
import type { SettingsErrors } from './useSettingsDraft';
import { FieldError, inputCls, labelCls, SettingsCard, Switch } from './settingsUi';

export interface SectionProps {
  s: WorkspaceSettings;
  update: (fn: (d: WorkspaceSettings) => void) => void;
  errors: SettingsErrors;
}

const brandTokens = [
  { name: 'primary-container', hex: '#F5A623', use: 'Primary actions, active tab underline' },
  { name: 'brand-primary-hover', hex: '#D97706', use: 'Primary hover' },
  { name: 'text-primary', hex: '#0F172A', use: 'Headlines, metric values' },
  { name: 'ai-accent', hex: '#6366F1', use: 'AI-generated content only' },
  { name: 'status-active', hex: '#10B981', use: 'Healthy / success states' },
  { name: 'surface-canvas', hex: '#F8FAFC', use: 'Page background' },
];

export function GeneralTab({
  s,
  update,
  errors,
  accounts,
  environment,
  presentationDirty,
  onSave,
  saving,
  canSave,
}: SectionProps & {
  accounts: InstagramAccount[];
  environment?: SettingsEnvironment;
  presentationDirty: boolean;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  const toast = useToast();
  const [guidelines, setGuidelines] = useState(false);
  const g = s.general;
  const defaults = settingsService.defaults().general;
  const connected = accounts.filter((a) => a.status !== 'expired').length;
  const sample = 1234567;

  return (
    <section className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Workspace identity */}
          <SettingsCard>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-border-strong">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">Workspace Identity</h2>
                <p className="font-body-sm text-body-sm text-text-secondary">Official Eko entity name and branding assets utilized across export reports.</p>
              </div>
              <span className="font-label-code text-label-code bg-surface-card-subtle px-2 py-0.5 rounded border border-border-strong text-text-secondary self-start sm:self-auto shrink-0">
                ID: {g.workspaceCode}
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="ws-display-name" className={labelCls}>
                  Organization / Workspace Display Name
                </label>
                <input
                  id="ws-display-name"
                  type="text"
                  value={g.displayName}
                  aria-invalid={!!errors['general.displayName']}
                  onChange={(e) => update((d) => void (d.general.displayName = e.target.value))}
                  className={`${inputCls} ${errors['general.displayName'] ? 'border-error focus:ring-error' : ''}`}
                />
                {errors['general.displayName'] ? (
                  <FieldError message={errors['general.displayName']} />
                ) : (
                  <p className="font-body-sm text-body-sm text-text-tertiary mt-1">Rendered on synthesized PDF executive briefs and team sharing notifications.</p>
                )}
              </div>
              <div className="pt-2">
                <span className="block font-label-sm text-label-sm text-text-primary mb-1.5">Centrally Managed Enterprise Brand Asset</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-surface-canvas rounded border border-border-strong">
                  <div className="w-16 h-16 bg-surface-card rounded border border-border-strong flex items-center justify-center p-2 shrink-0">
                    <ImageWithFallback src={g.logoUrl} alt="Eko India Financial Services official brand avatar" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-label-md text-label-md font-semibold text-text-primary">{g.logoFileName}</span>
                      <span className="font-label-code text-label-code bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">LOCAL PNG ASSET</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-text-tertiary mt-0.5">Bundled with the prototype at {g.logoUrl}. Used in the sidebar, report headers and exports.</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="font-label-sm text-label-sm text-primary font-semibold hover:underline"
                        onClick={() =>
                          toast({ tone: 'demo', title: 'No brand CDN in this prototype', description: `The logo is a local file (${g.logoUrl}); there is no Eko Brand Kit SSO to re-fetch from.` })
                        }
                      >
                        Re-fetch from CDN
                      </button>
                      <span className="text-text-tertiary">•</span>
                      <button type="button" className="font-label-sm text-label-sm text-text-secondary hover:underline" onClick={() => setGuidelines(true)}>
                        View Brand Token Guidelines
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Localization */}
          <SettingsCard>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold pb-2">Localization &amp; Telemetry Standards</h2>
            <p className="font-body-sm text-body-sm text-text-secondary mb-4">Baseline formats applied automatically to time-series charts and financial lead calculations.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ws-tz" className={labelCls}>
                  Time Zone (Chronos Standard)
                </label>
                <select id="ws-tz" className={inputCls} value={g.timezone} onChange={(e) => update((d) => void (d.general.timezone = e.target.value as TimezoneOption))}>
                  <option value="Asia/Kolkata">(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi (IST)</option>
                  <option value="UTC">(UTC+00:00) UTC Universal Time</option>
                  <option value="Asia/Kathmandu">(UTC+05:45) Kathmandu</option>
                </select>
              </div>
              <div>
                <label htmlFor="ws-date" className={labelCls}>
                  Date Format Display
                </label>
                <select id="ws-date" className={inputCls} value={g.dateFormat} onChange={(e) => update((d) => void (d.general.dateFormat = e.target.value as DateFormatOption))}>
                  <option value="MMM DD, YYYY">MMM DD, YYYY (e.g. Oct 31, 2024)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 31/10/2024)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                </select>
              </div>
              <div>
                <label htmlFor="ws-currency" className={labelCls}>
                  Default Reporting Currency
                </label>
                <div className="relative">
                  <input id="ws-currency" readOnly value="INR (₹)" className="w-full h-9 px-3 text-sm rounded bg-surface-canvas border border-border-strong text-text-primary font-medium cursor-not-allowed" />
                  <span className="absolute right-3 top-2.5 font-label-code text-label-code text-text-tertiary">LOCKED</span>
                </div>
              </div>
              <div>
                <label htmlFor="ws-number" className={labelCls}>
                  Number Format
                </label>
                <select id="ws-number" className={inputCls} value={g.numberFormat} onChange={(e) => update((d) => void (d.general.numberFormat = e.target.value as NumberFormatOption))}>
                  <option value="en-IN">Indian lakh / crore (e.g. {sample.toLocaleString('en-IN')})</option>
                  <option value="en-US">International (e.g. {sample.toLocaleString('en-US')})</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="ws-account" className={labelCls}>
                  Default Instagram Account
                </label>
                <select id="ws-account" className={inputCls} value={g.defaultAccountId} onChange={(e) => update((d) => void (d.general.defaultAccountId = e.target.value))}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.handle} ({a.displayName}
                      {a.isPrimary ? ' · Primary Business Account' : ''}
                      {a.status === 'expired' ? ' · token expired' : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsCard>

          {/* Presentation */}
          <SettingsCard>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold pb-1">Analytics Presentation Preferences</h2>
            <p className="font-body-sm text-body-sm text-text-secondary mb-4">Fine-tune density parameters and visual indicators across metrics cards.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 p-3 rounded bg-surface-canvas border border-border-strong">
                <div>
                  <div className="font-label-md text-label-md font-semibold text-text-primary">Dense Enterprise Data Grid</div>
                  <div className="font-body-sm text-body-sm text-text-secondary">Condenses whitespace and maximizes visible metrics without page vertical pagination.</div>
                </div>
                <Switch label="Dense enterprise data grid" checked={g.denseGrid} onChange={(v) => update((d) => void (d.general.denseGrid = v))} />
              </div>
              <div className="flex items-center justify-between gap-4 p-3 rounded bg-surface-canvas border border-border-strong">
                <div>
                  <div className="font-label-md text-label-md font-semibold text-text-primary">Period-over-Period Delta Micro-Badges</div>
                  <div className="font-body-sm text-body-sm text-text-secondary">Show standard MoM percentage comparisons (+18.4% MoM) on headline KPI summary tiles.</div>
                </div>
                <Switch label="Period-over-period delta badges" checked={g.deltaBadges} onChange={(v) => update((d) => void (d.general.deltaBadges = v))} />
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                {presentationDirty ? (
                  <>
                    <Icon name="edit_note" className="text-[16px] text-amber-600" />
                    <span>Unsaved changes on this tab</span>
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" className="text-[16px] text-emerald-600" />
                    <span>{modeText('All changes saved to the in-memory demo store', 'All changes saved to the InstaBoard database')}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-8 px-3 rounded bg-surface-card border border-border-strong text-text-secondary font-label-md text-label-md font-medium hover:bg-surface-canvas disabled:opacity-50"
                  disabled={g.denseGrid === defaults.denseGrid && g.deltaBadges === defaults.deltaBadges}
                  onClick={() =>
                    update((d) => {
                      d.general.denseGrid = defaults.denseGrid;
                      d.general.deltaBadges = defaults.deltaBadges;
                    })
                  }
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  className="h-8 px-4 rounded bg-primary-container text-text-primary font-label-md text-label-md font-semibold hover:bg-brand-primary-hover shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canSave || saving}
                  onClick={onSave}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </SettingsCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <SettingsCard>
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-text-secondary">Environment Telemetry</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-label-code text-label-code border border-amber-200">{environment?.environment ?? 'PROTOTYPE'}</span>
            </div>
            <div className="space-y-3 font-body-sm text-body-sm">
              {[
                ['API Host', <span className="font-medium text-text-primary text-xs">{environment?.apiHost ?? '—'}</span>],
                ['Schema Version', environment?.schemaVersion ?? '—'],
                ['Cron Frequency', s.sync.enabled ? `Every ${s.sync.intervalHours} Hours (IST, simulated)` : 'Paused'],
                ['Active Integrations', `${formatNumber(connected)} of ${formatNumber(accounts.length)} Instagram accounts`],
              ].map(([k, v], i) => (
                <div key={i} className="flex justify-between gap-3 py-1 border-b border-border-subtle">
                  <span className="text-text-secondary shrink-0">{k}</span>
                  <span className="font-medium text-text-primary text-right">{v}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 py-1">
                <span className="text-text-secondary">Workspace Plan</span>
                <span className="font-semibold text-primary text-right">{environment?.plan ?? '—'}</span>
              </div>
            </div>
          </SettingsCard>
          <div className="bg-surface-container-low border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2.5">
              <Icon name="verified_user" className="text-tertiary text-[20px] mt-0.5" />
              <div>
                <h3 className="font-label-md text-label-md font-bold text-on-surface">Data Isolation Assurance</h3>
                <p className="font-body-sm text-body-sm text-text-secondary mt-1">
                  InstaBoard is scoped to Instagram marketing telemetry. No individual personal passwords, payment instruments, or customer financial account records are processed in this
                  intelligence module — and this prototype holds only sample data in your browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={guidelines} onClose={() => setGuidelines(false)} title="Brand Token Guidelines" subtitle="Core InstaBoard design tokens (from the design system)" icon="palette" size="md">
        <ul className="divide-y divide-border-subtle">
          {brandTokens.map((t) => (
            <li key={t.name} className="flex items-center gap-3 py-2.5">
              <span className="w-8 h-8 rounded border border-border-strong shrink-0" style={{ backgroundColor: t.hex }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[12px] text-text-primary">{t.name}</div>
                <div className="text-body-sm text-text-secondary">{t.use}</div>
              </div>
              <span className="font-mono text-[12px] text-text-secondary">{t.hex}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
