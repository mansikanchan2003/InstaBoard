import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { authService } from '@/services/auth';
import type { AuthSessionInfo } from '@/types/auth';
import { ConfirmModal, FieldError, inputCls, labelCls } from './settingsUi';

const MIN_LENGTH = 12;

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function device(s: AuthSessionInfo) {
  const ua = s.userAgent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return ua ? `${browser}${os ? ` on ${os}` : ''}` : 'Unknown device';
}

/** Security settings backed by the real auth API: identity, password change, sessions and revocation. */
export function ApiSecurityTab({ retentionDays }: { retentionDays: number }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const sessionsQ = useQuery('auth:sessions', authService.sessions);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [touched, setTouched] = useState(false);
  const pwError = !current
    ? 'Enter your current password.'
    : next.length < MIN_LENGTH
      ? `The new password needs at least ${MIN_LENGTH} characters.`
      : next !== repeat
        ? 'The new passwords do not match.'
        : undefined;

  const changePassword = useMutation((v: { current: string; next: string }) => authService.changePassword(v.current, v.next), {
    invalidate: ['auth:sessions'],
    onSuccess: (r) => {
      setCurrent('');
      setNext('');
      setRepeat('');
      setTouched(false);
      toast({ tone: 'success', title: 'Password changed', description: r.revokedSessions ? `${r.revokedSessions} other session(s) were signed out.` : 'This session stays signed in.' });
    },
    onError: (e) => {
      setCurrent('');
      toast({ tone: 'error', title: 'Password not changed', description: e.message });
    },
  });
  const revokeOne = useMutation(authService.revokeSession, {
    invalidate: ['auth:sessions'],
    onSuccess: () => toast({ tone: 'success', title: 'Session signed out', description: 'That device must sign in again.' }),
    onError: (e) => toast({ tone: 'error', title: 'Could not revoke session', description: e.message }),
  });
  const revokeOthers = useMutation(() => authService.revokeOtherSessions(), {
    invalidate: ['auth:sessions'],
    onSuccess: (r) => {
      setConfirmRevokeAll(false);
      toast({ tone: 'success', title: 'Other sessions revoked', description: `${r.revoked} session(s) were signed out.` });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not revoke sessions', description: e.message }),
  });

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (pwError || changePassword.isPending) return;
    changePassword.mutate({ current, next });
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const others = (sessionsQ.data ?? []).filter((s) => !s.current);

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface-card border border-border-strong rounded-lg p-5">
        <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold pb-1">Signed-in identity</h2>
        <p className="font-body-sm text-body-sm text-text-secondary mb-4">
          Email and password sign-in with a server-side session (HttpOnly cookie). Single sign-on is not configured.
        </p>
        <div className="p-4 rounded-lg bg-surface-canvas border border-border-strong flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={me?.user.name ?? ''} size="sm" />
            <div>
              <div className="font-label-md text-label-md font-bold text-text-primary">{me?.user.name}</div>
              <div className="text-xs text-text-secondary">
                {me?.user.email} · {me?.role} in {me?.workspace.name}
              </div>
              {me && <div className="text-[11px] text-text-tertiary mt-0.5">Session expires {when(me.session.absoluteExpiresAt)} at the latest (sooner after inactivity).</div>}
            </div>
          </div>
          <Button icon="logout" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="bg-surface-card border border-border-strong rounded-lg p-5">
        <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold pb-1">Change password</h2>
        <p className="font-body-sm text-body-sm text-text-secondary mb-4">Changing your password signs out every other session.</p>
        <form onSubmit={submitPassword} noValidate className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label htmlFor="pw-current" className={labelCls}>Current password</label>
            <input id="pw-current" type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw-new" className={labelCls}>New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw-repeat" className={labelCls}>Repeat new password</label>
            <input id="pw-repeat" type="password" autoComplete="new-password" className={inputCls} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </div>
          <div className="md:col-span-3 flex items-center justify-between gap-3 flex-wrap">
            <div>{touched ? <FieldError message={pwError} /> : <span className="text-[11px] text-text-tertiary">At least {MIN_LENGTH} characters; a passphrase works well.</span>}</div>
            <Button type="submit" variant="primary" loading={changePassword.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-surface-card border border-border-strong rounded-lg p-5">
        <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold pb-1">Active sessions</h2>
        <p className="font-body-sm text-body-sm text-text-secondary mb-4">Devices currently signed in to your account.</p>
        <QueryState query={sessionsQ} loading={<Skeleton className="h-16" />} empty={<p className="text-body-sm text-text-secondary">No active sessions.</p>}>
          {(sessions) => (
            <ul className="divide-y divide-border-subtle border border-border-strong rounded-lg">
              {sessions.map((s) => (
                <li key={s.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon name="devices" className="text-text-secondary mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-label-md text-label-md font-semibold text-text-primary">{device(s)}</span>
                        {s.current && <span className="font-label-code text-label-code bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">THIS DEVICE</span>}
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        Signed in {when(s.createdAt)} · last active {when(s.lastSeenAt)}
                        {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                      </div>
                    </div>
                  </div>
                  {!s.current && (
                    <Button size="xs" variant="ghost" disabled={revokeOne.isPending} onClick={() => revokeOne.mutate(s.id)}>
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryState>

        <div className="mt-4 text-xs text-text-secondary flex items-start gap-2">
          <Icon name="verified" className="text-[16px] text-emerald-600" />
          <span>Security events (sign-in, sign-out, password and membership changes) are recorded in the activity log, kept for {retentionDays} days per workspace settings.</span>
        </div>

        <div className="pt-4 mt-4 border-t border-border-strong flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="font-label-sm text-label-sm font-bold text-error block">Revoke all other sessions</span>
            <span className="text-xs text-text-secondary">Every other device is signed out immediately and must sign in again.</span>
          </div>
          <button
            type="button"
            disabled={others.length === 0}
            className="h-8 px-3.5 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold hover:bg-red-200 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setConfirmRevokeAll(true)}
          >
            Revoke All Other Sessions
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={() => void revokeOthers.mutate()}
        title="Revoke all other sessions?"
        confirmLabel="Revoke sessions"
        icon="logout"
      >
        <p>{others.length} other session(s) will be signed out. This device stays signed in.</p>
      </ConfirmModal>
    </section>
  );
}
