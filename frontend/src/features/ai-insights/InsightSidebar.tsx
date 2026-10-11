import { Link } from 'react-router-dom';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { cn, formatCompact } from '@/lib/format';
import type { InstagramComment } from '@/types/comments';
import type { Campaign, ContentItem } from '@/types/domain';
import type { Insight } from '@/types/insights';
import { intentMeta } from '@/features/comments/commentMeta';
import { insightStatusMeta } from './insightMeta';

type Funnel = { new: number; contacted: number; qualified: number; converted: number };

/** Column 3: associated artifacts (campaign, media, comparison asset, lead funnel). */
export function ArtifactsCard({
  insight,
  campaign,
  primary,
  comparison,
  funnel,
}: {
  insight: Insight;
  campaign: Campaign | undefined;
  primary: ContentItem | undefined;
  comparison: ContentItem | undefined;
  funnel: Funnel | null | undefined;
}) {
  const a = insight.detail?.artifacts;
  const linked = [campaign, primary, comparison, funnel].filter(Boolean).length;
  const funnelTotal = funnel ? funnel.new + funnel.contacted + funnel.qualified + funnel.converted : 0;
  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-4 md:p-5 space-y-4">
      <div className="border-b border-border-strong pb-3 flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-text-primary">Associated Artifacts</h3>
        <span className="font-label-sm text-label-sm text-text-tertiary">{linked} Linked Items</span>
      </div>
      {linked === 0 && (
        <p className="text-body-sm text-text-secondary flex items-start gap-2">
          <Icon name="science" className="text-[16px] text-text-tertiary" />
          Evidence not available in demo data — no campaign or content artifacts are linked to this insight.
        </p>
      )}
      {campaign && (
        <div className="space-y-1">
          <span className="font-label-sm text-label-sm text-text-secondary uppercase">Associated Campaign</span>
          <div className="p-2.5 rounded border border-border-strong bg-surface-canvas">
            <Link to={`/campaigns/${campaign.id}`} className="font-label-md text-label-md font-bold text-text-primary hover:underline flex items-center gap-1">
              {campaign.name}
              <Icon name="open_in_new" className="text-[14px]" />
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <CampaignStatusBadge status={campaign.status} />
              {campaign.metrics && <span className="text-xs text-text-tertiary tnum">• {formatCompact(campaign.metrics.views)} views total</span>}
            </div>
          </div>
        </div>
      )}
      {primary && (
        <div className="space-y-1">
          <span className="font-label-sm text-label-sm text-text-secondary uppercase">Primary {primary.type === 'reel' ? 'Reel' : 'Content'} Media</span>
          <div className="border border-border-strong rounded bg-surface-canvas overflow-hidden">
            <Link to={`/content/${primary.id}`} className="relative h-36 bg-slate-900 flex items-center justify-center group overflow-hidden" aria-label={`Open analytics for ${primary.title}`}>
              <ImageWithFallback
                src={a?.primaryMediaUrl ?? primary.thumbnailUrl}
                alt={a?.primaryMediaAlt ?? primary.thumbnailAlt}
                className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {primary.type === 'reel' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-text-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Icon name="play_arrow" filled className="text-[24px]" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs text-white">
                {primary.durationSec ? <span className="bg-black/60 px-1.5 py-0.5 rounded font-mono text-[11px]">0:{String(primary.durationSec).padStart(2, '0')}s</span> : <span />}
                <span className="bg-black/60 px-1.5 py-0.5 rounded text-[11px] capitalize">{primary.type === 'reel' ? '1080 × 1920 Reel' : primary.type}</span>
              </div>
            </Link>
            <div className="p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-label-md text-label-md font-semibold text-text-primary block truncate">{primary.title}</span>
                <span className="text-xs text-text-secondary">Asset ID: {primary.id}</span>
              </div>
              <Link to={`/content/${primary.id}`} className="text-xs text-primary font-bold hover:underline flex items-center shrink-0">
                Analytics <Icon name="chevron_right" className="text-[14px]" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {comparison && (
        <div className="space-y-1">
          <span className="font-label-sm text-label-sm text-text-secondary uppercase">Comparison Asset</span>
          <div className="p-2.5 rounded border border-border-strong bg-surface-canvas flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-label-md text-label-md font-semibold text-text-primary block truncate">{comparison.title}</span>
              <span className="text-xs text-text-secondary">
                {comparison.type === 'carousel' ? `Multi-slide carousel • ${comparison.slides} slides` : `${comparison.type[0].toUpperCase()}${comparison.type.slice(1)}`}
              </span>
            </div>
            <Link to={`/content/${comparison.id}`} className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-0.5 shrink-0">
              <span>View</span>
              <Icon name="open_in_new" className="text-[14px]" />
            </Link>
          </div>
        </div>
      )}
      {funnel && (
        <div className="space-y-2 pt-1 border-t border-border-strong">
          <div className="flex items-center justify-between pt-2">
            <span className="font-label-sm text-label-sm text-text-secondary uppercase">Campaign Attributed Leads ({funnelTotal} Total)</span>
            <Link to="/leads" className="font-label-sm text-label-sm text-primary font-bold hover:underline">
              Pipeline →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {(['new', 'contacted', 'qualified', 'converted'] as const).map((k) => (
              <div key={k} className={cn('p-1.5 rounded border', k === 'converted' ? 'bg-emerald-50 border-status-active' : 'bg-surface-canvas border-border-strong')}>
                <div className={cn('font-bold text-sm tnum', k === 'converted' ? 'text-status-active' : 'text-text-primary')}>{funnel[k]}</div>
                <div className={cn('text-[10px] uppercase', k === 'converted' ? 'text-status-active font-bold' : 'text-text-secondary font-semibold')}>{k}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const intentTagCls: Record<string, string> = {
  application: 'bg-status-active-subtle text-status-active border-emerald-200',
  eligibility: 'bg-blue-50 text-tertiary border-blue-200',
  product: 'bg-status-active-subtle text-status-active border-emerald-200',
  complaint: 'bg-red-50 text-error border-red-200',
};

/** Verbatim comments cited as evidence (read from the Comments Intelligence store). */
export function CommentEvidenceCard({ comments, contentTitle }: { comments: InstagramComment[]; contentTitle: (id: string) => string }) {
  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-4 md:p-5 space-y-3">
      <div className="border-b border-border-strong pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="chat" className="text-[18px] text-text-secondary" />
          <h3 className="font-headline-sm text-headline-sm text-text-primary">Comment Evidence Sample</h3>
        </div>
        <span className="font-label-sm text-label-sm text-text-tertiary">{comments.length} Cited Proofs</span>
      </div>
      {comments.length === 0 ? (
        <p className="text-body-sm text-text-secondary flex items-start gap-2">
          <Icon name="science" className="text-[16px] text-text-tertiary" />
          Evidence not available in demo data.
        </p>
      ) : (
        <>
          <p className="font-body-sm text-body-sm text-text-secondary">Verbatim user responses tagged with commercial intent classification by NLP parser:</p>
          <ul className="space-y-2.5">
            {comments.map((c) => (
              <li key={c.id} className="p-2.5 rounded bg-surface-canvas border border-border-strong space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-sm text-label-sm font-bold text-text-primary truncate">{c.authorName}</span>
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap', intentTagCls[c.intent] ?? 'bg-surface-card-subtle text-text-secondary border-border-strong')}>
                    {intentMeta[c.intent].label}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-text-primary italic">"{c.text}"</p>
                <div className="text-[11px] text-text-tertiary">
                  Commented on {contentTitle(c.contentId)} • {c.receivedLabel}
                </div>
              </li>
            ))}
          </ul>
          <Link to="/comments" className="text-label-sm font-label-sm text-primary font-bold hover:underline inline-flex items-center gap-1">
            Open in Comments Intelligence <Icon name="arrow_forward" className="text-[14px]" />
          </Link>
        </>
      )}
    </div>
  );
}

const lifecycle = {
  new: { label: 'Pending Team Action', cls: 'text-status-paused', dot: 'bg-status-paused' },
  reviewed: { label: 'Reviewed', cls: 'text-status-active', dot: 'bg-status-active' },
  saved: { label: 'Saved for later', cls: 'text-sky-800', dot: 'bg-sky-500' },
  completed: { label: 'Action completed', cls: 'text-status-active', dot: 'bg-status-active' },
  dismissed: { label: 'Dismissed', cls: 'text-text-secondary', dot: 'bg-text-tertiary' },
} as const;

export function AuditCard({ insight }: { insight: Insight }) {
  const audit = insight.detail?.audit;
  const l = lifecycle[insight.status];
  const steps = insight.detail?.steps?.length ?? 0;
  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-4 md:p-5 space-y-3">
      <div className="border-b border-border-strong pb-2.5 flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-text-primary">Audit &amp; Review Log</h3>
        <Icon name="history" className="text-[16px] text-text-tertiary" />
      </div>
      <dl className="space-y-2.5 font-body-sm text-body-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">Lifecycle Status:</dt>
          <dd className={cn('inline-flex items-center gap-1 font-semibold', l.cls)}>
            <span className={cn('w-2 h-2 rounded-full', l.dot)} />
            {l.label}
            <span className="sr-only">({insightStatusMeta[insight.status].label})</span>
          </dd>
        </div>
        {steps > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-text-secondary">Plan Progress:</dt>
            <dd className="font-semibold text-text-primary tnum">
              {insight.completedStepIds.length}/{steps} steps
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">Assigned Operator:</dt>
          <dd className="font-semibold text-text-primary text-right">{audit?.operator ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">Trigger Source:</dt>
          <dd className="font-mono text-xs text-text-secondary text-right">{audit?.trigger ?? 'Demo dataset snapshot'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-secondary">Model Version:</dt>
          <dd className="font-mono text-xs text-text-secondary">{audit?.modelVersion ?? 'Eko-Intelligence-v4.2.1'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-strong text-xs text-text-tertiary">
          <dt>Last telemetry check:</dt>
          <dd>{audit?.lastCheck ?? insight.generatedAt}</dd>
        </div>
      </dl>
    </div>
  );
}
