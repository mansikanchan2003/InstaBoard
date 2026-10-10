import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';

const guideItems: Array<{ icon: string; term: string; body: string }> = [
  { icon: 'visibility', term: 'Views', body: 'Total times a post, Reel, carousel or story was displayed, including repeat views by the same account.' },
  { icon: 'group', term: 'Reach', body: 'Unique accounts that saw the content at least once. Reach is always lower than or equal to views.' },
  { icon: 'percent', term: 'Engagement rate', body: 'Likes + comments + shares + saves divided by reach. Above 4.2% beats the September account benchmark.' },
  { icon: 'schedule', term: 'Watch time', body: 'Total hours viewers spent watching video content (Reels and video stories). Images and carousels have no watch time.' },
  { icon: 'timeline', term: 'Retention / completion', body: 'Share of viewers still watching at each second of a Reel. The final value is the completion rate.' },
  { icon: 'badge', term: 'Leads', body: 'Comment, DM and bio-link inquiries that InstaBoard attributed to a specific creative and qualified as CSP prospects.' },
];

/** Page title + "Guide" and "+ Add Content" actions (both open honest modals). */
export function LibraryHeader() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-text-primary font-bold tracking-tight">Content Library</h1>
        <p className="font-body-md text-body-md text-text-secondary mt-0.5">
          Analyze the performance of your Instagram posts, Reels, carousels and stories across active campaigns.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-surface-card border border-border-strong hover:bg-surface-canvas text-text-primary text-label-md font-label-md font-medium transition-colors"
        >
          <Icon name="help_outline" className="text-text-secondary" />
          <span>Guide</span>
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-primary-container hover:bg-brand-primary-hover text-text-primary text-label-md font-label-md font-bold transition-colors shadow-sm"
        >
          <Icon name="add_box" />
          <span>+ Add Content</span>
        </button>
      </div>

      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Content metrics guide"
        subtitle="How the numbers in the Content Library are defined"
        icon="help_outline"
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setGuideOpen(false)}>
            Got it
          </Button>
        }
      >
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {guideItems.map((g) => (
            <div key={g.term} className="p-3 rounded-lg border border-border-strong bg-surface-canvas">
              <dt className="flex items-center gap-1.5 text-label-md font-semibold text-text-primary">
                <Icon name={g.icon} className="text-[16px] text-text-secondary" />
                {g.term}
              </dt>
              <dd className="text-body-sm text-text-secondary mt-1">{g.body}</dd>
            </div>
          ))}
        </dl>
        <Notice tone="demo" className="mt-4" title="Prototype data">
          KPI tiles are account totals for Oct 1–31, 2024 (organic + campaign content). The table lists the individual creatives in the demo dataset.
        </Notice>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add content"
        subtitle="Upload or import Instagram media"
        icon="add_box"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Close
            </Button>
            <LinkButton to="/accounts/connect" variant="primary" icon="link">
              Connect Instagram account
            </LinkButton>
          </>
        }
      >
        <div className="space-y-3 text-body-sm text-text-secondary">
          <p>
            In production, InstaBoard imports posts, Reels, carousels and stories automatically from connected Instagram Business accounts, and can publish new media
            through the Instagram Graph API.
          </p>
          <Notice tone="demo" title="Not available in this prototype">
            Uploading or publishing to Instagram needs the InstaBoard backend and a Meta authorization, neither of which is connected here. Nothing will be uploaded
            or posted.
          </Notice>
          <p>
            You can review the connection flow on the{' '}
            <Link to="/accounts" className="text-primary font-semibold hover:underline">
              Instagram Accounts
            </Link>{' '}
            page.
          </p>
        </div>
      </Modal>
    </div>
  );
}
