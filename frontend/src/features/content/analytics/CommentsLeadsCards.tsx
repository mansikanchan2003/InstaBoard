import { modeText } from '@/lib/config';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { cn, formatNumber, formatPercent } from '@/lib/format';
import { leadService } from '@/services/leads';
import type { ClassifiedComment } from '@/types/content';
import { ratio } from '../contentMeta';
import type { AnalyticsPageData } from './model';
import { SectionCard, UnavailableSection } from './SectionCard';

function CommentRow({ comment, data, leadId, onLead }: { comment: ClassifiedComment; data: AnalyticsPageData; leadId?: string; onLead: (id: string) => void }) {
  const toast = useToast();
  const { mutate, isPending } = useMutation(leadService.createFromComment, {
    invalidate: ['leads'],
    onSuccess: ({ lead, created }) => {
      onLead(lead.id);
      toast({
        title: created ? 'Lead added to pipeline' : 'Already in the pipeline',
        description: created ? `@${comment.handle} was added to Leads${modeText(' (local demo store only — no CRM sync)', ' (InstaBoard database — no CRM sync)')}.` : `@${comment.handle} is already tracked as a lead.`,
      });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not create lead', description: e.message }),
  });

  const assign = () =>
    mutate({
      name: comment.name,
      handle: comment.handle,
      location: comment.location,
      campaignId: data.item.campaignId ?? 'sbi-csp-october',
      contentId: data.item.id,
      score: comment.score,
      source: 'comment',
      firstMessage: comment.text,
    });

  return (
    <div className="p-3 bg-surface-canvas rounded-lg border border-border-strong hover:border-slate-400 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-label-code font-label-code font-bold">{comment.handle[0].toUpperCase()}</div>
          <span className="text-label-md font-label-md font-semibold text-text-primary">@{comment.handle}</span>
          <span className="text-label-code font-label-code text-text-tertiary">{comment.ago}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-ai-subtle border border-ai-border text-ai-accent text-label-code font-label-code font-bold">{comment.classification}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-label-code font-label-code font-bold',
              comment.score >= 85 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-300 text-slate-700',
            )}
          >
            Score: {comment.score}/100
          </span>
        </div>
      </div>
      <p className="text-body-md font-body-md text-text-primary mb-2 font-medium">"{comment.text}"</p>
      <div className="flex flex-wrap items-center gap-2 text-label-sm font-label-sm">
        <span className="px-2 py-0.5 bg-emerald-100/60 text-emerald-800 rounded font-semibold text-[11px]">Sentiment: {comment.sentiment}</span>
        <span className="px-2 py-0.5 bg-blue-100/60 text-blue-800 rounded font-semibold text-[11px]">Intent: {comment.intent}</span>
        <span className="px-2 py-0.5 bg-amber-100/60 text-amber-900 rounded font-bold text-[11px]">Lead Potential: {comment.potential}</span>
        {leadId ? (
          <Link to={`/leads?lead=${leadId}`} className="ml-auto text-primary hover:underline font-bold text-label-sm font-label-sm">
            View lead →
          </Link>
        ) : (
          <button type="button" onClick={assign} disabled={isPending} className="ml-auto text-primary hover:underline font-bold text-label-sm font-label-sm disabled:opacity-50">
            {isPending ? 'Assigning…' : 'Assign to CRM →'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Classified comment samples with "Assign to CRM" → creates a lead in the local demo store. */
export function CommentStreamCard({ data }: { data: AnalyticsPageData }) {
  const comments = data.analytics?.comments;
  const [leadIds, setLeadIds] = useState<Record<string, string>>({});
  if (!comments) return <UnavailableSection title="Comment Stream Intelligence" className="col-span-12 lg:col-span-7" />;
  const total = formatNumber(data.item.metrics.comments);

  return (
    <SectionCard
      className="col-span-12 lg:col-span-7"
      title="Comment Stream Intelligence"
      addon={<span className="text-label-code font-label-code bg-ai-subtle text-ai-accent border border-ai-border px-2 py-0.5 rounded font-bold">NLP SCORING</span>}
      subtitle={`Classified lead inquiries sampled from ${total} public comments.`}
      right={
        <Link to="/comments" className="inline-flex items-center gap-1 text-label-md font-label-md font-semibold text-primary hover:underline">
          <span>View All Comments ({total})</span>
          <Icon name="arrow_forward" className="text-[14px]" />
        </Link>
      }
    >
      <div className="space-y-3">
        {comments.map((c) => (
          <CommentRow key={c.id} comment={c} data={data} leadId={leadIds[c.id] ?? c.leadId} onLead={(id) => setLeadIds((p) => ({ ...p, [c.id]: id }))} />
        ))}
      </div>
    </SectionCard>
  );
}

/** Lead origin channels + attribution funnel (views → engaged → comments → leads). */
export function LeadAttributionCard({ data }: { data: AnalyticsPageData }) {
  const la = data.analytics?.leadAttribution;
  if (!la) return <UnavailableSection title="Lead Attribution Funnel" className="col-span-12 lg:col-span-5" />;
  const m = data.item.metrics;
  const stages = [
    { label: '1. Total Views', value: `${formatNumber(m.views)} (100%)`, box: 'bg-slate-100 border-border-strong', bar: 'bg-slate-200 opacity-40', width: '100%', text: 'text-text-primary' },
    {
      label: `2. ${la.engagedThresholdLabel}`,
      value: `${formatNumber(la.engagedViewers)} (${formatPercent(ratio(la.engagedViewers, m.views), 1)})`,
      box: 'bg-slate-100 border-border-strong',
      bar: 'bg-slate-300 opacity-40',
      width: '55%',
      text: 'text-text-primary',
    },
    {
      label: '3. Interested Inquiries (comments)',
      value: `${formatNumber(m.comments)} (${formatPercent(ratio(m.comments, m.views))})`,
      box: 'bg-amber-50 border-amber-200',
      bar: 'bg-amber-200 opacity-50',
      width: '35%',
      text: 'text-primary',
    },
    { label: '4. Converted Lead Pipeline', value: `${formatNumber(m.leads)} Qualified Leads`, box: 'bg-emerald-50 border-emerald-300', bar: 'bg-emerald-200 opacity-60', width: '20%', text: 'text-emerald-800' },
  ];

  return (
    <SectionCard
      className="col-span-12 lg:col-span-5 flex flex-col justify-between"
      title="Lead Attribution Funnel"
      subtitle="End-to-End Campaign Ingestion"
      right={
        <div className="text-right">
          <div className="text-headline-sm font-headline-sm font-bold text-primary tnum">{formatNumber(m.leads)} Verified</div>
          <div className="text-label-code font-label-code text-emerald-700 font-semibold">{formatPercent(ratio(m.leads, m.comments), 1)} Inquiry Conversion</div>
        </div>
      }
    >
      <div className="mb-4">
        <div className="text-label-sm font-label-sm font-semibold text-text-primary mb-2">Lead Origin Channels</div>
        <div className="space-y-2">
          {la.channels.map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-2 p-2 rounded bg-surface-canvas border border-border-strong">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', c.dotClassName)} />
                <span className="text-label-sm font-label-sm text-text-primary font-medium truncate">{c.label}</span>
              </div>
              <div className="text-label-sm font-label-sm font-bold text-text-primary tnum whitespace-nowrap">
                {c.leads} leads ({Math.round(ratio(c.leads, m.leads))}%)
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-label-sm font-label-sm font-semibold text-text-primary mb-2">Attribution Drop Funnel</div>
        <div className="space-y-1.5">
          {stages.map((s) => (
            <div key={s.label} className={cn('relative rounded p-2 text-label-sm font-label-sm flex justify-between items-center gap-2 overflow-hidden border', s.box)}>
              <div className={cn('absolute inset-y-0 left-0', s.bar)} style={{ width: s.width }} />
              <span className="relative z-10 font-medium text-text-primary">{s.label}</span>
              <span className={cn('relative z-10 font-bold tnum text-right', s.text)}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border-strong flex flex-wrap items-center justify-between gap-2">
        <span className="text-label-sm font-label-sm text-text-secondary">CRM sync (HubSpot / Eko CRM) needs the backend</span>
        <span className="text-label-code font-label-code text-text-secondary bg-surface-card-subtle border border-border-strong px-2 py-0.5 rounded font-bold">Not connected (demo)</span>
      </div>
    </SectionCard>
  );
}
