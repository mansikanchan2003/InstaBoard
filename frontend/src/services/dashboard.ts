import { executiveBrief } from '@/data/dashboard';
import { fromSource } from '@/lib/api/source';

/** Dashboard-specific data. KPIs, trends, campaigns, content and audience come from their shared services. */
export const dashboardService = {
  executiveBrief: () => fromSource(() => executiveBrief, '/dashboard/executive-brief'),
};
