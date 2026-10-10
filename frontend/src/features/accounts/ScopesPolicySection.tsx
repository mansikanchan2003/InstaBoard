import { Icon } from '@/components/ui/Icon';
import type { RetentionPolicyRow } from '@/types/accounts';

/** "Meta Graph API Telemetry Scopes & Retention Boundaries" — worded as planned behaviour, since no backend exists yet. */
export function ScopesPolicySection({ scopes, rateLimitNotes, retention }: { scopes: string[]; rateLimitNotes: string[]; retention: RetentionPolicyRow[] }) {
  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 sm:p-6 shadow-sm" aria-labelledby="scopes-policy-title">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="policy" className="text-primary text-[22px]" />
        <h2 id="scopes-policy-title" className="font-headline-sm text-headline-sm text-text-primary font-bold">
          Meta Graph API Telemetry Scopes &amp; Retention Boundaries
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-body-sm font-body-sm text-text-secondary">
        <div className="space-y-2">
          <h3 className="font-headline-sm text-[13px] font-bold text-text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-active" />
            Requested OAuth Scopes
          </h3>
          <p>Eko InstaBoard is designed around least-privilege, read-only authorization granted via Meta Business Login. Scopes held by the sample accounts:</p>
          <ul className="space-y-1 font-mono text-[11px] text-text-primary bg-surface-canvas p-2.5 rounded border border-border-subtle">
            {scopes.map((s) => (
              <li key={s} className="flex items-center gap-1">
                <span className="text-status-active">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="font-headline-sm text-[13px] font-bold text-text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            Rate Limits &amp; Constraints
          </h3>
          <p>Meta enforces a dynamic 200 calls/hour per business tier bucket. Planned background workers will distribute fetches:</p>
          <ul className="space-y-1 text-text-secondary list-disc list-inside">
            {rateLimitNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="font-headline-sm text-[13px] font-bold text-text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ai-accent" />
            Security &amp; Data Pipeline (planned)
          </h3>
          <p>Once the FastAPI backend is connected, tokens will be stored with envelope encryption and insights retained for longitudinal audit. Target policy:</p>
          <div className="bg-surface-canvas p-2.5 rounded border border-border-subtle text-[11px] space-y-1">
            {retention.map((r) => (
              <div key={r.label} className="flex justify-between gap-2">
                <span className="text-text-secondary">{r.label}</span>
                <span className="font-semibold text-text-primary text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
