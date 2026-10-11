import type { TeamMember, Workspace } from './domain';

/** Workspace permissions returned by the API (see backend app/services/permissions.py). */
export type Permission = 'read' | 'notifications:read_state' | 'write' | 'settings:manage' | 'team:manage' | 'accounts:manage' | 'admins:manage';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

export interface AuthSessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  current: boolean;
}

/** GET /auth/me and the login / accept-invitation responses. */
export interface AuthMe {
  user: AuthUser;
  member: TeamMember;
  workspace: Workspace;
  role: TeamMember['access'];
  permissions: Permission[];
  csrfToken: string;
  session: AuthSessionInfo;
}

export interface InvitationPreview {
  email: string;
  role: TeamMember['access'];
  workspaceName: string;
  expiresAt: string;
  accountExists: boolean;
}
