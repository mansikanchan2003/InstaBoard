import { modeText } from '@/lib/config';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { sessionUser, workspaceService } from '@/services/workspace';
import type { TeamMember } from '@/types/domain';
import { InviteMemberModal } from './InviteMemberModal';
import { ConfirmModal } from './settingsUi';

type Access = TeamMember['access'];
export type AssignableAccess = Exclude<Access, 'Owner'>;

export const accessStyles: Record<Access, string> = {
  Owner: 'bg-amber-50 text-amber-900 border-amber-200',
  Admin: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  Editor: 'bg-sky-50 text-sky-800 border-sky-200',
  Viewer: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const accessDescriptions: Record<Access, { border: string; text: string }> = {
  Owner: { border: 'border-primary-container', text: 'Full control: workspace parameters, integrations, billing and role assignment.' },
  Admin: { border: 'border-indigo-500', text: 'Manage campaigns, Instagram integrations, team access and workspace settings.' },
  Editor: { border: 'border-sky-500', text: 'Full access to dashboards, reports, AI insights, content tagging and comment triage.' },
  Viewer: { border: 'border-slate-400', text: 'Read-only visibility for executive stakeholders and audit compliance reviewers.' },
};

const SEAT_LIMIT = 10;

export function TeamTab() {
  const toast = useToast();
  const teamQ = useQuery('workspace:team', workspaceService.team);
  const [filter, setFilter] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editAccess, setEditAccess] = useState<AssignableAccess>('Editor');
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const updateAccess = useMutation(workspaceService.updateMemberAccess, {
    invalidate: ['workspace', 'activity'],
    onSuccess: (m) => {
      toast({ title: 'Access updated', description: `${m.name} is now ${m.access}. ${modeText("Changed in this session's demo team list only.", 'Saved to the InstaBoard database. No email or identity provider is involved.')}` });
      setEditing(null);
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not change access', description: e.message }),
  });
  const remove = useMutation(workspaceService.removeMember, {
    invalidate: ['workspace', 'activity'],
    onSuccess: () => {
      toast({
        tone: 'demo',
        title: removing?.status === 'invited' ? 'Invitation revoked (demo)' : 'Member removed (demo)',
        description: modeText('Removed from this session’s demo team list only — refreshing the page restores the sample team.', 'Removed from the workspace in the InstaBoard database. No external account is deleted.'),
      });
      setRemoving(null);
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not remove member', description: e.message }),
  });

  const team = useMemo(() => teamQ.data ?? [], [teamQ.data]);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? team.filter((m) => [m.name, m.email, m.role, m.access].join(' ').toLowerCase().includes(q)) : team;
  }, [team, filter]);
  const active = team.filter((m) => m.status === 'active').length;
  const pending = team.filter((m) => m.status === 'invited').length;

  return (
    <section className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-border-strong rounded-lg p-4">
          <span className="font-label-sm text-label-sm text-text-secondary block mb-1">Total Team Seats</span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-metric-stat-lg text-metric-stat-lg text-text-primary font-bold tnum">
              {team.length} / {SEAT_LIMIT}
            </span>
            <span className="font-label-code text-label-code text-text-tertiary">SEATS ALLOCATED</span>
          </div>
        </div>
        <div className="bg-surface-card border border-border-strong rounded-lg p-4">
          <span className="font-label-sm text-label-sm text-text-secondary block mb-1">Active Members</span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-metric-stat-lg text-metric-stat-lg text-emerald-600 font-bold tnum">{active}</span>
            <span className="font-label-code text-label-code bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">ACTIVE</span>
          </div>
        </div>
        <div className="bg-surface-card border border-border-strong rounded-lg p-4">
          <span className="font-label-sm text-label-sm text-text-secondary block mb-1">Pending Invitations</span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-metric-stat-lg text-metric-stat-lg text-amber-600 font-bold tnum">{pending}</span>
            <span className="font-label-code text-label-code bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">AWAITING ACCEPTANCE</span>
          </div>
        </div>
        <div className="bg-surface-card border border-border-strong rounded-lg p-4 flex flex-col justify-center items-start">
          <button
            type="button"
            disabled={team.length >= SEAT_LIMIT}
            onClick={() => setInviteOpen(true)}
            className="w-full h-10 px-4 rounded bg-primary-container text-text-primary font-label-md text-label-md font-bold hover:bg-brand-primary-hover shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="person_add" className="text-[18px]" />
            <span>Invite Team Member</span>
          </button>
          {team.length >= SEAT_LIMIT && <span className="text-[11px] text-text-tertiary mt-1">All {SEAT_LIMIT} seats are allocated.</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-surface-canvas p-4 rounded-lg border border-border-strong font-body-sm text-body-sm">
        {(Object.keys(accessDescriptions) as Access[]).map((a) => (
          <div key={a} className={cn('p-2 border-l-2 bg-surface-card rounded-r', accessDescriptions[a].border)}>
            <span className="font-label-sm text-label-sm font-bold text-text-primary block">{a}</span>
            <span className="text-text-secondary text-xs">{accessDescriptions[a].text}</span>
          </div>
        ))}
      </div>

      <div className="bg-surface-card border border-border-strong rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-canvas">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-headline-sm text-text-primary font-bold">Workspace Members</span>
            <span className="font-label-code text-label-code bg-surface-card px-2 py-0.5 rounded border border-border-strong text-text-secondary">{team.length} TOTAL</span>
          </div>
          <input
            type="search"
            aria-label="Filter team members"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded bg-surface-card border border-border-strong text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focused w-full sm:w-52"
            placeholder="Filter team members..."
          />
        </div>
        <QueryState
          query={teamQ}
          loading={
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          }
          empty={<p className="p-6 text-center text-body-sm text-text-secondary">No team members yet. Invite your first collaborator.</p>}
        >
          {() => (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-surface-canvas border-b border-border-strong text-text-secondary font-label-code text-label-code uppercase tracking-wider">
                    <th className="py-3 px-5">Member Name &amp; Email</th>
                    <th className="py-3 px-5">Workspace Role</th>
                    <th className="py-3 px-5">Access Status</th>
                    <th className="py-3 px-5">Last Activity</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-body-md text-body-md">
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 px-5 text-center text-body-sm text-text-secondary">
                        No members match “{filter}”.
                      </td>
                    </tr>
                  )}
                  {visible.map((m) => {
                    const you = m.id === sessionUser.id;
                    const invited = m.status === 'invited';
                    return (
                      <tr key={m.id} className={cn('transition-colors', invited ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-surface-canvas')}>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.name} src={m.avatarUrl} className={invited ? 'border-dashed border-amber-400' : undefined} />
                            <div className="min-w-0">
                              <div className="font-semibold text-text-primary flex items-center gap-1.5">
                                <span>{m.name}</span>
                                {you && <span className="font-label-code text-label-code bg-amber-100 text-amber-800 px-1 rounded">YOU</span>}
                              </div>
                              <div className="text-xs text-text-tertiary">
                                {m.email} · {m.role}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={cn('font-label-sm text-label-sm font-semibold px-2 py-0.5 rounded-full border', accessStyles[m.access])}>{m.access}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full', invited ? 'bg-amber-500 animate-pulse' : m.status === 'active' ? 'bg-status-active' : 'bg-text-tertiary')} />
                            <span className={cn('font-label-sm text-label-sm', invited ? 'text-amber-800 font-medium' : 'text-text-primary')}>
                              {invited ? 'Pending invitation' : m.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-text-secondary">{you ? 'Active now (Current Session)' : m.lastActive}</td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          {m.access === 'Owner' ? (
                            <span className="font-label-sm text-label-sm text-text-tertiary italic">Account Owner</span>
                          ) : invited ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="font-label-sm text-label-sm text-primary font-medium hover:underline"
                                onClick={() => toast({ tone: 'demo', title: 'Invite not re-sent', description: `The prototype has no email service, so nothing was sent to ${m.email}.` })}
                              >
                                Resend Invite
                              </button>
                              <span className="text-text-tertiary">•</span>
                              <button type="button" className="font-label-sm text-label-sm text-error hover:underline" onClick={() => setRemoving(m)}>
                                Revoke
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="font-label-sm text-label-sm text-text-secondary hover:text-text-primary"
                                onClick={() => {
                                  setEditing(m);
                                  setEditAccess(m.access as AssignableAccess);
                                }}
                              >
                                Edit Role
                              </button>
                              <span className="text-text-tertiary">•</span>
                              <button type="button" className="font-label-sm text-label-sm text-error hover:underline" onClick={() => setRemoving(m)}>
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} existingEmails={team.map((m) => m.email.toLowerCase())} />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="sm"
        icon="manage_accounts"
        title="Edit workspace role"
        subtitle={editing ? `${editing.name} · ${editing.email}` : undefined}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={updateAccess.isPending}
              disabled={!editing || editing.access === editAccess}
              onClick={() => editing && updateAccess.mutate(editing.id, editAccess)}
            >
              Save role
            </Button>
          </>
        }
      >
        <label htmlFor="edit-access" className="block font-label-sm text-label-sm text-text-primary mb-1">
          Access level
        </label>
        <Select id="edit-access" className="w-full" value={editAccess} onChange={(e) => setEditAccess(e.target.value as AssignableAccess)}>
          {(['Admin', 'Editor', 'Viewer'] as AssignableAccess[]).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <p className="text-body-sm text-text-secondary mt-2">{accessDescriptions[editAccess].text}</p>
      </Modal>

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        loading={remove.isPending}
        title={removing?.status === 'invited' ? 'Revoke invitation?' : 'Remove team member?'}
        confirmLabel={removing?.status === 'invited' ? 'Revoke invitation' : 'Remove member'}
        icon="person_remove"
      >
        <p>
          {removing?.status === 'invited'
            ? `The pending invitation for ${removing?.email} will be withdrawn.`
            : `${removing?.name} will lose access to the Eko India workspace.`}
        </p>
        <p className="text-text-tertiary">{modeText('Prototype: this only changes the in-memory demo team list for this session. No account is deleted.', 'This removes the member from the InstaBoard database only. No external account is deleted.')}</p>
      </ConfirmModal>
    </section>
  );
}
