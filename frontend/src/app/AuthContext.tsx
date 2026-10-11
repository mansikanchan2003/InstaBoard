import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, setCsrfToken, UNAUTHORIZED_EVENT } from '@/lib/api/client';
import { config } from '@/lib/config';
import { clearQueryCache } from '@/hooks/useQuery';
import { authService } from '@/services/auth';
import { sessionUser, sessionWorkspace } from '@/services/workspace';
import type { AuthMe, Permission } from '@/types/auth';

/**
 * Session state for the app.
 *
 * - demo mode: no accounts — a fixed demo identity with every permission (`status: 'demo'`).
 * - api mode: the HttpOnly session cookie is verified with GET /auth/me before any protected screen
 *   renders (`loading` → `authenticated` | `anonymous`). A 401 later in the session switches to
 *   `expired`; the app never falls back to demo data.
 */
export type AuthStatus = 'demo' | 'loading' | 'authenticated' | 'anonymous' | 'expired';

interface AuthValue {
  status: AuthStatus;
  me: AuthMe | null;
  /** Display identity for the header (demo identity in demo mode). */
  displayName: string;
  displayRole: string;
  workspaceName: string;
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<AuthMe>;
  acceptInvitation: (token: string, password: string, name?: string) => Promise<AuthMe>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  expiredReason: string | null;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isApi = config.dataSource === 'api';
  const [status, setStatus] = useState<AuthStatus>(isApi ? 'loading' : 'demo');
  const [me, setMe] = useState<AuthMe | null>(null);
  const [expiredReason, setExpiredReason] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const adopt = useCallback((next: AuthMe) => {
    setCsrfToken(next.csrfToken);
    clearQueryCache(); // never show cached data from a previous identity
    setMe(next);
    setExpiredReason(null);
    setStatus('authenticated');
  }, []);

  const signOutLocally = useCallback((nextStatus: AuthStatus, reason: string | null = null) => {
    setCsrfToken(null);
    clearQueryCache();
    setMe(null);
    setExpiredReason(reason);
    setStatus(nextStatus);
  }, []);

  const refresh = useCallback(async () => {
    if (!isApi) return;
    try {
      adopt(await authService.me());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOutLocally('anonymous');
      else signOutLocally('anonymous', err instanceof Error ? err.message : 'Could not verify your session.');
    }
  }, [adopt, isApi, signOutLocally]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A 401 from any API call means the session ended (expired, revoked, signed out elsewhere).
  useEffect(() => {
    if (!isApi) return;
    const onUnauthorized = (event: Event) => {
      if (statusRef.current !== 'authenticated') return;
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      statusRef.current = 'expired';
      signOutLocally('expired', detail?.message ?? 'Your session ended. Please sign in again.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [isApi, signOutLocally]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await authService.login(email, password);
    adopt(next);
    return next;
  }, [adopt]);

  const acceptInvitation = useCallback(async (token: string, password: string, name?: string) => {
    const next = await authService.acceptInvitation(token, password, name);
    adopt(next);
    return next;
  }, [adopt]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      signOutLocally('anonymous');
    }
  }, [signOutLocally]);

  const value = useMemo<AuthValue>(() => ({
    status,
    me,
    displayName: me?.user.name ?? sessionUser.name,
    displayRole: me ? `${me.member.role} · ${me.role}` : sessionUser.role,
    workspaceName: me?.workspace.name ?? sessionWorkspace.name,
    can: (permission) => status === 'demo' || !!me?.permissions.includes(permission),
    login,
    acceptInvitation,
    logout,
    refresh,
    expiredReason,
  }), [status, me, login, acceptInvitation, logout, refresh, expiredReason]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
