import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import { CampaignStatusBadge, HealthBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { formatNumber } from '@/lib/format';
import type { ReportDetail } from '@/types/reports';

function TableCard({ title, subtitle, aside, section, children }: { title: string; subtitle: string; aside: ReactNode; section: string; children: ReactNode }) {
  return (
    <div className="bg-surface-card rounded-xl border border-border-strong overflow-hidden shadow-xs" data-print-section={section}>
      <div className="px-4 md:px-6 py-4 border-b border-border-strong flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">{title}</h3>
          <p className="font-body-sm text-xs text-text-secondary">{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function CampaignBreakdownTable({ detail }: { detail: ReportDetail }) {
  const navigate = useNavigate();
  const { computed } = detail;
  return (
    <TableCard
      section="campaigns"
      title="Included Campaign Performance Breakdown"
      subtitle={detail.report.scope === 'account' ? 'Campaign contribution within the account totals' : 'Per-campaign figures for the report period'}
      aside={
        <span className="px-2 py-1 rounded bg-surface-card-subtle border border-border-strong font-label-code text-[11px] text-text-secondary font-semibold">
          {computed.campaignRows.length} Campaign{computed.campaignRows.length === 1 ? '' : 's'} Filtered
        </span>
      }
    >
      <TableShell>
        <thead>
          <tr>
            <Th>Campaign Name</Th>
            <Th>Status</Th>
            <Th align="right">Views</Th>
            <Th align="right">Reach</Th>
            <Th align="right">Eng Rate</Th>
            <Th align="right">Leads</Th>
            <Th align="right">CPL</Th>
            <Th align="center">Health</Th>
          </tr>
        </thead>
        <tbody>
          {computed.campaignRows.map((row) => (
            <Tr key={row.campaign.id} onClick={() => navigate(`/campaigns/${row.campaign.id}`)} label={`Open ${row.campaign.name}`}>
              <Td className="font-semibold">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${row.campaign.status === 'active' ? 'bg-status-active' : 'bg-text-tertiary'}`} />
                  <span>{row.campaign.name}</span>
                </div>
                <span className="font-label-code text-[10px] text-text-tertiary pl-4">{row.campaign.code}</span>
              </Td>
              <Td>
                <CampaignStatusBadge status={row.campaign.status} />
              </Td>
              <Td align="right" className="font-semibold">
                {formatNumber(row.views)}
              </Td>
              <Td align="right" className="text-text-secondary">
                {formatNumber(row.reach)}
              </Td>
              <Td align="right" className="font-semibold">
                {row.engagementRate.toFixed(2)}%
              </Td>
              <Td align="right" className="font-bold text-primary">
                {formatNumber(row.leads)}
              </Td>
              <Td align="right" className="font-bold">
                {row.cpl !== null ? `₹${Math.round(row.cpl)}` : '—'}
              </Td>
              <Td align="center">
                <HealthBadge value={row.campaign.health} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
      {computed.campaignsWithoutData.length > 0 && (
        <p className="px-6 py-2 border-t border-border-strong text-body-sm text-text-tertiary">
          Excluded (no data in period): {computed.campaignsWithoutData.map((c) => c.name).join(', ')}
        </p>
      )}
    </TableCard>
  );
}

const typeIcon = { reel: 'movie', carousel: 'view_carousel', post: 'image', story: 'amp_stories' } as const;
const typeLabel = { reel: 'Reel', carousel: 'Carousel', post: 'Post', story: 'Story' } as const;

export function CreativesTable({ detail }: { detail: ReportDetail }) {
  const navigate = useNavigate();
  const { creatives } = detail.computed;
  return (
    <TableCard
      section="creatives"
      title="Top Attributed Creatives & Retention Telemetry"
      subtitle={detail.computed.periodShare === 1 ? "Asset-level performance, watch duration and attributed leads" : "Asset-level lifetime totals for creatives in scope (not prorated to the period)"}
      aside={<span className="font-label-code text-[11px] text-text-tertiary">Sorted by Attributed Leads (Desc)</span>}
    >
      <TableShell>
        <thead>
          <tr>
            <Th>Creative Asset Title</Th>
            <Th>Format &amp; Length</Th>
            <Th align="right">Views</Th>
            <Th align="right">Reach</Th>
            <Th align="right">Avg Watch</Th>
            <Th align="right">Eng Rate</Th>
            <Th align="right">Attributed Leads</Th>
          </tr>
        </thead>
        <tbody>
          {creatives.map(({ content: c, avgWatchSec }, i) => {
            const length = c.durationSec ? `${c.durationSec}s` : c.slides ? `${c.slides}p` : null;
            return (
              <Tr key={c.id} onClick={() => navigate(`/content/${c.id}`)} label={`Open analytics for ${c.title}`}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-11 rounded bg-slate-100 border border-border-strong shrink-0 overflow-hidden relative">
                      <ImageWithFallback src={c.thumbnailUrl} alt={c.thumbnailAlt} className="w-full h-full" />
                      {length && <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] font-bold px-0.5 rounded">{length}</span>}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary text-[13px] hover:underline">{c.title}</div>
                      <div className="font-label-code text-[10px] text-text-tertiary">Published {c.publishedAt}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-text-secondary">
                  <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                    <Icon name={typeIcon[c.type]} className={`text-[14px] ${c.type === 'reel' ? 'text-primary-container' : 'text-tertiary'}`} />
                    {typeLabel[c.type]}
                  </span>
                  <span className="text-text-tertiary"> {c.durationSec ? `(${c.durationSec}s)` : c.slides ? `(${c.slides} slides)` : ''}</span>
                </Td>
                <Td align="right" className="font-semibold">
                  {formatNumber(c.metrics.views)}
                </Td>
                <Td align="right" className="text-text-secondary">
                  {formatNumber(c.metrics.reach)}
                </Td>
                <Td align="right" className="font-semibold">
                  {avgWatchSec !== null ? `${avgWatchSec.toFixed(1)}s (${c.metrics.retention}%)` : '--'}
                </Td>
                <Td align="right" className="font-semibold">
                  {c.metrics.engagementRate.toFixed(2)}%
                </Td>
                <Td align="right">
                  <span className={`px-2 py-0.5 rounded font-bold tnum text-[12px] ${i === 0 ? 'bg-amber-100 text-amber-900' : 'bg-surface-card-subtle text-text-primary'}`}>
                    {formatNumber(c.metrics.leads)} leads
                  </span>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </TableShell>
      {creatives.length === 0 && <p className="px-6 py-4 text-body-sm text-text-secondary">No creatives in this scope.</p>}
    </TableCard>
  );
}
