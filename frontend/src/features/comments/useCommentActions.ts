import { modeText } from '@/lib/config';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@/hooks/useMutation';
import { useToast } from '@/components/ui/Toast';
import { commentsService, type CommentPatch } from '@/services/comments';
import type { CommentStatus, InstagramComment } from '@/types/comments';
import type { Lead } from '@/types/domain';

const statusToast: Partial<Record<CommentStatus, { title: string; description?: string }>> = {
  reviewed: { title: 'Marked as reviewed', description: modeText('Removed from the awaiting-review queue (local demo store).', 'Removed from the awaiting-review queue.') },
  responded: {
    title: 'Marked as responded',
    description: modeText('Status updated locally. The prototype does not post replies to Instagram — reply from the Instagram app.', 'Status saved in InstaBoard. Replies are not posted to Instagram — reply from the Instagram app.'),
  },
  archived: { title: 'Comment archived', description: 'Hidden from the open queue. Nothing was changed on Instagram.' },
  needs_response: { title: 'Moved back to the response queue' },
};

/** Triage mutations for Comments Intelligence (local in-memory store; nothing is sent to Instagram). */
export function useCommentActions() {
  const toast = useToast();
  const navigate = useNavigate();

  const update = useMutation((id: string, patch: CommentPatch) => commentsService.update(id, patch), { invalidate: ['comments'] });
  const bulk = useMutation((ids: string[], status: CommentStatus) => commentsService.bulkSetStatus(ids, status), { invalidate: ['comments'] });
  const convert = useMutation((id: string) => commentsService.convertToLead(id), {
    invalidate: ['leads', 'comments'],
    onError: (e) => toast({ tone: 'error', title: 'Lead could not be created', description: e.message }),
  });

  const setStatus = async (comment: InstagramComment, status: CommentStatus) => {
    const res = await update.mutate(comment.id, { status });
    const msg = statusToast[status];
    if (res && msg) toast({ tone: status === 'responded' ? 'demo' : 'success', ...msg });
  };

  const toggleFlag = async (comment: InstagramComment) => {
    const res = await update.mutate(comment.id, { flagged: !comment.flagged });
    if (res) toast({ tone: 'success', title: res.flagged ? 'Comment flagged for follow-up' : 'Flag removed' });
  };

  const bulkSetStatus = async (ids: string[], status: CommentStatus) => {
    const res = await bulk.mutate(ids, status);
    if (res) toast({ tone: 'success', title: `${res.updated} comment${res.updated === 1 ? '' : 's'} updated`, description: `Status set to ${status.replace('_', ' ')} ${modeText(' (local demo store)', '')}.` });
    return res;
  };

  const openLead = (leadId: string) => navigate(`/leads?lead=${encodeURIComponent(leadId)}`);

  /**
   * Converts a comment to a lead (one atomic, idempotent request in api mode). If the commenter is
   * already a lead, the comment is linked to that lead and it is opened — no duplicate is created.
   * Returns the newly created lead, or undefined when an existing lead was linked/opened.
   */
  const convertToLead = async (comment: InstagramComment, existing: Lead | undefined): Promise<Lead | undefined> => {
    if (!comment.campaignId && !existing) {
      toast({ tone: 'warning', title: 'Cannot convert', description: 'This comment is not attributed to a campaign.' });
      return undefined;
    }
    const result = await convert.mutate(comment.id);
    if (!result) return undefined;
    if (!result.created) {
      toast({ tone: 'info', title: `${result.lead.name} is already a lead`, description: 'Linked this comment to the existing lead instead of creating a duplicate.' });
      openLead(result.lead.id);
      return undefined;
    }
    toast({ tone: 'success', title: `Lead created: ${result.lead.name}`, description: modeText('Added to the Leads pipeline as "New" (local demo data). Use "Open lead" to view it.', 'Added to the Leads pipeline as "New". Use "Open lead" to view it.') });
    return result.lead;
  };

  return {
    setStatus,
    toggleFlag,
    bulkSetStatus,
    convertToLead,
    openLead,
    isPending: update.isPending || bulk.isPending || convert.isPending,
    isConverting: convert.isPending,
  };
}
