import { useState } from 'react';
import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { SegmentedControl } from '@/components/ui/Controls';
import { formatCompact, formatDate } from '@/lib/format';
import type { CampaignProgression, CampaignProgressMetric } from '@/types/campaigns';
import type { Campaign } from '@/types/domain';
import { UnavailableNote } from './SectionCard';

const METRICS: Array<{ value: CampaignProgressMetric; label: string }> = [
  { value: 'views', label: 'Views' },
  { value: 'reach', label: 'Reach' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
];

/** Export: "PERFORMANCE ANALYTICS DUAL-LINE CHART" — cumulative Oct vs Sep baseline with a metric switch. */
export function PerformanceAnalytics({ campaign, progression }: { campaign: Campaign; progression: CampaignProgression | undefined }) {
  const [metric, setMetric] = useState<CampaignProgressMetric>('views');
  const range = campaign.startDate && campaign.endDate ? `${formatDate(campaign.startDate, { year: false })} - ${formatDate(campaign.endDate, { year: false })}` : 'Current';
  const formatter = metric === 'engagement' ? (v: number) => `${v.toFixed(2)}%` : (v: number) => formatCompact(v, { fullBelow: 1000 });

  return (
    <section className="bg-surface-card border border-border-strong rounded p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-strong">
        <div>
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">Performance Analytics</h2>
          <p className="font-body-sm text-body-sm text-text-secondary">
            {metric === 'engagement' ? 'Running engagement rate' : 'Cumulative progression'} comparing the current cycle to the September baseline
          </p>
        </div>
        {progression && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            <SegmentedControl options={METRICS} value={metric} onChange={setMetric} ariaLabel="Chart metric" />
            <ChartLegend
              items={[
                { label: `Current (${range})`, color: '#F5A623' },
                { label: 'Previous (Sep 01 - Sep 30)', color: '#94A3B8', dashed: true },
              ]}
            />
          </div>
        )}
      </div>
      {progression ? (
        <div className="pt-6">
          <TrendChart
            data={progression[metric]}
            height={256}
            showYAxis
            valueFormatter={formatter}
            currentLabel={`Current (${range})`}
            previousLabel="Previous (Sep 01 - Sep 30)"
          />
        </div>
      ) : (
        <UnavailableNote icon="monitoring">
          {campaign.metrics
            ? 'A day-by-day breakdown for this campaign is not available in the demo dataset. Period totals are shown in the KPI cards above.'
            : 'Metrics will appear after the campaign starts.'}
        </UnavailableNote>
      )}
    </section>
  );
}
