import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/app/AuthContext';
import { sessionUser } from '@/services/workspace';
import type { SettingsSession } from '@/types/settings';
import { ApiSecurityTab } from './ApiSecurityTab';
import { ConfirmModal } from './settingsUi';

export function SecurityTab(props: { session?: SettingsSession; retentionDays: number }) {
  const { status } = useAuth();
  // api mode: real password change + server sessions. demo mode: the honest prototype stubs below.
  return status === 'demo' ? <DemoSecurityTab {...props} /> : <ApiSecurityTab retentionDays={props.retentionDays} />;
}

function DemoSecurityTab({ session, retentionDays }: { session?: SettingsSession; retentionDays: number }) {
  const toast = useToast();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface-card border border-border-strong rounded-lg p-5">
        <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold pb-1">Current Active Session &amp; Identity</h2>
        <p className="font-body-sm text-body-sm text-text-secondary mb-4">In production, enterprise authentication would be brokered via Eko Corporate SSO.</p>

        <div className="p-4 rounded-lg bg-surface-canvas border border-border-strong mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-surface-card border border-border-strong text-text-primary">
              <Icon name="laptop_mac" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-md text-label-md font-bold text-text-primary">{session?.device ?? 'This browser'}</span>
                <span className="font-label-code text-label-code bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">THIS DEVICE</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Avatar name={sessionUser.name} src={sessionUser.avatarUrl} size="xs" />
                <span className="text-xs text-text-primary font-medium">
                  {sessionUser.name} · {sessionUser.role}
                </span>
                <span className="text-xs text-text-tertiary">({sessionUser.access})</span>
              </div>
              <div className="text-xs text-text-secondary mt-1">{session?.authMethod}</div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                Session initiated: {session?.startedAt ?? '—'} (demo timeline) · {session?.origin}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="h-8 px-3 rounded bg-surface-card border border-border-strong text-text-secondary font-label-sm text-label-sm hover:text-text-primary shrink-0"
            onClick={() => toast({ tone: 'demo', title: 'Sign-out not available', description: 'The prototype runs with a fixed demo identity (Priya Sharma), so there is no session to end.' })}
          >
            Sign Out Current Session
          </button>
        </div>

        <div className="mb-6">
          <span className="font-label-sm text-label-sm font-bold text-text-primary block mb-2">Data Protection &amp; Privacy Safeguards</span>
          <div className="space-y-2 text-xs text-text-secondary">
            {[
              'Meta Graph API telemetry would be retained strictly according to Eko Financial Services enterprise data protection policies.',
              'Instagram direct messages (DMs) and private user passwords are excluded by design and never requested.',
              `Planned audit log retention: ${retentionDays} rolling calendar days. This prototype keeps sample entries in browser memory only.`,
            ].map((t) => (
              <div key={t} className="flex items-start gap-2">
                <Icon name="verified" className="text-[16px] text-emerald-600" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border-strong flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-label-sm font-bold text-error block">Revoke All Concurrent Operator Sessions</span>
            <span className="text-xs text-text-secondary">Forces re-authentication across all mobile devices and external workstations.</span>
          </div>
          <button
            type="button"
            className="h-8 px-3.5 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold hover:bg-red-200 transition-colors shrink-0"
            onClick={() => setConfirmRevoke(true)}
          >
            Revoke All Other Sessions
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={() => {
          setConfirmRevoke(false);
          toast({ tone: 'demo', title: 'No sessions were revoked', description: 'The prototype has no authentication backend, so there are no other operator sessions to end.' });
        }}
        title="Revoke all other sessions?"
        confirmLabel="Revoke sessions"
        icon="logout"
      >
        <p>Every other signed-in device for this workspace would be signed out and need to re-authenticate via SSO.</p>
        <p className="text-text-tertiary">Prototype: no authentication backend exists, so confirming changes nothing.</p>
      </ConfirmModal>
    </section>
  );
}
