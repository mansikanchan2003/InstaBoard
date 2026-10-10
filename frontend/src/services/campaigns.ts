import { campaignDetailExtras } from '@/data/campaignDetail';
import { campaigns } from '@/data/campaigns';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { Campaign, CampaignObjective, CampaignStatus } from '@/types/domain';

export interface NewCampaignInput {
  name: string;
  objective: CampaignObjective;
  startDate: string;
  endDate: string;
  accountId: string;
  targetRegions: string[];
  hashtags: string[];
  budgetInr?: number;
  leadGoal?: number;
  primaryAgeGroup?: string;
  /** Prototype only ever saves drafts or schedules locally — nothing is published to Instagram. */
  status: Extract<CampaignStatus, 'draft' | 'scheduled'>;
}

/** Editable campaign fields (Edit Campaign modal). Status changes go through `setStatus`. */
export type CampaignUpdateInput = Partial<
  Pick<Campaign, 'name' | 'objective' | 'startDate' | 'endDate' | 'accountId' | 'targetRegions' | 'hashtags' | 'budgetInr' | 'leadGoal' | 'primaryAgeGroup'>
>;

/** In-memory store so prototype edits (create, pause, resume) persist for the session. */
const store: Campaign[] = structuredClone(campaigns);

export const campaignService = {
  list: () => fromSource(() => store, '/campaigns'),

  get: (id: string) =>
    fromSource(() => {
      const found = store.find((c) => c.id === id);
      if (!found) throw new NotFoundError('Campaign', id);
      return found;
    }, `/campaigns/${id}`),

  create: (input: NewCampaignInput) =>
    mutateSource(
      () => {
        const nextCode = 8856 + store.filter((c) => c.id.startsWith('local-')).length;
        const campaign: Campaign = {
          id: `local-${Date.now().toString(36)}`,
          code: `#CAM-${nextCode}`,
          name: input.name,
          objective: input.objective,
          focus: input.objective,
          status: input.status,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          accountId: input.accountId,
          creativesCount: 0,
          creativesNote: input.status === 'draft' ? 'Draft — no creatives yet' : 'Awaiting creatives',
          owner: 'Priya Sharma',
          budgetInr: input.budgetInr,
          leadGoal: input.leadGoal,
          primaryAgeGroup: input.primaryAgeGroup,
          targetRegions: input.targetRegions,
          hashtags: input.hashtags,
          metrics: null,
          health: null,
        };
        store.unshift(campaign);
        return campaign;
      },
      { method: 'post', path: '/campaigns', body: input },
    ),

  /** Updates editable fields in the local store only (nothing is changed on Instagram). */
  update: (id: string, patch: CampaignUpdateInput) =>
    mutateSource(
      () => {
        const found = store.find((c) => c.id === id);
        if (!found) throw new NotFoundError('Campaign', id);
        Object.assign(found, patch);
        return found;
      },
      { method: 'patch', path: `/campaigns/${id}`, body: patch },
    ),

  /** Campaign-specific detail extras (progression series, AI analysis, comments snapshot); null when not in the dataset. */
  detail: (id: string) => fromSource(() => campaignDetailExtras.find((d) => d.campaignId === id) ?? null, `/campaigns/${id}/detail`),

  setStatus: (id: string, status: CampaignStatus) =>
    mutateSource(
      () => {
        const found = store.find((c) => c.id === id);
        if (!found) throw new NotFoundError('Campaign', id);
        found.status = status;
        return found;
      },
      { method: 'patch', path: `/campaigns/${id}`, body: { status } },
    ),
};
