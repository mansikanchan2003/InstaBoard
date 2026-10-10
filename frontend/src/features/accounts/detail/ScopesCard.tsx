import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/format';
import type { AccountTelemetry, ScopeDefinition, ScopeGrantStatus } from '@/types/accounts';

const grantMeta: Record<ScopeGrantStatus, { label: string; icon: string; cls: string }> = {
  approved: { label: 'Approved', icon: 'check', cls: 'text-[#065F46] bg-status-active-subtle border-[#A7F3D0]' },
  missing: { label: 'Not granted', icon: 'close', cls: 'text-[#92400E] bg-status-paused-subtle border-[#FDE68A]' },
  revoked: { label: 'Revoked', icon: 'block', cls: 'text-on-error-container bg-error-container/60 border-error/20' },
  not_requested: { label: 'Not requested', icon: 'remove', cls: 'text-text-secondary bg-surface-card-subtle border-border-strong' },
};

const footerTone = {
  active: { box: 'bg-status-completed-subtle border-[#BAE6FD]', icon: 'verified', iconCls: 'text-status-completed', title: 'text-[#0369A1]', body: 'text-[#0284C7]', btn: 'border-[#BAE6FD] text-[#0369A1]' },
  warning: { box: 'bg-status-paused-subtle border-[#FDE68A]', icon: 'lock_clock', iconCls: 'text-status-paused', title: 'text-[#92400E]', body: 'text-[#92400E]', btn: 'border-[#FDE68A] text-[#92400E]' },
  error: { box: 'bg-error-container/40 border-error/20', icon: 'gpp_bad', iconCls: 'text-error', title: 'text-on-error-container', body: 'text-on-error-container', btn: 'border-error/20 text-error' },
} as const;

/** "Granted Permissions & OAuth Scopes" card with the token-health footer. */
export function ScopesCard({ telemetry, catalog, handle }: { telemetry: AccountTelemetry; catalog: ScopeDefinition[]; handle: string }) {
  const toast = useToast();
  const tone = footerTone[telemetry.tokenFooter.tone];
  const describe = (scope: string) => catalog.find((c) => c.scope === scope)?.detailDescription ?? '';

  return (
    <section className="bg-surface-card border border-border-strong rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]" aria-labelledby="scopes-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 id="scopes-title" className="font-headline-sm text-headline-sm text-text-primary font-bold">
            Granted Permissions &amp; OAuth Scopes
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Sample authorizations as they would be granted via Meta Business Login for Graph API v19.0.</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-ai-subtle border border-ai-border text-ai-accent font-label-sm text-label-sm font-semibold self-start sm:self-auto">
          <Icon name="security" className="text-[14px]" />
          OAuth 2.0 PKCE (planned)
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {telemetry.scopes.map((g) => {
          const m = grantMeta[g.status];
          return (
            <div key={g.scope} className="p-3.5 rounded-lg border border-border-strong bg-surface-canvas flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-label-code text-label-code font-mono text-text-primary font-bold break-all">{g.scope}</span>
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', m.cls)}>
                  <Icon name={m.icon} className="text-[12px]" /> {m.label}
                </span>
              </div>
              <p className="text-[12px] text-text-secondary">{describe(g.scope)}</p>
            </div>
          );
        })}
      </div>
      <div className={cn('mt-4 p-3.5 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3', tone.box)}>
        <div className="flex items-center gap-3">
          <Icon name={tone.icon} className={cn('text-[22px]', tone.iconCls)} />
          <div>
            <p className={cn('font-label-md text-label-md font-semibold', tone.title)}>{telemetry.tokenFooter.title}</p>
            <p className={cn('text-[12px]', tone.body)}>{telemetry.tokenFooter.body}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            toast({
              tone: 'demo',
              title: 'Token health check unavailable',
              description: `No token exists for @${handle} in this prototype. Status shown: ${telemetry.token.label.toLowerCase()} (sample).`,
            })
          }
          className={cn('px-3 py-1.5 bg-white border font-label-sm text-label-sm font-semibold rounded hover:bg-surface-canvas transition-colors whitespace-nowrap shadow-xs', tone.btn)}
        >
          Verify Token Health
        </button>
      </div>
    </section>
  );
}
