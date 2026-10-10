import { Link } from 'react-router-dom';
import { TableShell } from '@/components/tables/DataTable';
import { Icon } from '@/components/ui/Icon';
import { formatCompact, formatNumber, formatPercent } from '@/lib/format';
import type { FollowerSplitRow } from '@/types/audience';
import type { AudiencePageData } from './model';

function fmt(row: FollowerSplitRow, v: number) {
  if (row.metric === 'engagementRate') return formatPercent(v);
  if (row.metric === 'leads') return `${v} leads`;
  if (row.metric === 'views') return formatCompact(v);
  return formatNumber(v);
}

/** Follower vs non-follower split bar, discovery callout and comparison table. */
export function FollowerSplitSection({ data }: { data: AudiencePageData }) {
  const { intel, summary, overview } = data;
  const nonPct = summary.nonFollowerReachPct;
  const folPct = 100 - nonPct;
  const reachRow = intel.followerSplit.find((r) => r.metric === 'reach');

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-strong mb-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Follower vs Non-Follower Discovery &amp; Attribution</h3>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Attribution breakdown of total audience touched by Instagram Reels, Carousels, and Stories</p>
        </div>
        <span className="px-2.5 py-1 bg-surface-canvas border border-border-strong rounded font-label-sm text-label-sm text-text-secondary">Aggregate Oct 01 - Oct 31</span>
      </div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold mb-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-slate-700" />
            <span className="text-text-primary">
              Followers ({folPct}% • {formatCompact(reachRow?.followers)} Reach)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold">
              Non-Followers ({nonPct}% • {formatCompact(reachRow?.nonFollowers)} Reach)
            </span>
            <span className="w-3 h-3 rounded-sm bg-primary-container" />
          </div>
        </div>
        <div className="w-full h-3 bg-surface-card-subtle rounded-full overflow-hidden flex border border-border-strong">
          <div className="h-full bg-slate-700" style={{ width: `${folPct}%` }} />
          <div className="h-full bg-primary-container" style={{ width: `${nonPct}%` }} />
        </div>
      </div>
      <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-md mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Icon name="tips_and_updates" className="text-primary text-[20px] shrink-0" />
          <p className="font-body-sm text-body-sm text-text-primary">
            <strong className="font-semibold text-primary">Discovery Driver:</strong> Non-followers represent <strong>{nonPct}% of total reach</strong> and{' '}
            <strong>{intel.discoveryNote.nonFollowerInquiryPct}% of new inquiries</strong> via Reels viral distribution algorithm.
          </p>
        </div>
        <Link to="/content/sbi-csp-mitra-reel" className="font-label-sm text-label-sm text-primary font-semibold hover:underline flex items-center gap-0.5 flex-shrink-0">
          View Reel breakdown <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>
      <TableShell>
        <thead>
          <tr className="bg-surface-canvas text-text-secondary text-[11px] font-semibold uppercase tracking-wider border-y border-border-strong">
            <th className="py-2.5 px-3 text-left">Metric</th>
            <th className="py-2.5 px-3 text-right">Followers ({folPct}%)</th>
            <th className="py-2.5 px-3 text-right">Non-Followers ({nonPct}%)</th>
            <th className="py-2.5 px-3 text-right">Total Aggregate</th>
            <th className="py-2.5 px-3 text-left">Strategic Attribution Context</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-strong font-body-sm text-body-sm">
          {intel.followerSplit.map((r) => {
            const followersWin = r.followers > r.nonFollowers;
            return (
              <tr key={r.metric} className="hover:bg-surface-canvas">
                <td className="py-2.5 px-3 font-medium text-text-primary">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Icon name={r.icon} className="text-[16px] text-text-tertiary" />
                    {r.label}
                  </span>
                </td>
                <td className={`py-2.5 px-3 text-right tnum ${followersWin ? 'font-bold text-status-active' : 'font-semibold text-text-secondary'}`}>{fmt(r, r.followers)}</td>
                <td className={`py-2.5 px-3 text-right tnum ${followersWin ? 'font-semibold text-text-secondary' : 'font-bold text-primary'}`}>{fmt(r, r.nonFollowers)}</td>
                <td className="py-2.5 px-3 text-right tnum font-bold text-text-primary">{fmt(r, r.total)}</td>
                <td className="py-2.5 px-3 text-text-secondary min-w-[260px]">{r.context}</td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      <p className="text-[11px] text-text-tertiary mt-2">
        Attributed leads = {intel.attributedLeads} of {formatNumber(overview.leads.value)} period leads that carry audience attributes in the demo dataset.
      </p>
    </section>
  );
}
