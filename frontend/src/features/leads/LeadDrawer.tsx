import { modeText } from '@/lib/config';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AiBadge, LeadStatusBadge, leadStatusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Notice } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { cn } from '@/lib/format';
import { leadService } from '@/services/leads';
import type { LeadStatus } from '@/types/domain';
import { leadSourceLabel, leadStatuses, suggestedReply, type LeadRow } from './leadUtils';

/** Outreach notes typed in the drawer. Kept in memory for this browser session only (no notes API yet). */
const sessionNotes = new Map<string, string>();

const quickStatuses: Array<{ status: LeadStatus; className: string }> = [
  { status: 'contacted', className: 'bg-surface-canvas hover:bg-slate-200 border-border-strong font-semibold' },
  { status: 'qualified', className: 'bg-surface-canvas hover:bg-slate-200 border-border-strong font-semibold text-status-active' },
  { status: 'converted', className: 'bg-amber-50 hover:bg-amber-100 border-amber-200 font-bold text-on-primary-container' },
];

/** Lead Detail drawer (leadDrawer in the export). */
export function LeadDrawer({ open, leadId, lead, loading, onClose }: { open: boolean; leadId: string | null; lead: LeadRow | undefined; loading: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="w-full sm:max-w-md"
      title={
        <span className="flex items-center gap-2">
          <Icon name="contact_page" className="text-primary-container" />
          Lead Detail
        </span>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-28" />
          <Skeleton className="h-24" />
        </div>
      ) : lead ? (
        <LeadDetail key={lead.id} lead={lead} onClose={onClose} />
      ) : (
        <EmptyState icon="person_search" title="Lead not found" description={`No lead with id "${leadId ?? ''}" exists in the demo dataset.`} />
      )}
    </Drawer>
  );
}

function LeadDetail({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  const toast = useToast();
  const notesId = useId();
  const savedNotes = sessionNotes.get(lead.id) ?? lead.notes ?? '';
  const [notes, setNotes] = useState(savedNotes);
  const [pending, setPending] = useState<LeadStatus | null>(null);
  const reply = suggestedReply(lead);

  const update = useMutation((status: LeadStatus) => leadService.updateStatus(lead.id, status), {
    invalidate: ['leads'],
    onSuccess: (l) => toast({ title: `Lead status updated to: ${leadStatusLabel(l.status)}`, description: modeText('Saved in the demo data store for this session.', 'Saved to the InstaBoard database.') }),
    onError: (e) => toast({ tone: 'error', title: 'Could not update status', description: e.message }),
  });

  const setStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;
    setPending(status);
    await update.mutate(status);
    setPending(null);
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      toast({ title: 'AI reply copied to clipboard', description: 'Paste it into Instagram to send — nothing is sent from InstaBoard.' });
    } catch {
      toast({ tone: 'error', title: 'Clipboard unavailable', description: 'Select the suggested reply text and copy it manually.' });
    }
  };

  const saveAndClose = () => {
    if (notes !== savedNotes) {
      sessionNotes.set(lead.id, notes);
      toast({ tone: 'demo', title: 'Notes saved for this session', description: 'Demo only — notes are kept in this browser tab and not synced to a CRM.' });
    }
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 text-xs min-h-full">
      <div className="flex items-center gap-3">
        <Avatar name={lead.name} size="lg" />
        <div className="min-w-0">
          <h3 className="font-bold text-text-primary text-base">{lead.name}</h3>
          <span className="text-text-secondary">
            @{lead.handle} • {lead.location}
          </span>
          {lead.phoneMasked && <span className="block text-text-tertiary tnum">{lead.phoneMasked}</span>}
        </div>
      </div>

      <dl className="p-3 rounded bg-surface-canvas border border-border-strong space-y-2">
        <Row label="Pipeline Status:">
          <LeadStatusBadge status={lead.status} />
        </Row>
        <Row label="Attributed Campaign:">
          <Link to={`/campaigns/${lead.campaignId}`} className="font-bold text-text-primary hover:underline text-right">
            {lead.campaignName}
          </Link>
        </Row>
        <Row label="Attributed Source:">
          {lead.contentId && lead.contentLabel ? (
            <Link to={`/content/${lead.contentId}`} className="font-medium text-text-primary hover:underline text-right">
              {lead.contentLabel}
            </Link>
          ) : (
            <span className="font-medium text-text-primary">—</span>
          )}
        </Row>
        <Row label="Captured Via:">
          <span className="font-medium text-text-primary">{leadSourceLabel(lead.source)}</span>
        </Row>
        <Row label="AI Lead Score:">
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-primary tnum">{lead.score}/100</span>
            <AiBadge />
          </span>
        </Row>
        <Row label="Last Contact:">
          <span className="font-medium text-text-primary">{lead.lastContact}</span>
        </Row>
      </dl>

      <div>
        <h4 className="font-bold text-text-primary mb-2">First Message</h4>
        <p className="p-3 rounded bg-surface-canvas border border-border-strong text-text-primary font-medium italic">“{lead.firstMessage}”</p>
      </div>

      <div className="p-3 rounded bg-ai-subtle border border-ai-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-ai-accent text-[11px] flex items-center gap-1">
            <Icon name="auto_awesome" className="text-[14px]" /> Suggested Quick Reply
          </span>
          <button type="button" className="text-xs text-ai-accent hover:underline font-bold" onClick={copyReply}>
            Copy
          </button>
        </div>
        <p className="text-text-primary text-xs bg-white p-2.5 rounded border border-indigo-100">{reply}</p>
      </div>

      <div>
        <label htmlFor={notesId} className="font-bold text-text-primary mb-2 block">
          Internal Outreach Notes
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-24 p-2.5 bg-surface-canvas border border-border-strong rounded text-xs text-text-primary focus:outline-none focus:border-border-focused"
          placeholder="Add agent notes (e.g. called via WhatsApp, document requirements shared)..."
        />
      </div>

      <div>
        <h4 className="font-bold text-text-primary mb-2">Update Pipeline Status</h4>
        <div className="grid grid-cols-3 gap-2">
          {quickStatuses.map((q) => {
            const current = lead.status === q.status;
            return (
              <button
                key={q.status}
                type="button"
                aria-pressed={current}
                disabled={update.isPending}
                onClick={() => setStatus(q.status)}
                className={cn('p-2 rounded border text-center disabled:opacity-60 flex items-center justify-center gap-1', q.className, current && 'ring-2 ring-primary-container')}
              >
                {pending === q.status && <Icon name="progress_activity" className="text-[14px] animate-spin" />}
                {current && pending !== q.status && <Icon name="check" className="text-[14px]" />}
                {leadStatusLabel(q.status)}
              </button>
            );
          })}
        </div>
        <label className="flex items-center justify-between gap-2 mt-2 text-text-secondary">
          <span>Or set any status:</span>
          <Select value={lead.status} disabled={update.isPending} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="h-8 text-xs">
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {leadStatusLabel(s)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Notice tone="demo" title="Prototype: no messages are sent">
        InstaBoard does not send Instagram DMs or WhatsApp messages. Copy the suggested reply and send it from the Instagram app yourself.
      </Notice>

      <div className="mt-auto pt-4 border-t border-border-strong">
        <Button variant="dark" size="md" className="w-full" onClick={saveAndClose}>
          Save & Close
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <dt className="text-text-secondary shrink-0">{label}</dt>
      <dd className="min-w-0 flex justify-end">{children}</dd>
    </div>
  );
}
