import { useNavigate } from 'react-router-dom';
import { useMutation } from '@/hooks/useMutation';
import { useToast } from '@/components/ui/Toast';
import { campaignService } from '@/services/campaigns';
import type { Campaign, CampaignStatus } from '@/types/domain';

const HONEST_NOTE = 'Status changed in InstaBoard only; nothing is changed on Instagram.';

/** Pause / resume / duplicate actions shared by the campaigns table, quick-view drawer and detail page. */
export function useCampaignActions() {
  const toast = useToast();
  const navigate = useNavigate();

  const statusMutation = useMutation((ids: string[], status: CampaignStatus) => Promise.all(ids.map((id) => campaignService.setStatus(id, status))), {
    invalidate: ['campaigns'],
  });

  const duplicateMutation = useMutation(
    (c: Campaign) =>
      campaignService.create({
        name: `${c.name} (Copy)`,
        objective: c.objective,
        startDate: c.startDate ?? '',
        endDate: c.endDate ?? '',
        accountId: c.accountId,
        targetRegions: c.targetRegions,
        hashtags: c.hashtags,
        budgetInr: c.budgetInr,
        leadGoal: c.leadGoal,
        primaryAgeGroup: c.primaryAgeGroup,
        status: 'draft',
      }),
    { invalidate: ['campaigns'] },
  );

  /** Toggles active ⇄ paused for one or many campaigns; others are skipped. */
  const setStatus = async (targets: Campaign[], status: 'active' | 'paused') => {
    const from: CampaignStatus = status === 'paused' ? 'active' : 'paused';
    const eligible = targets.filter((c) => c.status === from);
    if (eligible.length === 0) {
      toast({
        tone: 'info',
        title: status === 'paused' ? 'Nothing to pause' : 'Nothing to resume',
        description: status === 'paused' ? 'Only active campaigns can be paused.' : 'Only paused campaigns can be resumed.',
      });
      return false;
    }
    const result = await statusMutation.mutate(
      eligible.map((c) => c.id),
      status,
    );
    if (!result) {
      toast({ tone: 'error', title: 'Could not update status', description: 'Please try again.' });
      return false;
    }
    const skipped = targets.length - eligible.length;
    toast({
      tone: 'demo',
      title: `${eligible.length === 1 ? `"${eligible[0].name}"` : `${eligible.length} campaigns`} ${status === 'paused' ? 'paused' : 'resumed'}`,
      description: `${HONEST_NOTE}${skipped > 0 ? ` ${skipped} selected campaign${skipped === 1 ? ' was' : 's were'} skipped (not ${from}).` : ''}`,
    });
    return true;
  };

  const duplicate = async (c: Campaign, opts: { open?: boolean } = {}) => {
    const created = await duplicateMutation.mutate(c);
    if (!created) {
      toast({ tone: 'error', title: 'Could not duplicate campaign' });
      return;
    }
    toast({ tone: 'demo', title: `Draft "${created.name}" created`, description: 'Saved in InstaBoard only — nothing was published to Instagram.' });
    if (opts.open) navigate(`/campaigns/${created.id}`);
    return created;
  };

  return { setStatus, duplicate, statusPending: statusMutation.isPending, duplicatePending: duplicateMutation.isPending };
}
