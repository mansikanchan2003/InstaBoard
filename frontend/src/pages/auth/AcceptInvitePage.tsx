import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Misc';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { authService } from '@/services/auth';
import type { InvitationPreview } from '@/types/auth';
import { AuthLayout } from '@/features/auth/AuthLayout';

const MIN_LENGTH = 12;

export default function AcceptInvitePage() {
  useDocumentTitle('Accept invitation');
  const { status, acceptInvitation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // The token is in the URL fragment (#token=…) so it never reaches server or proxy logs; ?token= is accepted too.
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('token') ?? new URLSearchParams(location.search).get('token') ?? '';
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'demo' || !token) return;
    authService.previewInvitation(token).then(setPreview, () => setLoadError('This invitation link is invalid, already used or expired. Ask for a new one.'));
  }, [status, token]);

  if (status === 'demo') return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !preview) return;
    if (!preview.accountExists) {
      if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
      if (password !== confirm) return setError('The passwords do not match.');
    }
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvitation(token, password, name.trim() || undefined);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
      setPassword('');
      setConfirm('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Join your InstaBoard workspace"
      subtitle={preview ? <>You were invited to <strong>{preview.workspaceName}</strong> as <strong>{preview.role}</strong>.</> : 'Set up your account to accept the invitation.'}
      footer={<Link to="/login" className="underline">Already set up? Sign in</Link>}
    >
      {!token || loadError ? (
        <Notice tone="warning" title="Invitation unavailable">{loadError ?? 'The invitation link is missing its token.'}</Notice>
      ) : !preview ? (
        <p className="text-body-sm text-text-secondary" role="status">Checking your invitation…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="invite-email">
            <TextInput id="invite-email" value={preview.email} readOnly disabled />
          </Field>
          {preview.accountExists ? (
            <Field label="Your existing InstaBoard password" htmlFor="invite-password" hint="You already have an account — confirm it to join this workspace.">
              <TextInput id="invite-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="Full name" htmlFor="invite-name">
                <TextInput id="invite-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
              </Field>
              <Field label="Create a password" htmlFor="invite-password" hint={`At least ${MIN_LENGTH} characters. A passphrase works well.`}>
                <TextInput id="invite-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Repeat password" htmlFor="invite-confirm">
                <TextInput id="invite-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
            </>
          )}
          {error && <p className="text-body-sm text-error font-medium" role="alert">{error}</p>}
          <Button type="submit" variant="primary" size="md" className="w-full" loading={submitting}>
            {submitting ? 'Joining…' : 'Accept invitation'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
