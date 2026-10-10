import { DemoBadge } from '@/components/ui/Badge';
import { Field, Select, Toggle } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { cn, formatCompact } from '@/lib/format';
import type { ConnectCandidate, ScopeDefinition } from '@/types/accounts';
import { accountTypeLabel } from '../accountMeta';
import { backfillOptions, cadenceOptions, type ConnectFormState } from './connectState';

type Patch = (p: Partial<ConnectFormState>) => void;

const outcomeMeta: Record<ConnectCandidate['outcome'], { label: string; cls: string; icon: string; selectable: boolean }> = {
  ready: { label: 'Eligible', cls: 'bg-status-active-subtle text-[#065F46] border-[#A7F3D0]', icon: 'check_circle', selectable: true },
  already_linked: { label: 'Already in workspace', cls: 'bg-surface-card-subtle text-text-secondary border-border-strong', icon: 'link', selectable: false },
  insufficient_permissions: { label: 'Insufficient permissions', cls: 'bg-status-paused-subtle text-[#92400E] border-[#FDE68A]', icon: 'warning', selectable: false },
  personal: { label: 'Unsupported personal account', cls: 'bg-error-container/60 text-on-error-container border-error/20', icon: 'error', selectable: false },
};

export const isSelectableCandidate = (c: ConnectCandidate | undefined) => !!c && outcomeMeta[c.outcome].selectable;

const candidateTypeLabel = (c: ConnectCandidate) => (c.type === 'personal' ? 'Personal profile' : accountTypeLabel[c.type]);

