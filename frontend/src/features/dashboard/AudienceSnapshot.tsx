import { Link } from 'react-router-dom';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { audienceService } from '@/services/audience';

/** Audience Snapshot card: gender split, top age brackets, top geographies (canonical audience summary). */
export function AudienceSnapshot() {
  const audience = useQuery('audience:summary', audienceService.summary);

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-5" aria-labelledby="dash-audience-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 id="dash-audience-title" className="font-headline-sm text-headline-sm text-text-primary">
            Audience Snapshot
          </h3>
          <p className="text-body-sm text-text-secondary">Core demographics</p>
        </div>
        <Link to="/audience" className="text-xs font-semibold text-text-primary hover:text-primary-container">
          Details →
        </Link>
      </div>
      <QueryState
        query={audience}
        loading={
          <div className="space-y-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-20" />
            <Skeleton className="h-12" />
          </div>
        }
        empty={<p className="text-body-sm text-text-secondary py-6 text-center">Audience insights are not available for this account yet.</p>}
      >
        {(a) => {
          const ages = [...a.age].sort((x, y) => y.share - x.share).slice(0, 3);
          const geos = a.topStates.filter((s) => !s.label.startsWith('Other')).slice(0, 4);
          return (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-text-primary tnum">Male {a.gender.male}%</span>
                  <span className="font-semibold text-text-secondary tnum">Female {a.gender.female}%</span>
                </div>
                <div
                  className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex"
                  role="img"
                  aria-label={`Male ${a.gender.male}%, female ${a.gender.female}%, unknown ${a.gender.unknown}%`}
                >
                  <div className="bg-text-primary h-full" style={{ width: `${a.gender.male}%` }} />
                  <div className="bg-primary-container h-full" style={{ width: `${a.gender.female}%` }} />
                </div>
                {a.gender.unknown > 0 && <span className="text-[10px] text-text-tertiary tnum">{a.gender.unknown}% undisclosed</span>}
              </div>
              <div className="mb-4">
                <span className="text-[11px] font-semibold text-text-secondary block mb-1.5">Dominant Age Bracket</span>
                {ages.map((age, i) => (
                  <div key={age.label} className={cn('flex items-center justify-between gap-2 text-xs py-1', i < ages.length - 1 && 'border-b border-border-subtle')}>
                    <span className={i === 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}>
                      {age.label} years{age.note ? ` (${age.note})` : ''}
                    </span>
                    <span className={cn('tnum', i === 0 ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>{age.share}%</span>
                  </div>
                ))}
              </div>
              <div>
                <span className="text-[11px] font-semibold text-text-secondary block mb-1">Top Geographies</span>
                <div className="flex flex-wrap gap-1.5">
                  {geos.map((g) => (
                    <span key={g.label} className="px-2 py-0.5 rounded bg-surface-canvas border border-border-strong text-xs font-medium text-text-primary tnum">
                      {g.label} ({g.share}%)
                    </span>
                  ))}
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}
