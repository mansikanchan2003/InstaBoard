import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Misc';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api/client';
import { AuthLayout, safeNext } from '@/features/auth/AuthLayout';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const expired = params.get('reason') === 'expired';
  const expiredReason = (location.state as { expiredReason?: string } | null)?.expiredReason;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Demo mode has no accounts; an existing session goes straight back into the app.
  if (status === 'demo' || status === 'authenticated') return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      setPassword('');
      navigate(next, { replace: true });
    } catch (err) {
      setPassword('');
      if (err instanceof ApiError && err.status === 429) setError('Too many attempts. Please wait a few minutes and try again.');
      else setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to InstaBoard"
      subtitle="Use the email and password set up for your workspace."
      footer={<>No account? Ask your workspace owner or admin for an invitation link.</>}
    >
      {expired && (
        <Notice tone="warning" title="Your session ended" className="mb-4">
          {expiredReason || 'For your security you were signed out. Please sign in again.'}
        </Notice>
      )}
      {status === 'loading' ? (
        <p className="text-body-sm text-text-secondary" role="status">Checking your session…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Work email" htmlFor="login-email" required>
            <TextInput id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} autoFocus />
          </Field>
          <Field label="Password" htmlFor="login-password" required>
            <TextInput id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
          </Field>
          {error && (
            <p className="text-body-sm text-error font-medium" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full" loading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-[11px] text-text-tertiary">Forgot your password? Password reset by email is not available yet — ask a workspace admin.</p>
        </form>
      )}
    </AuthLayout>
  );
}
