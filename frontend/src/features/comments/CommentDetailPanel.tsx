import { modeText } from '@/lib/config';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { InstagramComment } from '@/types/comments';
import type { Campaign, ContentItem, Lead } from '@/types/domain';
import { CommentAvatar, formatReceived, HighlightedText, Pill, statusMeta } from './commentMeta';

export interface DetailPanelProps {
  comment: InstagramComment;
  content: ContentItem | undefined;
  campaign: Campaign | undefined;
  existingLead: Lead | undefined;
  /** Lead created in this session from this comment (shows the success alert). */
  createdLead: Lead | undefined;
  busy: boolean;
  converting: boolean;
  onCopyReply: () => void;
  onMarkResponded: () => void;
  onMarkReviewed: () => void;
  onToggleFlag: () => void;
  onConvert: () => void;
  onDismiss: () => void;
  onOpenLead: (leadId: string) => void;
}

/** Body of "Comment Detail & Lead Conversion" (export Section 4, right column). */
export const CommentDetailBody = forwardRef<HTMLDivElement, DetailPanelProps>(function CommentDetailBody(
  { comment: c, content, campaign, existingLead, busy, onCopyReply, onMarkResponded, onMarkReviewed, onToggleFlag },
  replyRef,
) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-strong">
        <div className="flex items-center gap-3 min-w-0">
          <CommentAvatar comment={c} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-text-primary text-body-md font-body-md truncate">{c.authorName}</span>
              {c.verified && <Icon name="verified" className="text-tertiary text-[16px]" label="Verified" />}
            </div>
            <div className="text-text-secondary text-label-sm font-label-sm">@{c.handle}</div>
            {c.location && <div className="text-label-code font-label-code text-text-tertiary">Location: {c.location}</div>}
          </div>
        </div>
        <span className="text-label-code font-label-code bg-ai-subtle border border-ai-border text-ai-accent px-2 py-0.5 rounded font-bold whitespace-nowrap">
          SCORE: {c.intentScore}/100
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Pill className={statusMeta[c.status].pill}>{statusMeta[c.status].label}</Pill>
        {c.flagged && (
          <Pill className="bg-error-container/40 text-error font-bold">
            <Icon name="flag" filled className="text-[12px]" /> Flagged
          </Pill>
        )}
        {existingLead && (
          <Pill className="bg-ai-subtle border border-ai-border text-ai-accent font-bold">
            <Icon name="contact_page" className="text-[12px]" /> Lead: {existingLead.name}
          </Pill>
        )}
      </div>

      <div className="p-2.5 bg-surface-canvas rounded border border-border-strong flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-text-primary shrink-0 flex items-center justify-center text-primary-container font-bold text-xs uppercase">
          {content?.type ?? 'post'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-label-code font-label-code text-text-tertiary uppercase">Associated {content?.type ?? 'content'}</div>
          <div className="text-label-sm font-label-sm font-bold text-text-primary truncate">{content?.title ?? c.contentId}</div>
          {campaign ? (
            <Link to={`/campaigns/${campaign.id}`} className="text-label-code font-label-code text-text-secondary truncate block hover:underline">
              {campaign.name}
            </Link>
          ) : (
            <div className="text-label-code font-label-code text-text-secondary">Organic content</div>
          )}
        </div>
        <Link to={`/content/${c.contentId}`} className="text-label-code font-label-code text-primary font-bold hover:underline whitespace-nowrap">
          View {content?.type === 'reel' ? 'Reel' : 'Content'} →
        </Link>
      </div>

      <div>
        <span className="block text-label-code font-label-code text-text-secondary uppercase mb-1">Raw User Comment</span>
        <blockquote className="p-3 bg-surface-card border border-border-strong rounded text-body-md font-body-md text-text-primary leading-relaxed">
          "<HighlightedText text={c.text} highlights={c.highlights} markClassName="bg-primary-container/20 font-bold px-1 rounded text-text-primary" />"
        </blockquote>
        <div className="mt-1 flex items-center justify-between gap-2 flex-wrap text-label-code font-label-code text-text-tertiary">
          <span>Received: {formatReceived(c.receivedAt)}</span>
          <span>Language: {c.language}</span>
        </div>
      </div>

      <div className="p-3 rounded bg-ai-subtle border border-ai-border">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-label-sm font-label-sm font-bold text-ai-accent">
            <Icon name="auto_awesome" className="text-[15px]" />
            <span>AI Propensity Analysis</span>
          </div>
          <span className="text-label-code font-label-code text-ai-accent uppercase font-bold">AI-GENERATED ANALYSIS</span>
        </div>
        <p className="text-body-sm font-body-sm text-text-primary leading-snug">{c.ai.summary}</p>
        <div className="mt-2 pt-2 border-t border-ai-border/60 flex items-center justify-between gap-2 flex-wrap text-label-code font-label-code text-ai-accent">
          <span>
            Commercial Intent: <strong>{c.ai.commercialIntent}%</strong>
          </span>
          <span>
            {c.ai.qualifierLabel}: <strong>{c.ai.qualifierValue}</strong>
          </span>
          <span>
            Priority: <strong>{c.ai.priorityTier}</strong>
          </span>
        </div>
      </div>

      <div ref={replyRef} tabIndex={-1} className="outline-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-label-code font-label-code text-text-secondary uppercase font-semibold">AI Suggested Response</span>
          <span className="text-label-code font-label-code bg-ai-subtle text-ai-accent px-1.5 py-0.5 rounded font-bold">AI-SUGGESTED</span>
        </div>
        {c.suggestedReply ? (
          <>
            <div className="p-3 bg-surface-canvas border border-border-strong rounded text-body-sm font-body-sm text-text-primary leading-relaxed">"{c.suggestedReply}"</div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onCopyReply}
                className="flex-1 py-1.5 px-2 bg-surface-card border border-border-strong text-text-primary hover:bg-surface-canvas rounded text-label-sm font-label-sm font-semibold flex items-center justify-center gap-1"
              >
                <Icon name="content_copy" className="text-[14px]" />
                <span>Copy Response</span>
              </button>
              <button
                type="button"
                onClick={onMarkResponded}
                disabled={busy || c.status === 'responded'}
                className="flex-1 py-1.5 px-2 bg-surface-card border border-border-strong text-text-primary hover:bg-surface-canvas rounded text-label-sm font-label-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Icon name="check" className="text-[14px]" />
                <span>{c.status === 'responded' ? 'Responded' : 'Mark as Responded'}</span>
              </button>
            </div>
            <p className="mt-1.5 text-label-code font-label-code text-text-tertiary flex items-start gap-1">
              <Icon name="science" className="text-[12px]" />
              Replies are not posted to Instagram from this prototype — copy the response and reply in the Instagram app.
            </p>
          </>
        ) : (
          <div className="p-3 bg-surface-canvas border border-border-strong rounded text-body-sm text-text-secondary">No reply suggested — classified as spam / off-topic.</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMarkReviewed}
          disabled={busy || c.status === 'reviewed'}
          className="flex-1 py-1.5 px-2 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas text-label-sm font-label-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Icon name="done_all" className="text-[14px]" /> {c.status === 'reviewed' ? 'Reviewed' : 'Mark Reviewed'}
        </button>
        <button
          type="button"
          onClick={onToggleFlag}
          disabled={busy}
          aria-pressed={c.flagged}
          className={cn(
            'flex-1 py-1.5 px-2 rounded border text-label-sm font-label-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50',
            c.flagged ? 'border-error/30 bg-error-container/30 text-error' : 'border-border-strong bg-surface-card hover:bg-surface-canvas',
          )}
        >
          <Icon name="flag" filled={c.flagged} className="text-[14px]" /> {c.flagged ? 'Flagged' : 'Flag'}
        </button>
      </div>
    </div>
  );
});

