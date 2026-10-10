import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Td, Th, Tr, TableShell } from '@/components/tables/DataTable';
import { Icon } from '@/components/ui/Icon';
import { ImageWithFallback } from '@/components/ui/Misc';
import { cn, formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/format';
import type { ContentItem } from '@/types/domain';
import { captionExcerpt, contentTypeMeta, thumbnailLabel } from '../contentMeta';
import type { LibrarySort, LibrarySortKey } from './filters';

export type MetricColumn = 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagement' | 'leads';

export const metricColumns: Array<{ key: MetricColumn; label: string }> = [
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'engagement', label: 'Eng. Rate' },
  { key: 'leads', label: 'Leads' },
];

const HIGH_ENGAGEMENT = 4.5;
const HIGH_LEADS = 50;

export function TypeBadge({ item }: { item: Pick<ContentItem, 'type'> }) {
  const meta = contentTypeMeta[item.type];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', meta.badge)}>
      <Icon name={meta.icon} className="text-[13px]" /> {meta.label}
    </span>
  );
}

export function LeadsPill({ leads }: { leads: number }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded font-bold font-label-code text-label-sm border tnum whitespace-nowrap',
        leads >= HIGH_LEADS ? 'bg-status-active-subtle text-status-active border-emerald-200' : 'bg-surface-card-subtle text-text-primary border-border-strong',
      )}
    >
      {leads} Leads
    </span>
  );
}

function metricCell(item: ContentItem, key: MetricColumn) {
  const m = item.metrics;
  switch (key) {
    case 'views':
      return <Td align="right" className="font-headline-sm text-label-md font-bold">{formatCompact(m.views)}</Td>;
    case 'engagement':
      return (
        <Td align="right">
          <span className={cn('font-label-md text-label-md font-bold tnum', m.engagementRate >= HIGH_ENGAGEMENT ? 'text-status-active' : 'text-text-primary')}>
            {formatPercent(m.engagementRate)}
          </span>
        </Td>
      );
    case 'leads':
      return (
        <Td align="right">
          <LeadsPill leads={m.leads} />
        </Td>
      );
    default:
      return (
        <Td align="right" className="text-text-secondary">
          {formatCompact(m[key])}
        </Td>
      );
  }
}

export function AssetsTable({
  items,
  columns,
  sort,
  onSort,
  campaignName,
}: {
  items: ContentItem[];
  columns: MetricColumn[];
  sort: LibrarySort;
  onSort: (key: LibrarySortKey) => void;
  campaignName: (id: string | null) => string;
}) {
  const navigate = useNavigate();
  return (
    <TableShell>
      <thead>
        <tr>
          <Th sortKey="title" sort={sort} onSort={onSort} className="min-w-[280px]">
            Content
          </Th>
          <Th sortKey="type" sort={sort} onSort={onSort} className="min-w-[110px]">
            Type
          </Th>
          <Th sortKey="campaign" sort={sort} onSort={onSort} className="min-w-[190px]">
            Campaign
          </Th>
          {metricColumns
            .filter((c) => columns.includes(c.key))
            .map((c) => (
              <Th key={c.key} sortKey={c.key} sort={sort} onSort={onSort} align="right">
                {c.label}
              </Th>
            ))}
          <Th align="center">Action</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <Tr key={item.id} onClick={() => navigate(`/content/${item.id}`)} label={`Open analytics for ${item.title}`}>
            <Td className="px-4">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-14 rounded bg-slate-900 overflow-hidden shrink-0 border border-border-strong flex items-center justify-center">
                  <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white font-label-code text-[9px] px-1 rounded">{thumbnailLabel(item)}</span>
                </div>
                <div className="flex flex-col min-w-0 max-w-[320px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-label-md font-bold text-text-primary truncate">{item.title}</span>
                    {item.isTopPerformer && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 font-label-code text-[9px] px-1.5 rounded-full font-bold flex items-center gap-0.5 shrink-0">
                        <Icon name="star" filled className="text-[10px]" /> TOP
                      </span>
                    )}
                  </div>
                  <span className="text-text-secondary text-[11px] truncate">"{captionExcerpt(item.caption)}"</span>
                  <span className="text-text-tertiary text-[10px] mt-0.5">Published {formatDate(item.publishedAt)}</span>
                </div>
              </div>
            </Td>
            <Td>
              <TypeBadge item={item} />
            </Td>
            <Td>
              {item.campaignId ? (
                <Link
                  to={`/campaigns/${item.campaignId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-label-md text-label-md font-medium text-text-secondary hover:text-text-primary hover:underline"
                >
                  {campaignName(item.campaignId)}
                </Link>
              ) : (
                <span className="font-label-md text-label-md text-text-tertiary">Organic (no campaign)</span>
              )}
            </Td>
            {metricColumns
              .filter((c) => columns.includes(c.key))
              .map((c) => (
                <Fragment key={c.key}>{metricCell(item, c.key)}</Fragment>
              ))}
            <Td align="center">
              <Link
                to={`/content/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-block px-2.5 py-1 rounded bg-surface-card border border-border-strong hover:bg-primary-container hover:border-primary-container text-text-primary font-label-md text-label-sm font-semibold transition-colors whitespace-nowrap"
              >
                View Analytics →
              </Link>
            </Td>
          </Tr>
        ))}
      </tbody>
    </TableShell>
  );
}

/** Card grid alternative to the table (view-mode toggle). */
export function AssetsGrid({ items, campaignName }: { items: ContentItem[]; campaignName: (id: string | null) => string }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/content/${item.id}`}
            className="group flex flex-col h-full bg-surface-card border border-border-strong rounded-lg overflow-hidden hover:border-slate-300 hover:shadow-sm transition"
          >
            <div className="relative aspect-[4/5] bg-slate-900">
              <ImageWithFallback src={item.thumbnailUrl} alt={item.thumbnailAlt} className="w-full h-full" />
              <span className="absolute bottom-2 right-2 bg-black/80 text-white font-label-code text-[10px] px-1.5 py-0.5 rounded">{thumbnailLabel(item)}</span>
              <span className="absolute top-2 left-2">
                <TypeBadge item={item} />
              </span>
            </div>
            <div className="p-3 flex flex-col gap-1.5 flex-1">
              <span className="font-label-md text-label-md font-bold text-text-primary line-clamp-2 group-hover:text-primary">{item.title}</span>
              <span className="text-[11px] text-text-tertiary truncate">
                {item.campaignId ? campaignName(item.campaignId) : 'Organic (no campaign)'} • {formatDate(item.publishedAt, { year: false })}
              </span>
              <div className="mt-auto pt-2 border-t border-border-subtle grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase font-semibold">Views</div>
                  <div className="text-label-md font-bold tnum">{formatCompact(item.metrics.views)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase font-semibold">Eng.</div>
                  <div className="text-label-md font-bold tnum">{formatPercent(item.metrics.engagementRate, 1)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase font-semibold">Leads</div>
                  <div className="text-label-md font-bold tnum text-status-active">{formatNumber(item.metrics.leads)}</div>
                </div>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
