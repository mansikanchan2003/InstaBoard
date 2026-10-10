import { contentItems } from '@/data/content';
import { fromSource, NotFoundError } from '@/lib/api/source';

export const contentService = {
  list: () => fromSource(() => contentItems, '/content'),

  listByCampaign: (campaignId: string) =>
    fromSource(() => contentItems.filter((c) => c.campaignId === campaignId), `/campaigns/${campaignId}/content`),

  get: (id: string) =>
    fromSource(() => {
      const found = contentItems.find((c) => c.id === id);
      if (!found) throw new NotFoundError('Content', id);
      return found;
    }, `/content/${id}`),
};
