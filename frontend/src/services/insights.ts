import { insights, insightsOverview, recommendedActions } from '@/data/insights';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { ActionStatus, Insight, InsightStatus, RecommendedAction } from '@/types/insights';

/** In-memory stores so review / dismiss / step progress persists for the session (and is shared by overview + detail). */
const store: Insight[] = structuredClone(insights);
const actionStore: RecommendedAction[] = structuredClone(recommendedActions);

const findInsight = (id: string) => {
  const found = store.find((i) => i.id === id);
  if (!found) throw new NotFoundError('Insight', id);
  return found;
};

const findAction = (id: string) => {
  const found = actionStore.find((a) => a.id === id);
  if (!found) throw new NotFoundError('Recommended action', id);
  return found;
};

export const insightsService = {
  overview: () => fromSource(() => insightsOverview, '/insights/overview'),

  list: () => fromSource(() => store, '/insights'),

  get: (id: string) => fromSource(() => findInsight(id), `/insights/${id}`),

  setStatus: (id: string, status: InsightStatus) =>
    mutateSource(
      () => {
        const found = findInsight(id);
        found.status = status;
        return found;
      },
      { method: 'patch', path: `/insights/${id}`, body: { status } },
    ),

  toggleStep: (id: string, stepId: string) =>
    mutateSource(
      () => {
        const found = findInsight(id);
        found.completedStepIds = found.completedStepIds.includes(stepId) ? found.completedStepIds.filter((s) => s !== stepId) : [...found.completedStepIds, stepId];
        return found;
      },
      { method: 'post', path: `/insights/${id}/steps/${stepId}/toggle` },
    ),

  actions: () => fromSource(() => actionStore, '/insights/actions'),

  setActionStatus: (id: string, status: ActionStatus, feedback?: string) =>
    mutateSource(
      () => {
        const found = findAction(id);
        found.status = status;
        found.feedback = feedback;
        return found;
      },
      { method: 'patch', path: `/insights/actions/${id}`, body: { status, feedback } },
    ),

  markAllActionsReviewed: () =>
    mutateSource(
      () => {
        let updated = 0;
        actionStore.forEach((a) => {
          if (a.status === 'pending_review') {
            a.status = 'reviewed';
            updated += 1;
          }
        });
        return { updated };
      },
      { method: 'post', path: '/insights/actions/review-all' },
    ),

  /**
   * Prototype "regenerate": no model is called. Resolves after the simulated processing run so
   * the UI can return to the (unchanged) demo insights.
   */
  regenerate: () => mutateSource(() => ({ regeneratedAt: insightsOverview.generatedAt }), { method: 'post', path: '/insights/regenerate' }),
};
