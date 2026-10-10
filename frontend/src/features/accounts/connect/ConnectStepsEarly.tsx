import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { cn } from '@/lib/format';
import type { ConnectPrerequisite, ScopeDefinition } from '@/types/accounts';
import type { AccountType } from '@/types/domain';
import { META_DOCS_URL } from '../AccountsOverview';
import type { ConnectFormState } from './connectState';

type Patch = (p: Partial<ConnectFormState>) => void;

export function SecurityBanner() {
  return (
    <div className="p-3.5 rounded-lg bg-surface-canvas border border-border-strong flex items-start gap-3">
      <Icon name="verified_user" className="text-primary-container text-xl flex-shrink-0 mt-0.5" />
      <div className="text-body-sm font-body-sm">
        <span className="font-bold text-text-primary">Security Guarantee:</span>
        <span className="text-text-secondary">
          {' '}
          Eko InstaBoard never asks for or stores your Instagram password. When the backend is connected, authentication will use official Meta OAuth 2.0 with time-limited
          tokens and zero write-access to your direct messages.
        </span>
      </div>
    </div>
  );
}

function CheckRow({ checked, onChange, label, readOnly }: { checked: boolean; onChange?: (v: boolean) => void; label: string; readOnly?: boolean }) {
  return (
    <label className={cn('flex items-start gap-2 bg-surface-card p-2.5 rounded border transition-colors', checked ? 'border-emerald-200' : 'border-border-strong', !readOnly && 'cursor-pointer hover:border-slate-300')}>
      {readOnly ? (
        <Icon name="check_circle" filled className="text-status-active text-lg flex-shrink-0" />
      ) : (
        <input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-text-primary focus:ring-0 cursor-pointer flex-shrink-0" />
      )}
      <span className="text-body-sm font-body-sm text-text-primary font-medium">{label}</span>
    </label>
  );
}