export function StepScopes({
  state,
  patch,
  candidates,
  scopes,
  errors,
}: {
  state: ConnectFormState;
  patch: Patch;
  candidates: ConnectCandidate[];
  scopes: ScopeDefinition[];
  errors: Record<string, string>;
}) {
  const selected = candidates.find((c) => c.id === state.candidateId);
  return (
    <div className="space-y-5">
      <Notice tone="demo" title="Demo walkthrough — sample accounts">
        Meta would normally return the Instagram accounts linked to your Facebook Pages here. These are bundled sample accounts, not data fetched from Meta.
      </Notice>

      <div role="group" aria-labelledby="candidate-title" className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 id="candidate-title" className="text-headline-sm font-headline-sm text-text-primary font-bold">
            Select an Instagram account
          </h3>
          <DemoBadge label="Sample accounts" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="candidate-title">
          {candidates.map((c) => {
            const meta = outcomeMeta[c.outcome];
            const active = state.candidateId === c.id;
            return (
              <label
                key={c.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  active ? (meta.selectable ? 'border-primary-container bg-amber-50/40' : 'border-error/40 bg-error-container/10') : 'border-border-strong hover:border-slate-300',
                )}
              >
                <input type="radio" name="candidate" className="mt-1 h-4 w-4 text-text-primary focus:ring-0" checked={active} onChange={() => patch({ candidateId: c.id })} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-label-md font-semibold text-text-primary">{c.displayName}</span>
                    <span className="text-body-sm text-text-secondary">@{c.handle}</span>
                  </span>
                  <span className="block text-body-sm text-text-secondary mt-0.5">
                    {candidateTypeLabel(c)} · <span className="tnum">{formatCompact(c.followers)}</span> followers
                    {c.facebookPage && <> · Page: {c.facebookPage}</>}
                  </span>
                  <span className={cn('inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border', meta.cls)}>
                    <Icon name={meta.icon} className="text-[13px]" />
                    {meta.label}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {selected && !isSelectableCandidate(selected) && (
          <Notice tone="warning" title={outcomeMeta[selected.outcome].label}>
            {selected.outcomeNote}
          </Notice>
        )}
        {errors.candidate && (
          <p className="text-[11px] text-error font-medium" role="alert">
            {errors.candidate}
          </p>
        )}
      </div>

      <div className="p-4 rounded-lg border border-border-strong space-y-3">
        <h3 className="text-headline-sm font-headline-sm text-text-primary font-bold">Scopes InstaBoard will request</h3>
        <ul className="space-y-2">
          {scopes.map((s) => (
            <li key={s.scope} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <code className="text-label-code font-label-code text-primary bg-primary-fixed/30 px-2 py-0.5 rounded font-bold">{s.scope}</code>
                <p className="text-body-sm text-text-secondary mt-1">{s.connectDescription}</p>
              </div>
              {s.mandatory ? (
                <span className="text-label-code font-label-code uppercase tracking-wider text-status-active bg-status-active-subtle px-1.5 py-0.5 rounded font-bold whitespace-nowrap">Mandatory</span>
              ) : (
                <Toggle
                  checked={state.includeOptionalScopes}
                  onChange={(v) => patch({ includeOptionalScopes: v })}
                  label={<span className="sr-only">Request optional scope {s.scope}</span>}
                  className="shrink-0"
                />
              )}
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2 pt-3 border-t border-border-subtle cursor-pointer">
          <input
            type="checkbox"
            checked={state.scopesAcknowledged}
            onChange={(e) => patch({ scopesAcknowledged: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-text-primary focus:ring-0 cursor-pointer"
            aria-invalid={!!errors.ack || undefined}
          />
          <span className="text-body-sm text-text-primary">
            I understand InstaBoard requests read-only access to insights and comments, and never to direct messages or account settings.<span className="text-error ml-0.5">*</span>
          </span>
        </label>
        {errors.ack && (
          <p className="text-[11px] text-error font-medium" role="alert">
            {errors.ack}
          </p>
        )}
      </div>
    </div>
  );
}

export function StepConfirm({ state, patch, candidate, scopes }: { state: ConnectFormState; patch: Patch; candidate: ConnectCandidate | undefined; scopes: ScopeDefinition[] }) {
  const requested = scopes.filter((s) => s.mandatory || state.includeOptionalScopes);
  return (
    <div className="space-y-5">
      <Notice tone="warning" icon="cloud_off" title="Nothing will be connected">
        Finishing this walkthrough doesn’t create a token or add an account — the FastAPI backend and Meta app review are required for a real connection.
      </Notice>
      <div className="p-4 rounded-lg border border-border-strong bg-surface-canvas/50">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-headline-sm font-headline-sm text-text-primary font-bold">Review (sample data)</h3>
          <DemoBadge label="Demo preview (not connected)" />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
          <div>
            <dt className="text-text-secondary">Account</dt>
            <dd className="text-text-primary font-semibold">
              {candidate ? (
                <>
                  {candidate.displayName} <span className="font-normal text-text-secondary">@{candidate.handle}</span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Account type</dt>
            <dd className="text-text-primary font-semibold">{candidate ? candidateTypeLabel(candidate) : '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Linked Facebook Page</dt>
            <dd className="text-text-primary font-semibold">{candidate?.facebookPage ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Connection status</dt>
            <dd className="text-text-primary font-semibold">Demo preview (not connected)</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-text-secondary mb-1">Scopes that would be requested</dt>
            <dd className="flex flex-wrap gap-1.5">
              {requested.map((s) => (
                <code key={s.scope} className="text-label-code font-label-code text-primary bg-primary-fixed/30 px-2 py-0.5 rounded font-bold">
                  {s.scope}
                </code>
              ))}
            </dd>
          </div>
        </dl>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sync cadence (preference)" htmlFor="connect-cadence" hint="Applied once real syncing is available.">
          <Select id="connect-cadence" value={state.cadence} onChange={(e) => patch({ cadence: e.target.value })}>
            {cadenceOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Historical backfill (preference)" htmlFor="connect-backfill" hint="Meta allows up to 10,000 historic media objects.">
          <Select id="connect-backfill" value={state.backfill} onChange={(e) => patch({ backfill: e.target.value })}>
            {backfillOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

export function ConnectDone({ state, candidate }: { state: ConnectFormState; candidate: ConnectCandidate | undefined }) {
  return (
    <div className="text-center py-6 space-y-4">
      <div className="w-14 h-14 rounded-full bg-surface-card-subtle border border-border-strong flex items-center justify-center mx-auto text-ai-accent">
        <Icon name="science" className="text-[30px]" />
      </div>
      <div>
        <h3 className="font-headline-md text-headline-md text-text-primary">Demo walkthrough complete</h3>
        <p className="text-body-md text-text-secondary mt-1 max-w-lg mx-auto">
          <strong className="text-text-primary">No Instagram account was connected.</strong> Meta authorization isn’t available in this prototype, and your account list was
          not changed.
        </p>
      </div>
      <div className="max-w-md mx-auto text-left p-3 rounded-lg bg-surface-canvas border border-border-strong text-body-sm text-text-secondary space-y-1.5">
        <div className="flex justify-between gap-3">
          <span>Sample account previewed</span>
          <span className="font-semibold text-text-primary text-right">{candidate ? `@${candidate.handle}` : '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Status</span>
          <span className="font-semibold text-text-primary text-right">Demo preview (not connected)</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Cadence preference</span>
          <span className="font-semibold text-text-primary text-right">{state.cadence}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Backfill preference</span>
          <span className="font-semibold text-text-primary text-right">{state.backfill}</span>
        </div>
      </div>
      <p className="text-body-sm text-text-tertiary">Once the FastAPI backend is connected, this flow will open Facebook Login and add the authorized account.</p>
    </div>
  );
}
