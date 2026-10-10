import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { workspaceService } from '@/services/workspace';
import type { TeamMember } from '@/types/domain';
import { FieldError, inputCls, labelCls } from './settingsUi';

type AssignableAccess = Exclude<TeamMember['access'], 'Owner'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const roleOptions: Array<{ value: AssignableAccess; label: string }> = [
  { value: 'Editor', label: 'Editor (Metrics, Reports, AI Synthesis, Content)' },
  { value: 'Viewer', label: 'Viewer (Read-Only Executive Access)' },
  { value: 'Admin', label: 'Admin (Full Control & Integration Management)' },
];

export function InviteMemberModal({ open, onClose, existingEmails }: { open: boolean; onClose: () => void; existingEmails: string[] }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [access, setAccess] = useState<AssignableAccess>('Editor');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail('');
      setJobTitle('');
      setAccess('Editor');
      setTouched(false);
    }
  }, [open]);

  const trimmed = email.trim().toLowerCase();
  const error = !trimmed
    ? 'Enter a corporate email address.'
    : !EMAIL_RE.test(trimmed)
      ? 'Enter a valid email address, e.g. name@eko.co.in.'
      : existingEmails.includes(trimmed)
        ? 'This person is already a member or has a pending invite.'
        : undefined;

  const invite = useMutation(workspaceService.inviteMember, {
    invalidate: ['workspace', 'activity'],
    onSuccess: (m) => {
      toast({ tone: 'demo', title: `${m.email} added as pending`, description: 'Invitation recorded in the demo team list only — no email was sent.' });
      onClose();
    },
    onError: (e) => toast({ tone: 'error', title: 'Invite failed', description: e.message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    invite.mutate({ email: trimmed, access, role: jobTitle });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon="person_add"
      title="Invite Team Member"
      subtitle="Add an Eko operator or partner analyst to this workspace."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="invite-member-form" loading={invite.isPending}>
            Send Invitation
          </Button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="invite-email" className={labelCls}>
            Corporate Email Address <span className="text-error">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            data-autofocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && !!error}
            placeholder="name@eko.co.in or partner@agency.in"
            className={`${inputCls} font-normal ${touched && error ? 'border-error' : ''}`}
          />
          {touched && <FieldError message={error} />}
        </div>
        <div>
          <label htmlFor="invite-title" className={labelCls}>
            Job Title <span className="text-text-tertiary font-normal">(optional)</span>
          </label>
          <input id="invite-title" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Regional Campaign Analyst" className={`${inputCls} font-normal`} />
        </div>
        <div>
          <label htmlFor="invite-role" className={labelCls}>
            Select Access Role
          </label>
          <select id="invite-role" className={inputCls} value={access} onChange={(e) => setAccess(e.target.value as AssignableAccess)}>
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="p-3 bg-surface-canvas rounded border border-border-strong text-xs text-text-secondary">
          <div className="font-semibold text-text-primary mb-0.5">Permission Scope Summary:</div>
          <div>
            In production the recipient would receive a single-sign-on invitation expiring in 48 hours, scoped to <span className="font-mono text-text-primary">@ekoindia</span>. In
            this prototype the invite is only added to the demo team list.
          </div>
        </div>
      </form>
    </Modal>
  );
}