export function PrerequisitesSection({
  prerequisites,
  checked,
  onToggle,
  readOnly,
  error,
}: {
  prerequisites: ConnectPrerequisite[];
  checked: string[];
  onToggle?: (id: string, v: boolean) => void;
  readOnly?: boolean;
  error?: string;
}) {
  const done = prerequisites.filter((p) => checked.includes(p.id)).length;
  return (
    <div role="group" aria-labelledby="prereq-title" className="p-4 rounded-lg border border-border-strong bg-surface-canvas/50">
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <h3 id="prereq-title" className="text-headline-sm font-headline-sm text-text-primary font-bold">
          A. Account Prerequisites Checklist
        </h3>
        <span
          className={cn(
            'text-label-code font-label-code uppercase tracking-wider px-2 py-0.5 rounded-full border',
            done === prerequisites.length ? 'bg-status-active-subtle border-emerald-200 text-status-active' : 'bg-surface-card-subtle border-border-strong text-text-secondary',
          )}
        >
          {done} of {prerequisites.length} Confirmed
        </span>
      </div>
      {!readOnly && <p className="text-body-sm text-text-secondary mb-2.5">Confirm each requirement on your Meta account. InstaBoard can’t verify these in the prototype.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {prerequisites.map((p) => (
          <CheckRow key={p.id} label={p.label} checked={checked.includes(p.id)} readOnly={readOnly} onChange={(v) => onToggle?.(p.id, v)} />
        ))}
      </div>
      {error && (
        <p className="text-[11px] text-error font-medium mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const typeOptions: Array<{ value: AccountType; title: string; body: string; icon: string }> = [
  { value: 'business', title: 'Business account', body: 'Brands and companies. Full insights, comments and demographics.', icon: 'business_center' },
  { value: 'creator', title: 'Creator account', body: 'Public figures and field storytellers. Same insights scopes.', icon: 'person' },
];

export function StepRequirements({ state, patch, prerequisites, errors }: { state: ConnectFormState; patch: Patch; prerequisites: ConnectPrerequisite[]; errors: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <SecurityBanner />
      <fieldset className="p-4 rounded-lg border border-border-strong">
        <legend className="text-headline-sm font-headline-sm text-text-primary font-bold px-1">Instagram account type</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1" role="radiogroup">
          {typeOptions.map((o) => {
            const active = state.accountType === o.value;
            return (
              <label key={o.value} className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors', active ? 'border-primary-container bg-amber-50/40' : 'border-border-strong hover:border-slate-300')}>
                <input type="radio" name="account-type" className="mt-1 h-4 w-4 text-text-primary focus:ring-0" checked={active} onChange={() => patch({ accountType: o.value })} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-label-md font-semibold text-text-primary">
                    <Icon name={o.icon} className="text-[16px] text-text-secondary" />
                    {o.title}
                  </span>
                  <span className="block text-body-sm text-text-secondary mt-0.5">{o.body}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-text-tertiary mt-2">Personal Instagram profiles aren’t supported by the Instagram Graph API.</p>
        {errors.accountType && (
          <p className="text-[11px] text-error font-medium mt-1" role="alert">
            {errors.accountType}
          </p>
        )}
      </fieldset>
      <PrerequisitesSection
        prerequisites={prerequisites}
        checked={state.prerequisites}
        error={errors.prerequisites}
        onToggle={(id, v) => patch({ prerequisites: v ? [...state.prerequisites, id] : state.prerequisites.filter((p) => p !== id) })}
      />
    </div>
  );
}

type Outcome = 'success' | 'permissions' | 'personal';

function OutcomePreviews() {
  const [outcome, setOutcome] = useState<Outcome>('success');
  const pills: Array<{ value: Outcome; label: string; active: string }> = [
    { value: 'success', label: 'Preview: Success (Account Ready)', active: 'font-bold border-border-focused text-text-primary shadow-sm' },
    { value: 'permissions', label: 'Preview: Insufficient Permissions Alert', active: 'font-bold bg-status-paused-subtle border-status-paused text-status-paused shadow-sm' },
    { value: 'personal', label: 'Preview: Unsupported Personal Account', active: 'font-bold bg-error-container/40 border-error text-error shadow-sm' },
  ];
  return (
    <div className="p-4 rounded-lg border border-border-strong bg-surface-canvas/60">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon name="science" className="text-text-secondary text-base" />
          <h4 className="text-headline-sm font-headline-sm text-text-primary font-bold">D. Authorization Outcome Previews</h4>
        </div>
        <span className="text-label-sm font-label-sm text-text-secondary">Illustrative screens — click to preview:</span>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap" role="tablist" aria-label="Outcome previews">
        {pills.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={outcome === p.value}
            onClick={() => setOutcome(p.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-label-sm font-label-sm bg-surface-card border transition-all',
              outcome === p.value ? p.active : 'font-medium border-border-strong text-text-secondary hover:text-text-primary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="p-3.5 rounded-lg border border-border-strong bg-surface-card" role="tabpanel">
        {outcome === 'success' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-status-active-subtle border border-emerald-200 flex items-center justify-center text-status-active flex-shrink-0">
                <Icon name="verified" className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-headline-sm font-headline-sm text-text-primary">Example Professional Account</p>
                  <span className="text-label-code font-label-code uppercase tracking-wider px-2 py-0.5 rounded-full bg-status-active-subtle text-status-active font-semibold">Professional</span>
                </div>
                <p className="text-body-sm font-body-sm text-text-secondary">
                  Facebook Page Linked: <strong className="text-text-primary">Example Page</strong> • Token Validity: 60 Days
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-label-sm font-label-sm font-bold text-status-active px-3 py-1 rounded bg-status-active-subtle self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-status-active" /> Ready to Sync
            </span>
          </div>
        )}
        {outcome === 'permissions' && (
          <div className="flex items-start gap-3">
            <Icon name="warning" className="text-2xl text-status-paused flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-headline-sm font-headline-sm text-text-primary">Insufficient Permissions: Missing 'instagram_manage_insights'</p>
              <p className="text-body-sm font-body-sm text-text-secondary">
                Shown when the authenticated user is an Editor rather than an Admin on the managing Facebook Page. Reach insights can’t be polled until full administrative
                permissions are authorized.
              </p>
            </div>
          </div>
        )}
        {outcome === 'personal' && (
          <div className="flex items-start gap-3">
            <Icon name="error" className="text-2xl text-error flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-headline-sm font-headline-sm text-text-primary">Unsupported Personal Instagram Account</p>
              <p className="text-body-sm font-body-sm text-text-secondary">
                Meta Graph API strictly requires switching to a <strong className="text-text-primary">Professional Business or Creator</strong> account in Instagram Mobile App
                Settings &gt; Account Type.
              </p>
              <a className="text-label-sm font-label-sm text-tertiary font-bold underline inline-block pt-1" href={META_DOCS_URL} target="_blank" rel="noopener noreferrer">
                Read Meta’s Instagram Platform docs →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScopesDisclosure({ scopes }: { scopes: ScopeDefinition[] }) {
  const [open, setOpen] = useState(true);
  const mandatory = scopes.filter((s) => s.mandatory);
  return (
    <div className="border border-border-strong rounded-lg overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="scopes-disclosure"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 bg-surface-canvas flex items-center justify-between gap-2 hover:bg-surface-container-low transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Icon name="policy" className="text-text-secondary text-lg" />
          <span className="text-headline-sm font-headline-sm text-text-primary font-bold">C. Required API Permissions &amp; Scopes Disclosure</span>
          <span className="text-label-sm font-label-sm text-text-secondary">({mandatory.length} Required Scopes)</span>
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-text-secondary text-lg" />
      </button>
      {open && (
        <div id="scopes-disclosure" className="p-4 bg-surface-card space-y-3 border-t border-border-strong">
          {mandatory.map((s) => (
            <div key={s.scope} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border-strong bg-surface-card">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-label-code font-label-code text-primary bg-primary-fixed/30 px-2 py-0.5 rounded font-bold">{s.scope}</code>
                  <span className="text-label-code font-label-code uppercase tracking-wider text-status-active bg-status-active-subtle px-1.5 py-0.5 rounded font-bold">Mandatory</span>
                </div>
                <p className="text-body-sm font-body-sm text-text-secondary">{s.connectDescription}</p>
              </div>
              <Icon name="check_circle" className="text-text-tertiary text-lg" />
            </div>
          ))}
          <div className="flex items-center gap-2 text-label-sm font-label-sm text-text-tertiary p-2 rounded bg-surface-canvas">
            <Icon name="info" className="text-base text-status-paused" />
            <span>Note on Meta Limitations: Meta requires ≥100 followers for demographic age/gender distribution breakdowns. Story telemetry expires after 24 hours.</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StepAuthorization({
  state,
  patch,
  prerequisites,
  scopes,
  error,
}: {
  state: ConnectFormState;
  patch: Patch;
  prerequisites: ConnectPrerequisite[];
  scopes: ScopeDefinition[];
  error?: string;
}) {
  return (
    <div className="space-y-5">
      <SecurityBanner />
      <PrerequisitesSection prerequisites={prerequisites} checked={state.prerequisites} readOnly />

      <div className="p-5 rounded-lg border-2 border-primary-container/30 bg-surface-container-low/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="key" className="text-primary text-xl" />
              <h3 className="text-headline-sm font-headline-sm text-text-primary font-bold">B. Authenticate via Meta Business Login</h3>
            </div>
            <p className="text-body-sm font-body-sm text-text-secondary max-w-xl">
              In production you will be redirected to Meta to approve data sharing for the Eko InstaBoard analytics scopes, then pick one or more brand pages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => patch({ authAttempted: true })}
            className="flex-shrink-0 flex items-center justify-center gap-2.5 bg-primary-container hover:bg-brand-primary-hover text-text-primary font-bold text-label-md font-label-md px-5 py-3 rounded-lg shadow-sm border border-primary/20 transition-all duration-150 hover:-translate-y-0.5"
          >
            <Icon name="lock" className="text-lg" />
            <span>Continue with Facebook / Meta Login</span>
            <Icon name="arrow_forward" className="text-base" />
          </button>
        </div>

        {(state.authAttempted || state.demoMode) && (
          <div className="space-y-3" aria-live="polite">
            <Notice tone="warning" icon="cloud_off" title="Meta authorization isn't available in this prototype">
              It will open Facebook Login once the FastAPI backend is connected. No request was sent to Meta and no token was created.
            </Notice>
            {state.demoMode ? (
              <Notice tone="demo" title="Demo walkthrough enabled">
                The next steps use clearly-labelled sample accounts. Nothing will be connected.
              </Notice>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="dark" icon="science" onClick={() => patch({ demoMode: true })}>
                  Continue with demo account
                </Button>
                <span className="text-body-sm text-text-secondary">Walk through the remaining steps using sample data.</span>
              </div>
            )}
          </div>
        )}
        {error && (
          <p className="text-[11px] text-error font-medium" role="alert">
            {error}
          </p>
        )}
      </div>

      <ScopesDisclosure scopes={scopes} />
      <OutcomePreviews />
    </div>
  );
}
