import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { formatNumber } from '@/lib/format';
import { aiService } from '@/services/ai';
import type { CampaignAnalytics } from '@/types/ai';

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${v.toFixed(2)}%`;
}

/** Deterministic metrics (no AI): definitions, sample sizes and insufficient-data states are shown with every figure. */
export function CampaignAnalyticsPanel() {
  const [open, setOpen] = useState(false);
  const q = useQuery('ai:campaign-analytics', () => aiService.campaignAnalytics(), { isEmpty: () => false });
  return (
    <section className="bg-surface-card border border-border-strong rounded-xl p-5" aria-labelledby="det-analytics">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div>
          <h2 id="det-analytics" className="font-headline-sm text-headline-sm font-bold text-text-primary">Campaign metrics (calculated, no AI)</h2>
          <p className="text-[12px] text-text-tertiary">Computed from stored campaign, content and lead records. These are the only numbers AI insights may cite.</p>
        </div>
        <button type="button" className="text-label-sm text-primary font-semibold hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide definitions' : 'Show definitions'}
        </button>
      </div>
      <QueryState query={q} loading={<Skeleton className="h-40" />}>
        {(a: CampaignAnalytics) => (
          <div className="space-y-4">
            <p className="text-[12px] text-text-secondary">
              Period {a.periodStart} → {a.periodEnd} · compared with {a.previousStart} → {a.previousEnd} · sources: {a.sources.map((s) => s.replace('_', ' ')).join(', ')}
            </p>
            {a.insufficient.length > 0 && (
              <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                Not enough data for: {a.insufficient.map((s) => s.replace(/_/g, ' ')).join(', ')}. These are shown as unavailable rather than estimated
                (minimum {a.thresholds.minItems} items per rate, {a.thresholds.minLeads} leads for conversion rate).
              </p>
            )}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[680px] text-body-sm">
                <thead>
                  <tr className="border-b border-border-strong text-text-secondary font-label-code text-label-code uppercase tracking-wider">
                    <th className="py-2 px-2">Campaign</th>
                    <th className="py-2 px-2 text-right">Posts</th>
                    <th className="py-2 px-2 text-right">Reach</th>
                    <th className="py-2 px-2 text-right">Engagement rate</th>
                    <th className="py-2 px-2 text-right">Leads</th>
                    <th className="py-2 px-2 text-right">Leads / 1,000 reach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {a.campaigns.map((c) => (
                    <tr key={c.campaignId}>
                      <td className="py-2 px-2 font-semibold text-text-primary">{c.name}</td>
                      <td className="py-2 px-2 text-right tnum">{c.posts}</td>
                      <td className="py-2 px-2 text-right tnum">{formatNumber(c.reach as number | null)}</td>
                      <td className="py-2 px-2 text-right tnum">
                        {pct(c.engagementRate)} {!c.engagementRateSufficient && <Badge tone="neutral">small sample</Badge>}
                      </td>
                      <td className="py-2 px-2 text-right tnum">{c.leads}</td>
                      <td className="py-2 px-2 text-right tnum">{c.leadYield === null ? '—' : c.leadYield.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px]">
              {a.formats.map((f) => (
                <span key={f.type} className="px-2 py-1 rounded border border-border-strong bg-surface-canvas">
                  {f.type}: {pct(f.engagementRate)} ({f.items} item{f.items === 1 ? '' : 's'}){!f.sufficient && ' — too few to compare'}
                </span>
              ))}
            </div>
            {open && (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
                {Object.entries(a.definitions).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold text-text-primary">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-text-secondary">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
