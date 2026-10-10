import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Notice } from '@/components/ui/Misc';
import { formatDate, formatNumber } from '@/lib/format';
import type { Campaign, InstagramAccount } from '@/types/domain';
import { campaignDurationLabel } from '../campaignUtils';
import { SectionCard } from './SectionCard';

/** Shown on campaigns that have not started (scheduled / draft): what was planned, plus the "no metrics yet" state. */
export function CampaignPlanCard({ campaign, account }: { campaign: Campaign; account: InstagramAccount | undefined }) {
  return (
    <SectionCard icon="assignment" title="Campaign Plan" titleSize="sm">
      <div className="mt-4 space-y-4">
        <Notice tone="info" icon="schedule" title="Metrics will appear after the campaign starts">
          {campaign.status === 'draft'
            ? 'This campaign is a draft. Add dates and schedule it to start tracking.'
            : `Tracking begins ${campaign.startDate ? `on ${formatDate(campaign.startDate)}` : 'once the campaign starts'}.`}
        </Notice>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
          <Row label="Dates">{campaignDurationLabel(campaign)}</Row>
          <Row label="Objective">{campaign.objective}</Row>
          <Row label="Instagram account">
            {account ? (
              <Link to={`/accounts/${account.id}`} className="text-primary font-semibold hover:underline">
                @{account.handle}
              </Link>
            ) : (
              '—'
            )}
          </Row>
          <Row label="Owner">{campaign.owner}</Row>
          <Row label="Target states">{campaign.targetRegions.length ? campaign.targetRegions.join(', ') : 'All regions'}</Row>
          <Row label="Age demographic">{campaign.primaryAgeGroup ?? 'Not specified'}</Row>
          <Row label="Hashtags">{campaign.hashtags.length ? campaign.hashtags.join(' ') : 'None'}</Row>
          <Row label="Creatives">{campaign.creativesNote ?? `${campaign.creativesCount} ready`}</Row>
          <Row label="Budget">{campaign.budgetInr !== undefined ? `₹${formatNumber(campaign.budgetInr)}` : 'Not set'}</Row>
          <Row label="Target lead goal">{campaign.leadGoal !== undefined ? `${formatNumber(campaign.leadGoal)} leads` : 'Not set'}</Row>
        </dl>
      </div>
    </SectionCard>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label-sm text-text-tertiary uppercase tracking-wider font-semibold">{label}</dt>
      <dd className="text-text-primary font-medium mt-0.5 break-words">{children}</dd>
    </div>
  );
}
