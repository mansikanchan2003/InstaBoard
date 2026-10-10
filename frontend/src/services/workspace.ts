import { currentUserId, teamMembers, workspace } from '@/data/workspace';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import { recordActivity } from '@/services/activity';
import type { TeamMember } from '@/types/domain';

/** In-memory copy of the team so Settings → Workspace & Team can invite / edit / remove locally. */
const teamStore: TeamMember[] = structuredClone(teamMembers);

const nameFromEmail = (email: string) =>
  email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ') || email;

function findMember(id: string) {
  const found = teamStore.find((m) => m.id === id);
  if (!found) throw new NotFoundError('Team member', id);
  return found;
}

function logTeamEvent(title: string, summary: string, member: TeamMember, extra: Partial<Parameters<typeof recordActivity>[0]> = {}) {
  recordActivity({
    category: 'security',
    kind: 'Team Change',
    kindIcon: 'group',
    kindTone: 'neutral',
    kindIconClass: 'text-tertiary',
    title,
    summary,
    narrative: `${summary} Applied to this browser session's demo team list only — no invitation emails or access changes reach a real identity provider.`,
    target: { label: member.name, to: '/settings?tab=workspace', module: 'Workspace & Team' },
    actorId: currentUserId,
    outcome: 'success',
    payload: { type: 'TEAM_MEMBER_CHANGED', member_id: member.id, email: member.email, access: member.access },
    ...extra,
  });
}

export const workspaceService = {
  get: () => fromSource(() => workspace, '/workspace'),
  team: () => fromSource(() => teamStore, '/workspace/members'),
  currentUser: () => fromSource(() => teamMembers.find((m) => m.id === currentUserId)!, '/me'),

  /** Adds a pending member locally. No email is sent in the prototype. */
  inviteMember: (input: { email: string; access: Exclude<TeamMember['access'], 'Owner'>; role?: string }) =>
    mutateSource(
      () => {
        const email = input.email.trim().toLowerCase();
        if (teamStore.some((m) => m.email.toLowerCase() === email)) throw new Error(`${email} is already a member of this workspace.`);
        const member: TeamMember = {
          id: `usr-local-${email.replace(/[^a-z0-9]/g, '-')}`,
          name: nameFromEmail(email),
          email,
          role: input.role?.trim() || 'Invited collaborator',
          access: input.access,
          status: 'invited',
          lastActive: 'Invite pending',
        };
        teamStore.push(member);
        logTeamEvent('Workspace Invitation Created', `Invited ${member.email} with ${member.access} access.`, member);
        return member;
      },
      { method: 'post', path: '/workspace/members', body: input },
    ),

  updateMemberAccess: (id: string, access: Exclude<TeamMember['access'], 'Owner'>) =>
    mutateSource(
      () => {
        const member = findMember(id);
        if (member.access === 'Owner') throw new Error('The workspace owner role cannot be changed.');
        const before = member.access;
        member.access = access;
        logTeamEvent('Member Access Changed', `Changed ${member.name}'s access from ${before} to ${access}.`, member, {
          diff: [{ field: 'Workspace access', before, after: access }],
        });
        return member;
      },
      { method: 'patch', path: `/workspace/members/${id}`, body: { access } },
    ),

  removeMember: (id: string) =>
    mutateSource(
      () => {
        const member = findMember(id);
        if (member.access === 'Owner') throw new Error('The workspace owner cannot be removed.');
        teamStore.splice(teamStore.indexOf(member), 1);
        logTeamEvent(
          member.status === 'invited' ? 'Invitation Revoked' : 'Member Removed',
          member.status === 'invited' ? `Revoked the pending invitation for ${member.email}.` : `Removed ${member.name} from the workspace.`,
          member,
        );
        return { id };
      },
      { method: 'delete', path: `/workspace/members/${id}` },
    ),
};

/** Synchronous access for chrome (header/sidebar) that must render before any fetch. */
export const sessionUser = teamMembers.find((m) => m.id === currentUserId)!;
export const sessionWorkspace = workspace;
