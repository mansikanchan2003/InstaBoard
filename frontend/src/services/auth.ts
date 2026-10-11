import { apiClient } from '@/lib/api/client';
import type { AuthMe, AuthSessionInfo, InvitationPreview } from '@/types/auth';

/**
 * Authentication calls (api mode only — demo mode has no accounts). The session is an HttpOnly cookie
 * set by the server; nothing here stores credentials in the browser.
 */
export const authService = {
  me: () => apiClient.get<AuthMe>('/auth/me'),
  login: (email: string, password: string) => apiClient.post<AuthMe>('/auth/login', { email, password }),
  logout: () => apiClient.post<void>('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<{ revokedSessions: number }>('/auth/password', { currentPassword, newPassword }),
  sessions: () => apiClient.get<AuthSessionInfo[]>('/auth/sessions'),
  revokeSession: (id: string) => apiClient.delete<void>(`/auth/sessions/${encodeURIComponent(id)}`),
  revokeOtherSessions: () => apiClient.post<{ revoked: number }>('/auth/sessions/revoke-others'),
  previewInvitation: (token: string) => apiClient.post<InvitationPreview>('/auth/invitations/preview', { token }),
  acceptInvitation: (token: string, password: string, name?: string) =>
    apiClient.post<AuthMe>('/auth/invitations/accept', { token, password, ...(name ? { name } : {}) }),
};