/** Footer: lead conversion CTA + dismiss / pipeline links. */
export function CommentDetailFooter({ comment: c, existingLead, createdLead, converting, onConvert, onDismiss, onOpenLead }: DetailPanelProps) {
  const linkedLeadId = createdLead?.id ?? c.leadId ?? existingLead?.id;
  return (
    <div className="space-y-2 w-full">
      {createdLead && (
        <div className="p-2 rounded bg-status-active-subtle border border-status-active/30 text-status-active text-label-sm font-label-sm font-bold flex items-center gap-1.5 flex-wrap" role="status">
          <Icon name="task_alt" className="text-[16px]" />
          <span>Lead created for {createdLead.name}{modeText(' (demo, local only)', '')}.</span>
          <button type="button" onClick={() => onOpenLead(createdLead.id)} className="underline">
            Open lead →
          </button>
        </div>
      )}
      {linkedLeadId ? (
        <button
          type="button"
          onClick={() => onOpenLead(linkedLeadId)}
          className="w-full py-2.5 px-4 rounded bg-status-active text-white font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm hover:opacity-90"
        >
          <Icon name="contact_page" />
          <span>{createdLead || c.leadId ? 'Open Lead in Pipeline' : 'Already a Lead — Open'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onConvert}
          disabled={converting}
          className="w-full py-2.5 px-4 rounded bg-primary-container hover:bg-brand-primary-hover text-on-primary-container font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
        >
          <Icon name={converting ? 'progress_activity' : 'star'} filled={!converting} className={converting ? 'animate-spin' : undefined} />
          <span>{converting ? 'Creating lead…' : 'Convert to Lead'}</span>
        </button>
      )}
      {existingLead && !createdLead && !c.leadId && (
        <p className="text-label-code font-label-code text-text-tertiary text-center">@{c.handle} already exists in the Leads pipeline — opening it avoids a duplicate.</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onDismiss} disabled={c.status === 'archived'} className="text-label-sm font-label-sm text-text-secondary hover:text-text-primary disabled:opacity-50">
          {c.status === 'archived' ? 'Comment archived' : 'Dismiss Comment'}
        </button>
        <Link to="/leads" className="text-label-sm font-label-sm text-primary font-bold hover:underline">
          View in Leads Pipeline →
        </Link>
      </div>
    </div>
  );
}

/** Inline right-column panel (xl+). On smaller screens the page renders the same body in a Drawer. */
export const CommentDetailPanel = forwardRef<HTMLDivElement, DetailPanelProps>(function CommentDetailPanel(props, replyRef) {
  return (
    <div className="hidden xl:flex xl:col-span-4 bg-surface-card border border-border-strong rounded flex-col justify-between shadow-xs min-w-0" aria-label="Comment detail">
      <div>
        <div className="p-3.5 border-b border-border-strong flex items-center justify-between gap-2 bg-surface-bright">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
            <h3 className="text-headline-sm font-headline-sm text-text-primary">Comment Detail &amp; Lead Conversion</h3>
          </div>
          <span className="text-label-code font-label-code text-text-tertiary whitespace-nowrap">ID {props.comment.ref}</span>
        </div>
        <div className="p-4">
          <CommentDetailBody ref={replyRef} {...props} />
        </div>
      </div>
      <div className="p-3.5 border-t border-border-strong bg-surface-bright">
        <CommentDetailFooter {...props} />
      </div>
    </div>
  );
});
