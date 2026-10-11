import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Icon } from '@/components/ui/Icon';

/**
 * Gate for every workspace screen. While the session is being verified nothing protected is mounted
 * (no data requests, no flash of private content); unauthenticated users are sent to /login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, expiredReason } = useAuth();
  const location = useLocation();

  if (status === 'demo' || status === 'authenticated') return <>{children}</>;
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-surface-canvas" role="status" aria-label="Checking your session">
        <img src="/eko-logo.png" alt="Eko" className="h-8" />
        <span className="flex items-center gap-2 text-body-sm text-text-secondary">
          <Icon name="progress_activity" className="text-[18px] animate-spin" /> Checking your session…
        </span>
      </div>
    );
  }
  const next = `${location.pathname}${location.search}`;
  const params = new URLSearchParams({ next });
  if (status === 'expired') params.set('reason', 'expired');
  return <Navigate to={`/login?${params.toString()}`} replace state={{ expiredReason }} />;
}
