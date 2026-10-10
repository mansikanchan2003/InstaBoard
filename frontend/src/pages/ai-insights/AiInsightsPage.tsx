import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
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

export default function AiInsightsPage() {
  useDocumentTitle('AI Insights');
  const toast = useToast();
  const overviewQ = useQuery('insights:overview', insightsService.overview);
  const listQ = useQuery('insights:list', insightsService.list);
  const actionsQ = useQuery('insights:actions', insightsService.actions);
  const [filters, setFilters] = useState<InsightFilterState>(defaultInsightFilters);
  const [processing, setProcessing] = useState(false);

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
          <span>Last generated: {overviewQ.data?.generatedAt ?? '—'}</span>
        </div>
        <Button variant="primary" icon="refresh" onClick={() => setProcessing(true)} disabled={processing} className="rounded">
          Regenerate analysis
        </Button>
      </div>
    </div>
  );

  const body = () => {
    if (processing) return <ProcessingAnalysis onComplete={() => regenerate.mutate()} onCancel={() => setProcessing(false)} />;
    if (overviewQ.status === 'loading' || listQ.status === 'loading') return <InsightsSkeleton />;
    if (overviewQ.status === 'error' || listQ.status === 'error') return <InsightsError error={overviewQ.error ?? listQ.error} onRetry={() => (overviewQ.refetch(), listQ.refetch(), actionsQ.refetch())} />;
    if (!overviewQ.data || !listQ.data) return <InsightsEmpty onRun={() => setProcessing(true)} />;

    const overview = overviewQ.data;
    const actions = actionsQ.data ?? [];
    const top = listQ.data.find((i) => i.priority === 'high' && i.status !== 'dismissed') ?? listQ.data[0];
    return (
      <>
        <InsightKpiTiles overview={overview} actions={actions} />
        <ExecutiveSynthesis overview={overview} onRegenerate={() => setProcessing(true)} topInsightId={top.id} />
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
      {body()}
    </div>
  );
}
