import { Link } from 'react-router-dom';
import { AiBadge, LeadStatusBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback, ProgressBar } from '@/components/ui/Misc';
import { Drawer } from '@/components/ui/Overlay';
import { useQuery } from '@/hooks/useQuery';
import { formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { campaignService } from '@/services/campaigns';
import { leadService } from '@/services/leads';
import type { ContentItem } from '@/types/domain';
import { contentMediaLabel, contentTypeIcon, contentTypeLabel } from './selectors';

/** Content quick-view ("Reel Intelligence" drawer in the export), opened from Top Performing Content. */
export function ContentQuickViewDrawer({ item, onClose }: { item: ContentItem | null; onClose: () => void }) {
  return (
    <Drawer
      open={item !== null}
      onClose={onClose}
      width="w-full sm:max-w-md"
      title={
        <span className="flex items-center gap-2">
          <Icon name={item ? contentTypeIcon(item.type) : 'movie'} className="text-primary-container" />
          {item?.type === 'reel' ? 'Reel Intelligence' : 'Content Quick View'}
        </span>
      }
      footer={
        item && (
          <>
            <LinkButton to={`/leads?content=${item.id}`} variant="secondary" size="sm" className="flex-1 sm:flex-none">
              View Attributed Leads
            </LinkButton>
            <LinkButton to={`/content/${item.id}`} variant="primary" size="sm" iconRight="arrow_forward" className="flex-1 sm:flex-none">
              Open full analytics
            </LinkButton>
          </>
        )
      }
    >
      {item && <QuickViewBody item={item} />}
    </Drawer>
  );
}

function QuickViewBody({ item }: { item: ContentItem }) {
  const campaigns = useQuery('campaigns:list', campaignService.list);
  const leads = useQuery('leads:list', leadService.list);
  const campaign = campaigns.data?.find((c) => c.id === item.campaignId);
  const attributed = (leads.data ?? []).filter((l) => l.contentId === item.id).sort((a, b) => b.score - a.score);
  const m = item.metrics;

  return (
    <div className="space-y-4">
      <div>
        <div className="h-44 rounded-lg bg-slate-100 overflow-hidden relative mb-3">
          <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
          <span className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            {item.durationSec ? `${contentMediaLabel(item)} duration` : contentMediaLabel(item)}
          </span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-text-primary">{item.title}</h3>
        <span className="text-xs text-text-tertiary">
          {contentTypeLabel(item.type)} • Posted {formatDate(item.publishedAt)}
          {campaign && (
            <>
              {' • '}
              <Link to={`/campaigns/${campaign.id}`} className="hover:text-text-primary hover:underline">
                {campaign.name}
              </Link>
            </>
          )}
          {!item.campaignId && ' • Organic (no campaign)'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2.5 rounded bg-surface-canvas border border-border-strong">
          <span className="text-text-tertiary text-[10px] block">Views</span>
          <span className="font-bold text-text-primary tnum">{formatNumber(m.views)}</span>
        </div>
        <div className="p-2.5 rounded bg-surface-canvas border border-border-strong">
          <span className="text-text-tertiary text-[10px] block">Engagement</span>
          <span className="font-bold text-status-active tnum">{formatPercent(m.engagementRate, 1)}</span>
        </div>
        <div className="p-2.5 rounded bg-amber-50 border border-amber-200">
          <span className="text-on-primary-container text-[10px] font-bold block">Leads</span>
          <span className="font-bold text-text-primary tnum">{formatNumber(m.leads)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center text-[11px]">
        {[
          { label: 'Reach', value: m.reach },
          { label: 'Likes', value: m.likes },
          { label: 'Comments', value: m.comments },
          { label: 'Shares', value: m.shares },
        ].map(({ label, value }) => (
          <div key={label} className="py-1.5 rounded border border-border-subtle">
            <dt className="text-text-tertiary text-[10px]">{label}</dt>
            <dd className="font-semibold text-text-primary tnum">{formatCompact(value)}</dd>
          </div>
        ))}
      </dl>

      {m.retention !== undefined && (
        <div className="p-3.5 rounded bg-surface-canvas border border-border-strong">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-bold text-text-primary">Average Viewer Retention{item.durationSec ? ` (0 - ${item.durationSec}s)` : ''}</span>
            <span className="text-status-active font-bold tnum">{formatPercent(m.retention, 1)}</span>
          </div>
          <ProgressBar value={m.retention} label="Average viewer retention" className="h-2" />
          <p className="text-[11px] text-text-secondary mt-2">Full retention curve and hook analysis are on the content analytics page.</p>
        </div>
      )}

      <div>
        <h4 className="font-bold text-xs text-text-primary mb-1.5">Caption</h4>
        <p className="text-xs text-text-secondary bg-surface-canvas border border-border-subtle rounded p-2.5 whitespace-pre-line">{item.caption}</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="font-bold text-xs text-text-primary">Attributed Leads (sample)</h4>
          <AiBadge label="AI-scored" />
        </div>
        {leads.status === 'loading' ? (
          <p className="text-xs text-text-tertiary">Loading leads…</p>
        ) : attributed.length === 0 ? (
          <p className="text-xs text-text-tertiary">No leads from this content in the recent-leads sample.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {attributed.slice(0, 3).map((l) => (
              <li key={l.id}>
                <Link
                  to={`/leads?lead=${l.id}`}
                  className="block p-2.5 rounded bg-surface-canvas border border-border-subtle hover:border-primary-container transition-colors"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-text-primary">@{l.handle}</span>
                    <LeadStatusBadge status={l.status} />
                  </span>
                  <span className="block text-text-secondary mt-0.5 line-clamp-2">“{l.firstMessage}”</span>
                  <span className="block mt-1 text-[10px] text-primary font-bold tnum">AI score {l.score}/100</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
