import { leadPipelineSummary, leads, octoberLeadChannels, octoberLeadFunnel } from '@/data/leads';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { Lead, LeadStatus } from '@/types/domain';

const store: Lead[] = structuredClone(leads);

export const leadService = {
  list: () => fromSource(() => store, '/leads'),

  listByCampaign: (campaignId: string) =>
    fromSource(() => store.filter((l) => l.campaignId === campaignId), `/campaigns/${campaignId}/leads`),

  summary: () => fromSource(() => leadPipelineSummary, '/leads/summary'),

  campaignFunnel: (campaignId: string) =>
    fromSource(
      () => (campaignId === 'sbi-csp-october' ? { funnel: octoberLeadFunnel, channels: octoberLeadChannels } : null),
      `/campaigns/${campaignId}/leads/funnel`,
    ),

  updateStatus: (id: string, status: LeadStatus) =>
    mutateSource(
      () => {
        const found = store.find((l) => l.id === id);
        if (!found) throw new NotFoundError('Lead', id);
        found.status = status;
        found.lastContact = 'Just now';
        return found;
      },
      { method: 'patch', path: `/leads/${id}`, body: { status } },
    ),

  /** Creates a lead locally from a comment (Comments Intelligence → "Convert to lead"). */
  createFromComment: (input: Omit<Lead, 'id' | 'status' | 'lastContact'>) =>
    mutateSource(
      () => {
        const existing = store.find((l) => l.handle === input.handle);
        if (existing) return existing;
        const lead: Lead = { ...input, id: `lead-local-${Date.now().toString(36)}`, status: 'new', lastContact: 'Just now' };
        store.unshift(lead);
        return lead;
      },
      { method: 'post', path: '/leads', body: input },
    ),
};
