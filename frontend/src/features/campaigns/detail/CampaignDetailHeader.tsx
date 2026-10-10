import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { Campaign } from '@/types/domain';
import { campaignDurationLabel } from '../campaignUtils';

/** Breadcrumbs + title / status / objective / dates + page actions (export "Campaign Header Bar"). */
export function CampaignDetailHeader({
  campaign,
  onEdit,
  onToggleStatus,
  onSchedule,
  onExport,
  onNewContent,
  statusPending,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onToggleStatus: () => void;
  onSchedule: () => void;
  onExport: () => void;
  onNewContent: () => void;
  statusPending: boolean;
}) {
  const canToggle = campaign.status === 'active' || campaign.status === 'paused';
  return (
    <div className="pb-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-label-sm text-label-sm text-text-secondary mb-2">
        <Link className="hover:text-text-primary transition-colors" to="/campaigns">
          Campaigns
        </Link>
        <span aria-hidden>/</span>
        <span className="text-text-primary font-semibold truncate" aria-current="page">
          {campaign.name}
        </span>
      </nav>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
          <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary font-bold tracking-tight">{campaign.name}</h1>
          <CampaignStatusBadge status={campaign.status} />
          <span className="text-border-strong text-sm hidden sm:inline" aria-hidden>
            |
          </span>
          <span className="font-label-md text-label-md text-text-secondary">
            Objective: <strong className="text-text-primary font-semibold">{campaign.objective}</strong>
          </span>
          <span className="text-border-strong text-sm hidden sm:inline" aria-hidden>
            |
          </span>
          <span className="font-label-md text-label-md text-text-secondary">
            Dates: <strong className="text-text-primary font-semibold">{campaign.startDate || campaign.endDate ? campaignDurationLabel(campaign) : 'Not set'}</strong>
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <Button icon="edit" onClick={onEdit}>
            Edit Campaign
          </Button>
          {canToggle && (
            <Button icon={campaign.status === 'active' ? 'pause' : 'play_arrow'} onClick={onToggleStatus} loading={statusPending}>
              {campaign.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button icon="event" onClick={onSchedule} loading={statusPending}>
              Schedule Campaign
            </Button>
          )}
          <Button icon="ios_share" onClick={onExport}>
            Export Report
          </Button>
          <Button variant="primary" onClick={onNewContent}>
            <Icon name="add" className="text-[16px]" />
            New Ad / Content
          </Button>
        </div>
      </div>
    </div>
  );
}
