import { Skeleton } from '@/components/ui/States';
import type { QueryResult } from '@/hooks/useQuery';
import { cn, formatPercent } from '@/lib/format';
import type { Campaign } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

export interface CampaignFunnel {
  funnel: { readonly new: number; readonly contacted: number; readonly qualified: number; readonly converted: number };
  channels: ReadonlyArray<{ readonly label: string; readonly share: number; readonly leads: number }>;
}

const STAGES = [
  { key: 'new', label: 'New', box: 'bg-slate-100 border-border-strong', label_: 'text-text-secondary', value: 'text-text-primary' },
  { key: 'contacted', label: 'Contacted', box: 'bg-blue-50 border-blue-200', label_: 'text-blue-700', value: 'text-blue-900' },
  { key: 'qualified', label: 'Qualified', box: 'bg-amber-50 border-amber-200', label_: 'text-amber-800', value: 'text-amber-900' },
  { key: 'converted', label: 'Converted', box: 'bg-emerald-50 border-emerald-200', label_: 'text-emerald-800', value: 'text-emerald-900' },
] as const;

const CHANNEL_BARS = ['bg-primary-container', 'bg-slate-600', 'bg-slate-400', 'bg-slate-300'];

/** Export: "LEADS SNAPSHOT" — totals from campaign metrics, pipeline + channels from `leadService.campaignFunnel`. */
export function LeadsSnapshot({ campaign, query }: { campaign: Campaign; query: QueryResult<CampaignFunnel | null> }) {
  const m = campaign.metrics;
  return (
    <SectionCard icon="contact_page" title="Leads Snapshot" titleSize="sm" link={{ to: '/leads', label: 'View Leads' }}>
      {!m ? (
        <UnavailableNote icon="contact_page">Metrics will appear after the campaign starts.</UnavailableNote>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-surface-canvas p-3 rounded border border-border-strong">
            <div>
              <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider block">Generated Leads</span>
              <span className="font-metric-stat-lg text-metric-stat-lg text-text-primary font-bold tnum">{m.leads}</span>
            </div>
            <div className="text-right">
              <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider block">Conversion Rate</span>
              <span className="font-metric-stat-sm text-metric-stat-sm text-status-active font-bold tnum">{formatPercent(m.conversionRate, 1)}</span>
            </div>
          </div>
          {query.status === 'loading' ? (
            <Skeleton className="h-28" />
          ) : !query.data ? (
            <UnavailableNote flush>Detailed pipeline and channel breakdown is not available in the demo dataset for this campaign.</UnavailableNote>
          ) : (
            <>
              <div>
                <span className="font-label-sm text-label-sm text-text-secondary mb-2 block">Acquisition Pipeline</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center font-label-sm text-label-sm">
                  {STAGES.map((s) => (
                    <div key={s.key} className={cn('p-2 rounded border', s.box)}>
                      <span className={cn('block text-[10px] uppercase', s.label_)}>{s.label}</span>
                      <span className={cn('font-bold text-sm tnum', s.value)}>{query.data!.funnel[s.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-label-sm text-label-sm text-text-secondary mb-2 block">Attribution by Channel</span>
                <div className="space-y-2">
                  {query.data.channels.map((c, i) => (
                    <div key={c.label}>
                      <div className="flex justify-between gap-2 text-xs mb-1">
                        <span className="font-medium text-text-primary">{c.label}</span>
                        <span className="font-bold text-text-primary tnum whitespace-nowrap">
                          {c.share}% ({c.leads} leads)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden">
                        <div className={cn('h-full', CHANNEL_BARS[i] ?? 'bg-slate-300')} style={{ width: `${c.share}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}
