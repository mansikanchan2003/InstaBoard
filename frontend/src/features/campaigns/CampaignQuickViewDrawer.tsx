import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback, Notice } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { cn, formatCompact, formatDate, formatDelta, formatNumber, formatPercent } from '@/lib/format';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import type { Campaign, CampaignStatus } from '@/types/domain';
import { campaignDurationLabel, pctDelta } from './campaignUtils';

const attribution: Record<CampaignStatus, { label: string; className: string; dot: string }> = {
  active: { label: 'Active & Converting', className: 'bg-status-active-subtle text-[#065F46] border-status-active/20', dot: 'bg-status-active' },
  paused: { label: 'Paused', className: 'bg-status-paused-subtle text-[#92400E] border-status-paused/30', dot: 'bg-status-paused' },
  completed: { label: 'Completed', className: 'bg-status-completed-subtle text-[#0369A1] border-status-completed/30', dot: 'bg-status-completed' },
  scheduled: { label: 'Scheduled — not started', className: 'bg-tertiary-fixed/30 text-tertiary border-tertiary/20', dot: 'bg-tertiary' },
  draft: { label: 'Draft — not tracking', className: 'bg-status-draft-subtle text-status-draft border-border-strong', dot: 'bg-status-draft' },
};

/** Export: "CAMPAIGN DETAIL SLIDE-OVER DRAWER" (openDrawer), made generic for any campaign. */
export function CampaignQuickViewDrawer({
  campaign,
  onClose,
  onEdit,
  onDuplicate,
  duplicatePending,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onEdit: (c: Campaign) => void;
  onDuplicate: (c: Campaign) => void;
  duplicatePending?: boolean;
}) {
  if (!campaign) return null;
  return (
    <Drawer
      open
      onClose={onClose}
      width="w-full sm:w-96"
      title={
        <>
          <span className="block font-label-code text-label-code text-primary uppercase">Campaign Details</span>
          {campaign.name}
        </>
      }
      subtitle={`${campaign.code} · ${campaign.objective} · ${campaignDurationLabel(campaign)}`}
      headerExtra={
        <Link to={`/campaigns/${campaign.id}`} className="mt-2 inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
          Open campaign <Icon name="arrow_forward" className="text-[14px]" />
        </Link>
      }
      footer={
        <div className="w-full flex items-center gap-2">
          <Button variant="primary" className="flex-1" onClick={() => onEdit(campaign)} icon="edit">
            Edit Campaign
          </Button>
          <Button onClick={() => onDuplicate(campaign)} loading={duplicatePending} icon="content_copy">
            Duplicate
          </Button>
        </div>
      }
    >
      <QuickViewBody campaign={campaign} />
    </Drawer>
  );
}

function QuickViewBody({ campaign }: { campaign: Campaign }) {
  const contentQ = useQuery(`content:campaign:${campaign.id}`, () => contentService.listByCampaign(campaign.id));
  const extrasQ = useQuery(`campaigns:extras:${campaign.id}`, () => campaignService.detail(campaign.id));
  const att = attribution[campaign.status];
  const m = campaign.metrics;
  const reachDelta = pctDelta(m?.reach, campaign.baseline?.reach);
  const top = [...(contentQ.data ?? [])].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 2);
  const recommendation = extrasQ.data?.quickViewRecommendation;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-surface-canvas border border-border-strong">
        <span className="font-label-md text-label-md text-text-secondary">Current Attribution</span>
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border', att.className)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', att.dot)} />
          <span>{att.label}</span>
        </span>
      </div>

      {m ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border-strong bg-surface-card">
            <span className="font-label-sm text-label-sm text-text-secondary">Total Reach</span>
            <div className="font-metric-stat-sm text-metric-stat-sm text-text-primary mt-1 tnum">{formatNumber(m.reach)}</div>
            <span className={cn('text-xs font-semibold', reachDelta === undefined ? 'text-text-secondary' : reachDelta >= 0 ? 'text-status-active' : 'text-error')}>
              {reachDelta === undefined ? `${formatCompact(m.views)} views` : `${formatDelta(reachDelta)} vs Sep`}
            </span>
          </div>
          <div className="p-3 rounded-lg border border-border-strong bg-surface-card">
            <span className="font-label-sm text-label-sm text-text-secondary">CSP Lead Signups</span>
            <div className="font-metric-stat-sm text-metric-stat-sm text-text-primary mt-1 tnum">{m.leads} Leads</div>
            <span className="text-xs text-primary font-semibold">{formatPercent(m.conversionRate, 1)} conversion</span>
          </div>
        </div>
      ) : (
        <Notice tone="info" icon="schedule" title="No metrics yet">
          Metrics will appear after the campaign starts{campaign.startDate ? ` on ${formatDate(campaign.startDate)}` : ''}.
        </Notice>
      )}

      {extrasQ.status === 'loading' ? (
        <Skeleton className="h-20" />
      ) : (
        recommendation && (
          <div className="p-3.5 rounded-lg bg-ai-subtle border border-ai-border space-y-1.5">
            <div className="flex items-center gap-1.5 text-ai-accent font-semibold text-xs">
              <Icon name="auto_awesome" className="text-[15px]" />
              <span>AI Attribution Recommendation</span>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary">{recommendation}</p>
          </div>
        )
      )}

      <div className="space-y-2">
        <span className="font-label-md text-label-md text-text-primary font-bold">Top Performing Creatives</span>
        {contentQ.status === 'loading' ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : top.length === 0 ? (
          <p className="text-body-sm text-text-secondary p-3 rounded-lg border border-dashed border-border-strong">No creatives are linked to this campaign yet.</p>
        ) : (
          <div className="space-y-2">
            {top.map((item) => (
              <Link key={item.id} to={`/content/${item.id}`} className="flex items-center gap-3 p-2 rounded-lg border border-border-strong hover:bg-surface-canvas transition-colors">
                <div className="h-10 w-10 rounded bg-slate-200 shrink-0 overflow-hidden">
                  <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="h-full w-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body-sm text-[12px] font-semibold text-text-primary truncate">
                    {item.type === 'reel' ? 'Reel' : item.type === 'carousel' ? 'Carousel' : item.type === 'story' ? 'Story' : 'Post'}: {item.title}
                  </div>
                  <div className="text-[11px] text-text-secondary tnum">
                    {formatCompact(item.metrics.views)} Views • {item.metrics.engagementRate}% Eng.
                  </div>
                </div>
                <Icon name="chevron_right" className="text-[16px] text-text-tertiary" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
