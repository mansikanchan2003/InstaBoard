import { useState } from 'react';
import { QueryState } from '@/components/ui/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { AiAudienceSection } from '@/features/audience/AiAudienceSection';
import { AudienceFilterBar, AudienceFilterNotice } from '@/features/audience/AudienceFilterBar';
import { AudienceGrowthSection } from '@/features/audience/AudienceGrowthSection';
import { AudienceHeader } from '@/features/audience/AudienceHeader';
import { AudienceInsightCards, AudienceKpis } from '@/features/audience/AudienceOverview';
import { AudienceEmpty, AudienceError, AudienceSkeleton } from '@/features/audience/AudienceStates';
import { DemographicsSection } from '@/features/audience/DemographicsSection';
import { FollowerSplitSection } from '@/features/audience/FollowerSplitSection';
import { LocationSection } from '@/features/audience/LocationSection';
import { initialAudienceFilters, loadAudiencePage, type AudienceFilters } from '@/features/audience/model';
import { CampaignComparisonSection, ContentPreferencesSection, DataLimitsNotice } from '@/features/audience/PreferencesAndComparison';
import { SegmentTable } from '@/features/audience/SegmentTable';

export default function AudiencePage() {
  useDocumentTitle('Audience Intelligence');
  const query = useQuery('audience:page', loadAudiencePage);
  const [filters, setFilters] = useState<AudienceFilters>(initialAudienceFilters);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <AudienceHeader data={query.data} />
        <AudienceFilterBar data={query.data} filters={filters} onChange={setFilters} />
      </section>

      <QueryState
        query={query}
        loading={<AudienceSkeleton />}
        empty={
          <AudienceEmpty
            onReset={() => {
              setFilters(initialAudienceFilters);
              query.refetch();
            }}
          />
        }
        error={(err, retry) => <AudienceError message={err?.message} onRetry={retry} />}
      >
        {(data) => (
          <>
            <AudienceFilterNotice data={data} filters={filters} />
            <AudienceKpis data={data} compare={filters.compare} />
            <AudienceInsightCards data={data} />
            <FollowerSplitSection data={data} />
            <DemographicsSection data={data} compare={filters.compare} />
            <LocationSection data={data} />
            <AudienceGrowthSection data={data} compare={filters.compare} />
            <SegmentTable data={data} />
            <AiAudienceSection data={data} />
            <ContentPreferencesSection data={data} />
            <CampaignComparisonSection data={data} />
            <DataLimitsNotice />
          </>
        )}
      </QueryState>
    </div>
  );
}
