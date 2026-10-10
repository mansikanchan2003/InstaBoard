import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cn, formatNumber } from '@/lib/format';
import type { CampaignCommentSnapshot, CommentIntentTone } from '@/types/campaigns';
import type { Campaign } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

const intentTone: Record<CommentIntentTone, string> = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  neutral: 'bg-surface-card-subtle border-border-strong text-text-secondary',
};

const noteTone = { primary: 'text-primary font-semibold', secondary: 'text-text-secondary font-medium', tertiary: 'text-text-tertiary' } as const;

/** Export: "COMMENTS SNAPSHOT & INTENT AI". Totals come from campaign metrics; items from campaignDetail data. */
export function CommentsSnapshot({ campaign, snapshot }: { campaign: Campaign; snapshot: CampaignCommentSnapshot | undefined }) {
  const toast = useToast();
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const m = campaign.metrics;
  const items = snapshot?.items.filter((i) => !archived.has(i.id)) ?? [];

  const archive = (id: string, handle: string) => {
    setArchived((prev) => new Set(prev).add(id));
    toast({ tone: 'demo', title: `Comment from @${handle} archived`, description: 'Hidden in this view only — nothing was liked or changed on Instagram.' });
  };

  return (
    <SectionCard icon="chat_bubble" title="Comments Snapshot & Intent AI" link={{ to: '/comments', label: 'View All Comments' }}>
      {!m ? (
        <UnavailableNote icon="chat_bubble">Metrics will appear after the campaign starts.</UnavailableNote>
      ) : (
        <>
          <div className="py-4 border-b border-border-strong flex flex-wrap items-center justify-between gap-4">
            <span className="font-headline-sm text-headline-sm font-bold text-text-primary tnum">
              {formatNumber(m.comments)} <span className="text-text-secondary font-normal font-body-sm text-body-sm">Total Comments</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {snapshot && (
                <>
                  <span className="px-2.5 py-1 rounded bg-status-active-subtle border border-emerald-200 text-emerald-800 font-label-sm text-label-sm font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
                    Positive: {snapshot.sentiment.positive}%
                  </span>
                  <span className="px-2.5 py-1 rounded bg-surface-card-subtle border border-border-strong text-text-secondary font-label-sm text-label-sm font-semibold">
                    Neutral: {snapshot.sentiment.neutral}%
                  </span>
                  <span className="px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 font-label-sm text-label-sm font-semibold">Negative: {snapshot.sentiment.negative}%</span>
                </>
              )}
              <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 font-label-sm text-label-sm font-bold tnum">Potential Leads: {m.leads}</span>
            </div>
          </div>
          {!snapshot ? (
            <UnavailableNote>Sentiment and intent breakdown for this campaign is not available in the demo dataset.</UnavailableNote>
          ) : items.length === 0 ? (
            <UnavailableNote icon="inventory_2">All snapshot comments are archived in this view.</UnavailableNote>
          ) : (
            <div className="pt-4 flex flex-col gap-3">
              {items.map((c) => (
                <article key={c.id} className="p-3 bg-surface-canvas rounded border border-border-strong flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-label-md text-label-md font-bold text-text-primary">@{c.handle}</span>
                      <span className="font-label-sm text-label-sm text-text-tertiary">
                        {c.ago} ·{' '}
                        {c.contentId ? (
                          <Link to={`/content/${c.contentId}`} className="hover:text-text-primary hover:underline">
                            {c.contentRef}
                          </Link>
                        ) : (
                          c.contentRef
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.aiInferred && (
                        <span className="px-2 py-0.5 rounded-full bg-ai-subtle border border-ai-border text-ai-accent font-label-code text-label-code uppercase tracking-wider flex items-center gap-1">
                          <Icon name="auto_awesome" className="text-[11px]" />
                          AI-Inferred
                        </span>
                      )}
                      <span className={cn('px-2 py-0.5 rounded-full border font-label-code text-label-code font-bold', intentTone[c.intentTone])}>{c.intentLabel}</span>
                    </div>
                  </div>
                  <p className="font-body-md text-body-md text-text-primary">&ldquo;{c.text}&rdquo;</p>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle text-xs">
                    <span className={noteTone[c.noteTone]}>{c.note}</span>
                    {c.action === 'reply' ? (
                      <Link to="/comments" className="font-label-sm text-label-sm text-text-primary hover:text-primary font-semibold">
                        Reply &amp; Convert →
                      </Link>
                    ) : (
                      <button type="button" onClick={() => archive(c.id, c.handle)} className="font-label-sm text-label-sm text-text-secondary hover:text-text-primary font-semibold">
                        Like &amp; Archive
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
