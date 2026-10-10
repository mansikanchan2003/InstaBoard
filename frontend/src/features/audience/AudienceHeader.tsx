import { Link } from 'react-router-dom';
import { DemoBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { exportAudienceReport } from './exportAudienceReport';
import type { AudiencePageData } from './model';

const btn =
  'px-3 py-1.5 bg-surface-card border border-border-strong hover:bg-surface-canvas text-text-primary font-label-md text-label-md font-semibold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** Title, honest demo labelling (replaces "LIVE ATTRIBUTION") and page actions. */
export function AudienceHeader({ data }: { data: AudiencePageData | undefined }) {
  const toast = useToast();
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-headline-lg text-headline-lg text-text-primary font-bold">Audience Intelligence</h1>
          <DemoBadge label="Demo attribution" />
        </div>
        <p className="font-body-md text-body-md text-text-secondary mt-1">
          Understand who is engaging with your Instagram content and how your audience composition is changing.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          className={btn}
          disabled={!data}
          onClick={() => {
            if (!data) return;
            exportAudienceReport(data);
            toast({ tone: 'demo', title: 'Audience report downloaded', description: 'CSV generated in your browser from the demo dataset.' });
          }}
        >
          <Icon name="file_download" className="text-[16px]" />
          <span>Export Audience Report</span>
        </button>
        <Link to="/campaigns" className={btn}>
          <span>View Campaigns</span>
          <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
        <Link to="/leads" className={btn}>
          <span>View Leads</span>
          <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      </div>
    </div>
  );
}
