import { commentSummary, comments, sentimentTrend } from '@/data/comments';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { CommentListResult, CommentStatus, InstagramComment } from '@/types/comments';

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
