import { DemoBadge } from '@/components/ui/Badge';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import type { AnalyticsPageData } from './model';
import { SectionCard, UnavailableSection } from './SectionCard';

const trafficBar = ['bg-primary-container', 'bg-amber-400', 'bg-slate-400', 'bg-slate-300'];
const stateBar = ['bg-primary-container', 'bg-primary-container/85', 'bg-primary-container/70', 'bg-primary-container/55', 'bg-primary-container/40'];

/** Followers vs non-followers, traffic surfaces and the interaction matrix. */
export function DiscoveryCard({ data }: { data: AnalyticsPageData }) {
  const { item, analytics } = data;
  const d = analytics?.discovery;
  if (!d) return <UnavailableSection title="Discovery & Traffic Architecture" />;
  const m = item.metrics;
  const followers = Math.round((m.reach * d.followerSharePct) / 100);
  const nonFollowers = m.reach - followers;
  const nonPct = 100 - d.followerSharePct;
  const matrix = [
    { label: 'LIKES', value: formatNumber(m.likes) },
    { label: 'COMMENTS', value: formatNumber(m.comments) },
    { label: 'SHARES', value: formatNumber(m.shares) },
    { label: 'SAVES', value: formatNumber(m.saves) },
    { label: 'PROFILE VISITS', value: formatNumber(d.profileVisits) },
    { label: 'NEW FOLLOWS', value: `+${formatNumber(d.newFollows)}`, positive: true },
  ];

  return (
    <SectionCard title="Discovery & Traffic Architecture" right={<span className="text-label-sm font-label-sm text-text-secondary tnum">Reach: {formatNumber(m.reach)} Accounts</span>}>
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-1 text-label-sm font-label-sm mb-1.5">
          <span className="font-semibold text-text-primary">Viewer Segmentation</span>
          <span className="text-text-secondary">{nonPct >= 50 ? 'Non-Followers drive virality' : 'Followers drive distribution'}</span>
        </div>
        <div className="h-4 w-full bg-surface-canvas rounded-full flex overflow-hidden border border-border-strong">
          <div className="bg-slate-700 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${d.followerSharePct}%` }} title={`Followers: ${d.followerSharePct}%`}>
            {d.followerSharePct}%
          </div>
          <div className="bg-primary-container h-full flex items-center justify-center text-[10px] text-text-primary font-bold whitespace-nowrap overflow-hidden" style={{ width: `${nonPct}%` }} title={`Non-Followers: ${nonPct}%`}>
            {nonPct}% Non-Followers
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 text-label-sm font-label-sm">
          <span className="text-text-secondary">
            Followers: <strong className="text-text-primary tnum">{formatNumber(followers)} ({d.followerSharePct}%)</strong>
          </span>
          <span className="text-text-secondary">
            Non-Followers: <strong className="text-text-primary tnum">{formatNumber(nonFollowers)} ({nonPct}%)</strong>
          </span>
        </div>
      </div>

      <div className="mb-5">
        <div className="text-label-sm font-label-sm font-semibold text-text-primary mb-2">Traffic Surfaces</div>
        <div className="space-y-2">
          {d.traffic.map((t, i) => (
            <div key={t.label}>
              <div className="flex justify-between gap-2 text-label-sm font-label-sm mb-1">
                <span className="text-text-secondary">{t.label}</span>
                <span className="font-semibold text-text-primary tnum whitespace-nowrap">
                  {t.share}% ({formatCompact((m.reach * t.share) / 100, { fullBelow: 1000 })})
                </span>
              </div>
              <div className="w-full bg-surface-canvas h-2 rounded-full overflow-hidden border border-border-strong">
                <div className={cn('h-full rounded-full', trafficBar[i] ?? 'bg-slate-300')} style={{ width: `${t.share}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-label-sm font-label-sm font-semibold text-text-primary mb-2">Interaction Metrics Matrix</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
          {matrix.map((x) => (
            <div key={x.label} className="p-2 bg-surface-canvas rounded border border-border-strong">
              <div className="text-label-code font-label-code text-text-secondary">{x.label}</div>
              <div className={cn('text-label-md font-label-md font-bold tnum', x.positive ? 'text-emerald-700' : 'text-text-primary')}>{x.value}</div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

/** Gender / age / top states snapshot for viewers of this item. */
export function AudienceSnapshotCard({ data }: { data: AnalyticsPageData }) {
  const a = data.analytics?.audience;
  if (!a) return <UnavailableSection title="Audience Composition Snapshot" reason="Per-content audience demographics are only in the demo dataset for the showcase Reel. Account-level demographics are on the Audience page." />;
  const topAge = Math.max(...a.age.map((x) => x.share));

  return (
    <SectionCard title="Audience Composition Snapshot" right={<DemoBadge />} className="flex flex-col justify-between">
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-surface-canvas rounded-lg border border-border-strong">
            <div className="text-label-sm font-label-sm font-semibold text-text-primary mb-2">Gender Split</div>
            <div className="flex items-center gap-3">
              {[
                { label: 'Male', value: a.gender.male, bar: 'bg-slate-700' },
                { label: 'Female', value: a.gender.female, bar: 'bg-primary-container' },
              ].map((g) => (
                <div key={g.label} className="flex-1">
                  <div className="flex justify-between text-label-sm font-label-sm mb-1">
                    <span className="text-text-secondary">{g.label}</span>
                    <span className="font-bold text-text-primary">{g.value}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className={cn('h-full', g.bar)} style={{ width: `${g.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-label-code font-label-code text-text-tertiary text-center">Other / Unspecified: {a.gender.unknown}%</div>
          </div>
          <div className="p-3 bg-surface-canvas rounded-lg border border-border-strong">
            <div className="text-label-sm font-label-sm font-semibold text-text-primary mb-1">Age Distribution</div>
            <div className="space-y-1 text-label-sm font-label-sm">
              {a.age.map((x) => (
                <div key={x.label} className="flex justify-between items-center">
                  <span className="text-text-secondary">
                    {x.label}
                    {x.note && ` (${x.note})`}
                  </span>
                  <span className={cn(x.share === topAge ? 'font-bold text-primary' : x.share >= 20 ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary')}>{x.share}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 text-label-sm font-label-sm mb-2">
          <span className="font-semibold text-text-primary">Top Geographies (Recruitment Concentration)</span>
          <span className="text-text-secondary">{a.ruralShareLabel}</span>
        </div>
        <div className="space-y-2">
          {a.states.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-24 text-label-sm font-label-sm font-medium text-text-secondary truncate">{s.label}</span>
              <div className="flex-1 bg-surface-canvas h-2.5 rounded-full overflow-hidden border border-border-strong">
                <div className={cn('h-full rounded-full', stateBar[i] ?? 'bg-primary-container/30')} style={{ width: `${s.share}%` }} />
              </div>
              <span className="w-12 text-right text-label-sm font-label-sm font-bold text-text-primary tnum">{s.share}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border-strong flex flex-wrap items-center justify-between gap-2 text-label-sm font-label-sm text-text-tertiary">
        <span>
          Target demographic alignment: <strong>{a.alignmentPct}% match</strong>
        </span>
        <span>Demo snapshot (Oct 2024)</span>
      </div>
    </SectionCard>
  );
}
