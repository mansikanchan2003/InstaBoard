import { AiInsightBody } from '@/features/ai/AiInsightBody';
import { modeText } from '@/lib/config';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { NotFoundError } from '@/lib/api/source';
import { campaignService } from '@/services/campaigns';
import { commentsService } from '@/services/comments';
import { contentService } from '@/services/content';
import { insightsService } from '@/services/insights';
import { leadService } from '@/services/leads';
import type { InsightStatus } from '@/types/insights';
import { InsightDetailHeader } from '@/features/ai-insights/InsightDetailHeader';
import { ActionPlanSection, MissingEvidence, ReasoningSection, TelemetrySection } from '@/features/ai-insights/InsightEvidence';
import { RichText } from '@/features/ai-insights/insightMeta';
import { ArtifactsCard, AuditCard, CommentEvidenceCard } from '@/features/ai-insights/InsightSidebar';
import { printInsightBrief } from '@/features/ai-insights/printBrief';

function DetailSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading insight">
      <Skeleton className="h-5 w-80" />
      <Skeleton className="h-48" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-56" />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}

export default function AiInsightDetailPage() {
  const { insightId = '' } = useParams();
  const toast = useToast();

  const insightQ = useQuery(`insights:detail:${insightId}`, () => insightsService.get(insightId));
  const overviewQ = useQuery('insights:overview', insightsService.overview);
  const contentQ = useQuery('content:list', contentService.list);
  const campaignsQ = useQuery('campaigns:list', campaignService.list);
  const commentsQ = useQuery('comments:list', commentsService.list);
  const funnelCampaignId = insightQ.data?.detail?.artifacts?.funnelCampaignId;
  const funnelQ = useQuery(`leads:funnel:${funnelCampaignId ?? 'none'}`, () => leadService.campaignFunnel(funnelCampaignId ?? ''), { enabled: !!funnelCampaignId });

  useDocumentTitle(insightQ.data?.title ?? 'AI Insight');

  const setStatus = useMutation((status: InsightStatus) => insightsService.setStatus(insightId, status), { invalidate: ['insights'] });
  const toggleStep = useMutation((stepId: string) => insightsService.toggleStep(insightId, stepId), { invalidate: ['insights'] });

  const contentById = useMemo(() => new Map((contentQ.data ?? []).map((c) => [c.id, c])), [contentQ.data]);

  if (insightQ.status === 'loading') return <DetailSkeleton />;
  if (insightQ.status === 'error') {
    if (insightQ.error instanceof NotFoundError) {
      return (
        <EmptyState
          icon="search_off"
          title="Insight not found"
          description={`No AI insight with id "${insightId}" exists in this workspace. It may have been removed or the link is incorrect.`}
          action={
            <LinkButton to="/ai-insights" variant="primary" icon="arrow_back">
              Back to AI Insights
            </LinkButton>
          }
        />
      );
    }
    return <ErrorState title="Unable to load insight" error={insightQ.error} onRetry={insightQ.refetch} />;
  }
  if (!insightQ.data) {
    return (
      <EmptyState
        icon="auto_awesome"
        title="No insight data"
        description="This insight has no evidence for the selected period."
        action={<LinkButton to="/ai-insights">Back to AI Insights</LinkButton>}
      />
    );
  }

  const insight = insightQ.data;
  const detail = insight.detail;
  const disclaimer =
    overviewQ.data?.disclaimer ?? 'AI does not autonomously modify active Instagram campaigns or ad spend. All deployment actions require human operator confirmation.';
  const artifacts = detail?.artifacts;
  const campaign = campaignsQ.data?.find((c) => c.id === artifacts?.campaignId);
  const primary = artifacts?.primaryContentId ? contentById.get(artifacts.primaryContentId) : undefined;
  const comparison = artifacts?.comparisonContentId ? contentById.get(artifacts.comparisonContentId) : undefined;
  const evidence = (detail?.evidenceCommentIds ?? []).map((id) => commentsQ.data?.items.find((c) => c.id === id)).filter((c) => c !== undefined);

  const changeStatus = async (status: InsightStatus) => {
    const res = await setStatus.mutate(status);
    if (!res) return;
    const copy: Record<InsightStatus, { title: string; description?: string }> = {
      reviewed: { title: 'Insight marked as reviewed', description: modeText('Status updated on the AI Insights overview (local demo store).', 'Status saved; the AI Insights overview reflects it.') },
      dismissed: { title: 'Insight dismissed', description: 'Hidden from the AI Insights feed. You can restore it from this page.' },
      new: { title: 'Insight restored', description: 'Back in the AI Insights feed as pending review.' },
      saved: { title: 'Insight saved', description: 'Kept in the feed for later review.' },
      completed: { title: 'Marked as completed', description: 'Recorded that a person carried out the suggested action.' },
    };
    toast({ tone: 'success', ...copy[status] });
  };

  const exportBrief = () => {
    const opened = printInsightBrief(insight, disclaimer);
    toast(
      opened
        ? { tone: 'demo', title: 'Printable brief opened', description: 'Choose "Save as PDF" in the print dialog. Server-generated PDF briefs need the backend.' }
        : { tone: 'warning', title: 'Pop-up blocked', description: 'Allow pop-ups for this site to open the printable brief.' },
    );
  };

  return (
    <div className="space-y-5">
      <InsightDetailHeader
        insight={insight}
        disclaimer={disclaimer}
        busy={setStatus.isPending}
        onExport={exportBrief}
        onDismiss={() => changeStatus('dismissed')}
        onRestore={() => changeStatus('new')}
        onToggleReviewed={() => changeStatus(insight.status === 'reviewed' ? 'new' : 'reviewed')}
      />

      {insight.ai ? (
        <AiInsightBody insight={insight} onStatus={(st) => void changeStatus(st)} busy={setStatus.isPending} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {detail?.telemetry ? (
            <TelemetrySection telemetry={detail.telemetry} />
          ) : (
            <MissingEvidence title="1. Observed Performance Telemetry">
              <p className="mt-0.5">
                Summary from the insight card: <RichText text={insight.observed} />
              </p>
            </MissingEvidence>
          )}
          {detail?.reasoning ? (
            <ReasoningSection reasoning={detail.reasoning} />
          ) : (
            <MissingEvidence title="2. AI Reasoning & Diagnostic Breakdown">
              <p className="mt-0.5">AI interpretation: {insight.interpretation}</p>
            </MissingEvidence>
          )}
          {detail?.steps?.length ? (
            <ActionPlanSection insight={insight} busy={toggleStep.isPending} onToggleStep={(id) => toggleStep.mutate(id)} />
          ) : (
            <MissingEvidence title="3. Evidence-Based Next Best Actions (Recommended Plan)">
              <p className="mt-0.5">
                {insight.impact.text}{' '}
                <LinkButton to={insight.primaryLink.to} size="xs" className="ml-1 align-middle" iconRight="arrow_forward">
                  {insight.primaryLink.label}
                </LinkButton>
              </p>
            </MissingEvidence>
          )}
        </div>
        <div className="lg:col-span-4 space-y-6 min-w-0">
          <ArtifactsCard insight={insight} campaign={campaign} primary={primary} comparison={comparison} funnel={funnelCampaignId ? funnelQ.data?.funnel : undefined} />
          <CommentEvidenceCard comments={evidence} contentTitle={(id) => contentById.get(id)?.title ?? id} />
          <AuditCard insight={insight} />
        </div>
      </div>
      )}
    </div>
  );
}
