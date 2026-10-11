import { leadPipelineSummary, leads, octoberLeadChannels, octoberLeadFunnel } from '@/data/leads';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import type { Lead, LeadCreateResult, LeadDetailsPatch, LeadStatus } from '@/types/domain';

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

  /** Saves editable details (outreach notes, name, location, phone). */
  updateDetails: (id: string, patch: LeadDetailsPatch) =>
    mutateSource(
      () => {
        const found = store.find((l) => l.id === id);
        if (!found) throw new NotFoundError('Lead', id);
        const notes = patch.notes === undefined ? found.notes : patch.notes.trim() || undefined;
        Object.assign(found, patch, { notes });
        return found;
      },
      { method: 'patch', path: `/leads/${id}`, body: patch },
    ),

  /**
   * Creates a lead from a classified comment (Reel Analytics → "Assign to CRM"). Returns the existing
   * lead with `created: false` when the handle is already in the pipeline (case-insensitive).
   */
  createFromComment: (input: Omit<Lead, 'id' | 'status' | 'lastContact'>) =>
    mutateSource<LeadCreateResult>(
      () => {
        const existing = store.find((l) => l.handle.toLowerCase() === input.handle.toLowerCase());
        if (existing) return { lead: existing, created: false };
        const lead: Lead = { ...input, id: `lead-local-${Date.now().toString(36)}`, status: 'new', lastContact: 'Just now' };
        store.unshift(lead);
        return { lead, created: true };
      },
      { method: 'post', path: '/leads', body: input },
    ),
};
