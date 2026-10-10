import { Link } from 'react-router-dom';
import { CampaignStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatPercent } from '@/lib/format';
import type { AudiencePageData } from './model';

/** Audience → Content Preferences cards (lead / ER / conversion figures come from the segment table). */
export function ContentPreferencesSection({ data }: { data: AudiencePageData }) {
  const { intel, content } = data;
  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Audience → Content Preferences</h3>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Format and topic resonance across key audience demographics</p>
        </div>
        <Link to="/content" className="font-label-sm text-label-sm text-primary font-semibold hover:underline flex items-center gap-1">
          Open Content Analytics <Icon name="open_in_new" className="text-[14px]" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {intel.contentPreferences.map((p) => {
          const seg = intel.segments.find((s) => s.id === p.segmentId);
          const top = content.find((c) => c.id === p.topContentId);
          const amber = p.tone === 'amber';
          const check = amber ? 'text-primary' : 'text-status-completed';
          return (
            <div key={p.segmentId} className="p-3.5 bg-surface-canvas border border-border-strong rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', amber ? 'bg-amber-100 text-primary border-amber-300' : 'bg-blue-100 text-status-completed border-blue-300')}>
                      {p.title}
                    </span>
                    <span className="text-xs text-text-secondary">Core Intent: {p.intent}</span>
                  </div>
                  {seg && <span className={cn('font-bold text-xs', amber ? 'text-status-active' : 'text-text-primary')}>{seg.leads} Leads Attributed</span>}
                </div>
                <div className="space-y-1.5 my-3">
                  {[
                    ['Top Format', p.topFormat],
                    ['Runner-up', p.runnerUp],
                    ['Topic', p.topic],
                  ].map(([k, v]) => (
                    <div key={k} className="text-xs font-medium text-text-primary flex items-center gap-2">
                      <Icon name="check_small" className={cn('text-[16px]', check)} />
                      <span>
                        {k}: <strong>{v}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-border-strong flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                {top ? (
                  <Link to={`/content/${top.id}`} className="tnum hover:underline">
                    Top content: <strong>{formatCompact(top.metrics.views)} Views</strong>
                  </Link>
                ) : (
                  <span />
                )}
                {seg && (
                  <>
                    <span className="tnum">
                      Avg Engagement: <strong className="text-text-primary">{formatPercent(seg.engagementRate)}</strong>
                    </span>
                    <span className="text-status-active font-bold">Conversion Rate: {formatPercent(seg.conversionRate, 1)}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Two campaign flights side by side (views from campaignService, audience profile from demo data). */
export function CampaignComparisonSection({ data }: { data: AudiencePageData }) {
  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Compare Campaigns Audience Composition</h3>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Benchmarking audience demographic penetration across major campaign flights</p>
        </div>
        <span className="font-label-sm text-label-sm text-text-secondary">Comparative Differential Tool</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.intel.campaignProfiles.map((p, i) => {
          const c = data.campaigns.find((x) => x.id === p.campaignId);
          if (!c) return null;
          const tiles = [
            { label: 'Total Views', value: formatCompact(c.metrics?.views), accent: false },
            { label: 'Non-Followers', value: `${p.nonFollowerPct}%`, accent: p.nonFollowerPct >= 50 },
            { label: `Core Age (${p.coreAge.label})`, value: `${p.coreAge.share}%`, accent: false },
            { label: `Dominant State (${p.dominantState.label})`, value: `${p.dominantState.share}%`, accent: false },
          ];
          return (
            <div key={p.campaignId} className="p-3.5 bg-surface-canvas border border-border-strong rounded-lg">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', i === 0 ? 'text-primary' : 'text-text-secondary')}>{p.flightLabel}</span>
                  <h4 className="font-headline-sm text-headline-sm text-text-primary font-bold">{c.name}</h4>
                </div>
                <CampaignStatusBadge status={c.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                {tiles.map((t) => (
                  <div key={t.label} className="p-2 bg-surface-card border border-border-strong rounded">
                    <span className="text-text-secondary block">{t.label}</span>
                    <strong className={cn('font-bold text-sm tnum', t.accent ? 'text-primary' : 'text-text-primary')}>{t.value}</strong>
                  </div>
                ))}
              </div>
              <Link to={`/campaigns/${c.id}`} className={cn('text-xs font-semibold hover:underline flex items-center gap-1', i === 0 ? 'text-primary' : 'text-text-secondary')}>
                View Campaign ({c.name.replace(/ Campaign$/, '')}) →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Data-availability notice + quick navigation (bottom of the export). */
export function DataLimitsNotice() {
  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-amber-50 text-amber-600 flex-shrink-0 mt-0.5">
          <Icon name="lock_clock" className="text-[20px]" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-headline-sm text-headline-sm text-text-primary font-bold">Meta Graph API Attribution Limitations &amp; Privacy Safeguards</h4>
            <span className="text-[10px] bg-surface-card-subtle text-text-secondary border border-border-strong px-2 rounded font-semibold">INFO NOTICE</span>
          </div>
          <p className="font-body-sm text-body-sm text-text-secondary mt-1">
            Certain audience attributes (such as micro-zipcode granular locations and specific individual incomes) are not available from the Instagram Graph API because of
            platform limits and user privacy guidelines. All figures on this page are demo data for the prototype.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border-strong text-xs font-semibold">
            <span className="text-text-secondary">Quick Navigation:</span>
            <Link className="text-primary hover:underline" to="/content">
              View Content Library →
            </Link>
            <Link className="text-primary hover:underline" to="/comments">
              View Comments Stream →
            </Link>
            <Link className="text-primary hover:underline" to="/leads">
              View Leads Pipeline →
            </Link>
            <Link className="text-primary hover:underline" to="/accounts/acc-ekoindia">
              Account Connection Status →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
