import { TableShell } from '@/components/tables/DataTable';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCompact, formatNumber } from '@/lib/format';
import type { AudiencePageData } from './model';

const stateBar = ['bg-primary-container', 'bg-slate-700', 'bg-slate-600', 'bg-slate-500', 'bg-slate-400', 'bg-slate-300'];

/** Top states (canonical audienceSummary.topStates) + top cities table. */
export function LocationSection({ data }: { data: AudiencePageData }) {
  const { summary, intel } = data;
  const avgConversion = intel.cities.reduce((s, c) => s + c.conversionPct, 0) / intel.cities.length;
  const topCities = [...intel.cities].sort((a, b) => b.conversionPct - a.conversionPct).slice(0, 2);

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Location Intelligence</h3>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Geographic engagement distribution across key business states and Tier 2/3 clusters</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-text-secondary">Primary Market:</span>
          <span className="font-label-sm text-label-sm font-bold text-text-primary bg-surface-canvas border border-border-strong px-2 py-0.5 rounded">{intel.primaryMarket}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          <h4 className="font-headline-sm text-headline-sm text-text-primary font-bold flex flex-wrap items-center justify-between gap-1">
            <span>Top States &amp; Regional Reach</span>
            <span className="text-xs font-normal text-text-secondary">Share | Reach | Engaged | Leads</span>
          </h4>
          {summary.topStates.map((s, i) => {
            const top = i === 0;
            return (
              <div key={s.label} className={cn('p-2.5 border rounded', top ? 'bg-amber-50/40 border-amber-200/60' : 'bg-surface-canvas border-border-strong')}>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <span className={cn('text-text-primary flex items-center gap-1.5', top ? 'font-bold' : 'font-semibold')}>
                    {top && <span className="w-2 h-2 rounded-full bg-primary-container" />}
                    {s.label}
                  </span>
                  <span className={cn('tnum', top ? 'font-bold text-primary' : 'text-text-secondary font-medium')}>
                    {s.share}% ({formatCompact(s.reach)} Reach • {formatCompact(s.engaged, { fullBelow: 1000 })} Eng • {s.leads} Leads)
                  </span>
                </div>
                <div className="w-full bg-surface-card-subtle h-2 rounded-full overflow-hidden">
                  <div className={cn('h-full', stateBar[i] ?? 'bg-slate-300')} style={{ width: `${s.share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="lg:col-span-5 flex flex-col justify-between lg:border-l border-border-strong lg:pl-6 min-w-0">
          <div>
            <h4 className="font-headline-sm text-headline-sm text-text-primary font-bold mb-3 flex items-center justify-between">
              <span>Top Urban &amp; Semi-Urban Hubs</span>
              <Icon name="apartment" className="text-text-tertiary text-[18px]" />
            </h4>
            <TableShell>
              <thead>
                <tr className="bg-surface-canvas text-text-secondary text-[11px] font-semibold uppercase tracking-wider border-y border-border-strong">
                  <th className="py-2 px-2.5 text-left">City</th>
                  <th className="py-2 px-2.5 text-right">Reach</th>
                  <th className="py-2 px-2.5 text-right">Leads</th>
                  <th className="py-2 px-2.5 text-right" title="Leads ÷ inquiring accounts">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-strong font-body-sm text-body-sm">
                {intel.cities.map((c) => {
                  const strong = c.conversionPct >= avgConversion + 1;
                  return (
                    <tr key={c.city} className="hover:bg-surface-canvas">
                      <td className="py-2 px-2.5 font-semibold text-text-primary whitespace-nowrap">{c.city}</td>
                      <td className="py-2 px-2.5 text-right tnum font-medium text-text-secondary">{formatNumber(c.reach)}</td>
                      <td className={cn('py-2 px-2.5 text-right tnum font-bold', strong ? 'text-primary' : 'text-text-primary')}>{c.leads}</td>
                      <td className={cn('py-2 px-2.5 text-right tnum', strong ? 'text-status-active font-semibold' : 'text-text-secondary')}>{c.conversionPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          </div>
          <p className="text-[11px] text-text-secondary mt-3">
            💡 {topCities.map((c) => c.city.replace(/ \(.*\)/, '')).join(' and ')} show the highest CSP lead conversion among tracked hubs, above metro clusters.
          </p>
        </div>
      </div>
      <p className="text-[11px] text-text-tertiary mt-3">State leads are location-attributed leads ({summary.topStates.reduce((s, x) => s + x.leads, 0)} of the period total).</p>
    </section>
  );
}
