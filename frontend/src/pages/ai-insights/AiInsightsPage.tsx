import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { insightsService } from '@/services/insights';
import { defaultInsightFilters, filterInsights, InsightCard, InsightFilterBar, type InsightFilterState } from '@/features/ai-insights/InsightFeed';
import { InsightsEmpty, InsightsError, InsightsSkeleton, ProcessingAnalysis } from '@/features/ai-insights/InsightsStates';
import { ExecutiveSynthesis, InsightKpiTiles } from '@/features/ai-insights/OverviewSummary';
import { RecommendedActionsTable } from '@/features/ai-insights/RecommendedActionsTable';
import { AiJobProgress, AiStatusNotice } from '@/features/ai/AiWidgets';
import { CampaignAnalyticsPanel } from '@/features/ai/CampaignAnalyticsPanel';
import { useAiJob } from '@/features/ai/useAiJob';
import { isDemoMode } from '@/lib/config';
import { aiService } from '@/services/ai';

export default function AiInsightsPage() {
  useDocumentTitle('AI Insights');
  const toast = useToast();
  const overviewQ = useQuery('insights:overview', insightsService.overview);
  const listQ = useQuery('insights:list', insightsService.list);
  const actionsQ = useQuery('insights:actions', insightsService.actions);
  const [filters, setFilters] = useState<InsightFilterState>(defaultInsightFilters);
  const [processing, setProcessing] = useState(false);
  const aiJob = useAiJob({ invalidate: ['insights', 'ai'] });
  const lastAi = useMemo(() => (listQ.data ?? []).map((i) => i.ai?.generatedAt).filter(Boolean).sort().at(-1), [listQ.data]);
  // api mode: queue a real, evidence-grounded generation job; demo mode keeps the labelled walkthrough.
  const startGeneration = () => (isDemoMode ? setProcessing(true) : void aiJob.start(() => aiService.generateInsights()));

  const regenerate = useMutation(insightsService.regenerate, {
    invalidate: ['insights'],
    onSuccess: () => {
      setProcessing(false);
      toast({
        tone: 'demo',
        title: 'Analysis regenerated (demo)',
        description: 'No model was called — the insights shown are the same demo synthesis. Live regeneration needs the backend.',
      });
    },
    onError: (e) => {
      setProcessing(false);
      toast({ tone: 'error', title: 'Regeneration unavailable', description: e.message });
    },
  });

  const visible = useMemo(() => filterInsights(listQ.data ?? [], filters), [listQ.data, filters]);

  const header = (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-border-strong pb-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-headline-md md:text-headline-lg font-headline-lg text-text-primary tracking-tight">AI Insights</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-code font-label-code bg-ai-subtle border border-ai-border text-ai-accent">
            <Icon name="auto_awesome" filled className="text-[13px]" />
            {overviewQ.data?.engineVersion ?? 'SYNTHESIS ENGINE v4.2'}
          </span>
        </div>
        <p className="text-text-secondary font-body-md text-body-md mt-0.5">Understand campaign performance and discover your next best action.</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-label-sm font-label-sm text-text-tertiary">
          <Icon name="schedule" className="text-[14px]" />
          <span>{isDemoMode ? `Last generated: ${overviewQ.data?.generatedAt ?? '—'}` : `Last AI analysis: ${lastAi ? new Date(lastAi).toLocaleString() : 'never'}`}</span>
        </div>
        <Button variant="primary" icon={aiJob.active ? 'progress_activity' : 'refresh'} onClick={startGeneration}
          disabled={processing || !!aiJob.active} loading={aiJob.starting} className="rounded">
          {isDemoMode ? 'Regenerate analysis' : aiJob.active ? 'Analysing…' : 'Generate insights'}
        </Button>
      </div>
    </div>
  );

  const apiExtras = !isDemoMode && (
    <div className="space-y-4">
      <AiStatusNotice />
      {aiJob.active && <div className="bg-surface-card border border-ai-border rounded-xl p-4"><AiJobProgress job={aiJob.active} /></div>}
      <CampaignAnalyticsPanel />
    </div>
  );

  const body = () => {
    if (processing) return <ProcessingAnalysis onComplete={() => regenerate.mutate()} onCancel={() => setProcessing(false)} />;
    if (overviewQ.status === 'loading' || listQ.status === 'loading') return <InsightsSkeleton />;
    if (overviewQ.status === 'error' || listQ.status === 'error') return <InsightsError error={overviewQ.error ?? listQ.error} onRetry={() => (overviewQ.refetch(), listQ.refetch(), actionsQ.refetch())} />;
    if (!overviewQ.data || !listQ.data) return <InsightsEmpty onRun={startGeneration} />;

    const overview = overviewQ.data;
    const actions = actionsQ.data ?? [];
    const top = listQ.data.find((i) => i.priority === 'high' && i.status !== 'dismissed') ?? listQ.data[0];
    return (
      <>
        {!isDemoMode && (
          <Notice tone="demo" title="Demonstration synthesis below">
            The KPI tiles, executive synthesis and insights without an “AI-generated” badge are the seeded demonstration output stored in the database — no
            model produced them and their figures are not live analysis. Insights generated from your data carry an “AI-generated · model” badge and cite their evidence.
          </Notice>
        )}
        <InsightKpiTiles overview={overview} actions={actions} />
        <ExecutiveSynthesis overview={overview} onRegenerate={startGeneration} topInsightId={top.id} />
        <InsightFilterBar insights={listQ.data} filters={filters} onChange={setFilters} />
        {visible.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No insights match these filters"
            description="Try a different category, priority or keyword."
            action={
              <Button size="sm" onClick={() => setFilters(defaultInsightFilters)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Insights">
            {visible.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </section>
        )}
        <RecommendedActionsTable actions={actions} />
      </>
    );
  };

  return (
    <div className="space-y-6">
      {header}
      {apiExtras}
      {body()}
    </div>
  );
}
