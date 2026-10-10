import { Link } from 'react-router-dom';
import { Badge, CampaignStatusBadge } from '@/components/ui/Badge';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/format';
import { downloadCsv } from '../csv';
import { contentTypeMeta, formatDuration, isVideo } from '../contentMeta';
import { metricsCsvRows, type AnalyticsPageData } from './model';

const actionCls =
  'px-3 py-1.5 bg-surface-card hover:bg-surface-canvas text-text-primary border border-border-strong rounded-lg text-label-md font-label-md font-semibold flex items-center gap-1.5 transition-colors';

/** Context bar: back link, campaign pill, title + status/duration, and page actions. */
export function ReelHeader({ data }: { data: AnalyticsPageData }) {
  const { item, campaign, analytics } = data;
  const toast = useToast();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied', description: 'The link to this analytics page is on your clipboard.' });
    } catch {
      toast({ tone: 'warning', title: 'Could not copy link', description: window.location.href });
    }
  };

  const downloadMetrics = () => {
    downloadCsv(`${item.id}-metrics-demo.csv`, metricsCsvRows(data));
    toast({ tone: 'demo', title: 'Metrics CSV downloaded', description: 'Generated in your browser from the demo dataset.' });
  };

  const formatPill = isVideo(item)
    ? { icon: 'timer', label: `${formatDuration(item.durationSec)}s` }
    : item.type === 'carousel'
      ? { icon: 'photo_library', label: `${item.slides ?? 0} slides` }
      : { icon: 'image', label: 'Single image' };

  return (
    <section className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-strong pb-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-1.5">
          <Link to="/content" className="inline-flex items-center gap-1 text-label-md font-label-md font-medium text-text-secondary hover:text-primary transition-colors">
            <Icon name="arrow_back" className="text-[14px]" />
            <span>Back to Content</span>
          </Link>
          {campaign && (
            <>
              <span className="text-text-tertiary">•</span>
              <Link
                to={`/campaigns/${campaign.id}`}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-low border border-border-strong text-text-primary text-label-sm font-label-sm font-semibold hover:border-primary-container transition-all"
              >
                <span>
                  Associated Campaign: <strong>{campaign.name.replace(/ Campaign$/, '')}</strong>
                </span>
                <Icon name="arrow_forward" className="text-[12px]" />
              </Link>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline-md md:text-headline-lg font-headline-lg text-text-primary">{item.title}</h1>
          {campaign ? <CampaignStatusBadge status={campaign.status} /> : <Badge tone="neutral">Organic</Badge>}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-card-subtle border border-border-strong text-text-secondary text-label-sm font-label-sm">
            <Icon name={formatPill.icon} className="text-[12px]" />
            {formatPill.label}
          </span>
          <span className="text-label-sm font-label-sm text-text-secondary">
            {contentTypeMeta[item.type].label}
            {analytics?.resolution ? ` • ${analytics.resolution}` : ''} • Published {formatDate(item.publishedAt)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {campaign && (
          <Link to={`/campaigns/${campaign.id}`} className={actionCls}>
            <Icon name="share" className="text-[14px]" />
            <span>View Campaign</span>
          </Link>
        )}
        <button
          type="button"
          className={actionCls}
          onClick={() =>
            toast({
              tone: 'demo',
              title: 'No Instagram permalink',
              description: 'Demo content is not linked to a real Instagram post. Connected accounts would open the original media here.',
            })
          }
        >
          <Icon name="open_in_new" className="text-[14px]" />
          <span>Open on Instagram</span>
        </button>
        <Dropdown
          label="More options"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label="More options"
              title="More Options"
              className="p-1.5 bg-surface-card hover:bg-surface-canvas text-text-secondary border border-border-strong rounded-lg transition-colors"
            >
              <Icon name="more_vert" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon="link"
                onClick={() => {
                  close();
                  void copyLink();
                }}
              >
                Copy link to this page
              </MenuItem>
              <MenuItem
                icon="file_download"
                onClick={() => {
                  close();
                  downloadMetrics();
                }}
              >
                Download metrics CSV
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>
    </section>
  );
}
