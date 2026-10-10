import { Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import type { AudienceSummary } from '@/types/audience';
import { SectionCard, UnavailableNote } from './SectionCard';

/** Export: "AUDIENCE SNAPSHOT" — gender split, age distribution and top geographies from `audienceService.summary()`. */
export function AudienceSnapshot({ query, accountLevelNote, hasMetrics }: { query: QueryResult<AudienceSummary>; accountLevelNote?: boolean; hasMetrics: boolean }) {
  return (
    <SectionCard icon="group" title="Audience Snapshot" titleSize="sm" link={{ to: '/audience', label: 'View Audience Insights' }}>
      {!hasMetrics ? (
        <UnavailableNote icon="group">Metrics will appear after the campaign starts.</UnavailableNote>
      ) : query.status === 'loading' ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-6" />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
        </div>
      ) : query.status !== 'success' || !query.data ? (
        <UnavailableNote icon="warning">{query.status === 'error' ? `Audience data could not be loaded. ${query.error?.message ?? ''}` : 'No audience data available.'}</UnavailableNote>
      ) : (
        <AudienceBody data={query.data} accountLevelNote={accountLevelNote} />
      )}
    </SectionCard>
  );
}

function AudienceBody({ data, accountLevelNote }: { data: AudienceSummary; accountLevelNote?: boolean }) {
  const { gender } = data;
  const maxAge = Math.max(...data.age.map((a) => a.share));
  const geos = data.topStates.filter((s) => !s.label.startsWith('Other')).slice(0, 5);
  return (
    <div className="mt-4 flex flex-col gap-4">
      {accountLevelNote && <p className="text-[11px] text-text-tertiary -mb-1">Showing the account-level audience; a campaign-level breakdown is not available in the demo dataset.</p>}
      <div>
        <div className="flex flex-wrap justify-between gap-1 font-label-sm text-label-sm mb-1.5">
          <span className="text-text-secondary">Gender Breakdown</span>
          <span className="text-text-primary font-bold tnum">
            Female {gender.female}% · Male {gender.male}% · Other {gender.unknown}%
          </span>
        </div>
        <div className="w-full h-2 rounded bg-slate-100 overflow-hidden flex" role="img" aria-label={`Female ${gender.female}%, male ${gender.male}%, other ${gender.unknown}%`}>
          <div className="h-full bg-amber-400" style={{ width: `${gender.female}%` }} title={`Female ${gender.female}%`} />
          <div className="h-full bg-slate-700" style={{ width: `${gender.male}%` }} title={`Male ${gender.male}%`} />
          <div className="h-full bg-slate-300" style={{ width: `${gender.unknown}%` }} title={`Other ${gender.unknown}%`} />
        </div>
      </div>
      <div>
        <span className="font-label-sm text-label-sm text-text-secondary mb-2 block">Age Distribution</span>
        <div className="space-y-1.5">
          {data.age.map((a) => {
            const top = a.share === maxAge;
            return (
              <div key={a.label} className="flex items-center gap-2 text-xs">
                <span className={cn('w-12', top ? 'text-text-primary font-bold' : 'text-text-secondary font-medium')}>{a.label}</span>
                <div className="flex-1 h-3 rounded bg-slate-100 overflow-hidden">
                  <div className={cn('h-full', top ? 'bg-[#D97706]' : a.share >= 15 ? 'bg-primary-container' : 'bg-slate-300')} style={{ width: `${a.share}%` }} />
                </div>
                <span className="w-8 text-right font-bold text-text-primary tnum">{a.share}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pt-2 border-t border-border-strong">
        <span className="font-label-sm text-label-sm text-text-secondary mb-2 block">Top Geographies</span>
        <div className="flex flex-wrap gap-1.5">
          {geos.map((g, i) =>
            i === 0 ? (
              <span key={g.label} className="px-2.5 py-1 rounded bg-surface-canvas border border-border-strong text-text-primary font-label-md text-label-md font-semibold">
                1. {g.label} <strong className="text-primary font-bold">({g.share}%)</strong>
              </span>
            ) : (
              <span key={g.label} className="px-2 py-1 rounded bg-surface-canvas border border-border-strong text-text-secondary font-label-md text-label-md">
                {i + 1}. {g.label} ({g.share}%)
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
