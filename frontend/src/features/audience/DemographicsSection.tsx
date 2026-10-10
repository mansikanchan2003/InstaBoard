import { DemoBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact } from '@/lib/format';
import { signedPct, type AudiencePageData } from './model';

const ageBar = ['bg-slate-400', 'bg-amber-400', 'bg-primary-container', 'bg-slate-600', 'bg-slate-400', 'bg-slate-300'];

/** Gender distribution (5 cols) + age distribution (7 cols). */
export function DemographicsSection({ data, compare }: { data: AudiencePageData; compare: boolean }) {
  const { summary, overview } = data;
  const g = summary.gender;
  const reach = overview.reach.value;
  const coreShare = Math.max(...summary.age.map((a) => a.share));
  const core = summary.age.find((a) => a.share === coreShare);
  const genders = [
    { label: 'Male', share: g.male, dot: 'bg-blue-600' },
    { label: 'Female', share: g.female, dot: 'bg-amber-500' },
    { label: 'Unknown', share: g.unknown, dot: 'bg-slate-400' },
  ];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong">
            <div>
              <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Gender Distribution</h3>
              <span className="font-body-sm text-body-sm text-text-secondary">Aggregate profile attribution</span>
            </div>
            <DemoBadge />
          </div>
          <div className="my-6">
            <div className="h-6 w-full rounded overflow-hidden flex border border-border-strong shadow-xs mb-4">
              <div className="bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold whitespace-nowrap overflow-hidden" style={{ width: `${g.male}%` }}>
                {g.male}% Male
              </div>
              <div className="bg-amber-500 flex items-center justify-center text-white text-[11px] font-bold whitespace-nowrap overflow-hidden" style={{ width: `${g.female}%` }}>
                {g.female}% Female
              </div>
              <div className="bg-slate-400" style={{ width: `${g.unknown}%` }} title={`Unknown ${g.unknown}%`} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {genders.map((x) => (
                <div key={x.label} className="p-3 bg-surface-canvas border border-border-strong rounded">
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                    <span className={cn('w-2 h-2 rounded-full', x.dot)} />
                    {x.label}
                  </div>
                  <div className="font-metric-stat-sm text-metric-stat-sm text-text-primary font-bold mt-1">{x.share}%</div>
                  <div className="text-[11px] text-text-secondary mt-0.5 tnum">{formatCompact((reach * x.share) / 100, { fullBelow: 1000 })} users</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-2.5 bg-surface-canvas border border-border-strong rounded text-[11px] text-text-secondary flex items-start gap-2">
          <Icon name="lock" className="text-[16px] text-text-tertiary flex-shrink-0" />
          <span>In production, demographics come from Instagram's user-declared profile data (aggregated, privacy-thresholded). Unspecified profiles map to Unknown.</span>
        </div>
      </div>

      <div className="lg:col-span-7 bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-4">
          <div>
            <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Age Distribution</h3>
            <span className="font-body-sm text-body-sm text-text-secondary">Audience size by age brackets{compare ? ' & pacing vs September' : ''}</span>
          </div>
          {core && <span className="font-label-sm text-label-sm text-primary bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold">⭐ Core: {core.label} Segment</span>}
        </div>
        <div className="flex flex-col gap-3 font-body-sm text-body-sm">
          {summary.age.map((a, i) => {
            const isCore = a.share === coreShare;
            return (
              <div key={a.label} className={cn('flex items-center gap-3', isCore && 'p-1 rounded bg-amber-50/50 border border-amber-200/60')} title={a.note}>
                <span className={cn('w-12 text-xs', isCore ? 'font-bold text-primary' : 'font-semibold text-text-secondary')}>{a.label}</span>
                <div className={cn('flex-1 bg-surface-card-subtle rounded overflow-hidden border', isCore ? 'h-5 border-amber-300' : 'h-4 border-border-strong')}>
                  <div className={cn('h-full', ageBar[i] ?? 'bg-slate-300')} style={{ width: `${a.share}%` }} />
                </div>
                <span className={cn('w-10 text-right font-bold tnum', isCore ? 'text-sm text-primary' : 'text-xs text-text-primary')}>{a.share}%</span>
                <span className={cn('w-16 sm:w-20 text-right text-xs tnum', isCore ? 'font-semibold text-text-primary' : 'text-text-secondary')}>{formatCompact(a.audience, { fullBelow: 1000 })} aud</span>
                {compare && (
                  <span className={cn('w-12 sm:w-14 text-right text-xs font-semibold tnum', a.deltaPct >= 0 ? 'text-status-active' : 'text-error', isCore && 'font-bold')}>{signedPct(a.deltaPct)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
