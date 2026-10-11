import { commentSummary, comments, sentimentTrend } from '@/data/comments';
import { fromSource, mutateSource, mutateSourceAsync, NotFoundError } from '@/lib/api/source';
import type { Lead } from '@/types/domain';
import { leadService } from './leads';
import type { CommentListResult, CommentStatus, InstagramComment } from '@/types/comments';

/** Result of converting a comment: `created` is false when it was already converted or the commenter was already a lead. */
export interface CommentConvertResult {
  lead: Lead;
  comment: InstagramComment;
  created: boolean;
}

/** In-memory store so triage actions (review, archive, flag, lead link) persist for the session. */
const store: InstagramComment[] = structuredClone(comments);

const initialAwaiting = comments.filter((c) => c.status === 'needs_response').length;

export type CommentPatch = Partial<Pick<InstagramComment, 'status' | 'flagged' | 'leadId'>>;

function apply(found: InstagramComment, patch: CommentPatch) {
  if (patch.status !== undefined) found.status = patch.status;
  if (patch.flagged !== undefined) found.flagged = patch.flagged;
  if (patch.leadId !== undefined) found.leadId = patch.leadId;
}

export const commentsService = {
  /**
   * Aggregate analytics for the reporting window. The "awaiting review" count starts at the
   * canonical 142 and goes down as sample comments are triaged locally.
   */
  summary: () =>
    fromSource(() => {
      const awaitingNow = store.filter((c) => c.status === 'needs_response').length;
      return { ...commentSummary, needsResponse: Math.max(0, commentSummary.needsResponse - (initialAwaiting - awaitingNow)) };
    }, '/comments/summary'),

  sentimentTrend: () => fromSource(() => sentimentTrend, '/comments/sentiment-trend'),

  /** Sample comments only — the full comment stream needs the backend. */
  list: () =>
    fromSource<CommentListResult>(() => ({ items: store, sampleSize: store.length, totalComments: commentSummary.totalComments }), '/comments'),

  get: (id: string) =>
    fromSource(() => {
      const found = store.find((c) => c.id === id);
      if (!found) throw new NotFoundError('Comment', id);
      return found;
    }, `/comments/${id}`),

  update: (id: string, patch: CommentPatch) =>
    mutateSource(
      () => {
        const found = store.find((c) => c.id === id);
        if (!found) throw new NotFoundError('Comment', id);
        apply(found, patch);
        return found;
      },
      { method: 'patch', path: `/comments/${id}`, body: patch },
    ),

  /**
   * Converts a comment into a lead. Idempotent: repeating it (or converting a commenter who is
   * already a lead) links the existing lead instead of creating a duplicate. In api mode the backend
   * creates the lead and updates the comment in one transaction. Nothing is posted to Instagram.
   */
  convertToLead: (id: string) =>
    mutateSourceAsync<CommentConvertResult>(
      async () => {
        const comment = store.find((c) => c.id === id);
        if (!comment) throw new NotFoundError('Comment', id);
        if (!comment.campaignId) throw new Error('This comment is not attributed to a campaign, so it cannot become a campaign lead.');
        const leads = await leadService.list();
        const linked = comment.leadId ? leads.find((l) => l.id === comment.leadId) : undefined;
        const { lead, created } = linked
          ? { lead: linked, created: false }
          : await leadService.createFromComment({
              name: comment.authorName,
              handle: comment.handle,
              location: comment.location ?? 'Unknown',
              campaignId: comment.campaignId,
              contentId: comment.contentId,
              score: comment.intentScore,
              source: 'comment',
              firstMessage: comment.text,
              notes: `Converted from Instagram comment ${comment.ref} in Comments Intelligence.`,
              sourceCommentId: comment.id,
            });
        apply(comment, { status: 'lead_created', leadId: lead.id });
        return { lead, comment, created };
      },
      { method: 'post', path: `/comments/${id}/convert-to-lead` },
    ),

  bulkSetStatus: (ids: string[], status: CommentStatus) =>
    mutateSource(
      () => {
        const updated = store.filter((c) => ids.includes(c.id));
        updated.forEach((c) => apply(c, { status }));
        return { updated: updated.length };
      },
      { method: 'post', path: '/comments/bulk', body: { ids, status } },
    ),
};
