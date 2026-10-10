import { Pagination, TableShell, Tr } from '@/components/tables/DataTable';
import { Checkbox, Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';
import { useTable } from '@/hooks/useTable';
import { cn, formatNumber } from '@/lib/format';
import type { CommentStatus, InstagramComment } from '@/types/comments';
import type { ContentItem, Lead } from '@/types/domain';
import { CommentAvatar, HighlightedText, intentMeta, Pill, potentialMeta, sentimentMeta, sortLabels, statusMeta, type CommentSort } from './commentMeta';

export interface CommentRowActions {
  onSelect: (c: InstagramComment) => void;
  onRespond: (c: InstagramComment) => void;
  onOpenLead: (leadId: string) => void;
  onConvert: (c: InstagramComment) => void;
  onSetStatus: (c: InstagramComment, status: CommentStatus) => void;
  onToggleFlag: (c: InstagramComment) => void;
  onOpenContent: (contentId: string) => void;
}

const th = 'py-2.5 px-3 text-left whitespace-nowrap';

/** Section 4 (left) of the export: triage table with keyword filter, sort, bulk selection and pagination. */
export function CommentTable({
  rows,
  selectedId,
  checked,
  onCheckedChange,
  sort,
  onSort,
  search,
  onSearch,
  leadFor,
  contentById,
  totalComments,
  sampleSize,
  onBulk,
  actions,
  onResetFilters,
}: {
  rows: InstagramComment[];
  selectedId: string | undefined;
  checked: Set<string>;
  onCheckedChange: (next: Set<string>) => void;
  sort: CommentSort;
  onSort: (s: CommentSort) => void;
  search: string;
  onSearch: (q: string) => void;
  leadFor: (c: InstagramComment) => Lead | undefined;
  contentById: Map<string, ContentItem>;
  totalComments: number;
  sampleSize: number;
  onBulk: (status: CommentStatus) => void;
  actions: CommentRowActions;
  onResetFilters: () => void;
}) {
  const table = useTable<InstagramComment, 'none'>(rows, { accessors: { none: () => 0 }, pageSize: 5 });
  const pageIds = table.rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => checked.has(id));
  const someOnPage = pageIds.some((id) => checked.has(id));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    onCheckedChange(next);
  };
  const togglePage = (on: boolean) => {
    const next = new Set(checked);
    pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onCheckedChange(next);
  };

  return (
    <div className="xl:col-span-8 bg-surface-card border border-border-strong rounded flex flex-col justify-between overflow-hidden min-w-0" id="comment-triage-table">
      <div className="p-3 border-b border-border-strong flex flex-wrap items-center justify-between gap-3 bg-surface-bright">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-headline-sm font-headline-sm text-text-primary">Comment Stream &amp; Triage Queue</h3>
          <span className="text-label-code font-label-code px-2 py-0.5 rounded bg-surface-canvas text-text-secondary border border-border-strong">
            Sample: showing {table.total} of {sampleSize} · {formatNumber(totalComments)} in period
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <label htmlFor="comment-keyword" className="sr-only">
              Filter comments by keyword
            </label>
            <input
              id="comment-keyword"
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="h-8 pl-7 pr-3 text-label-sm font-label-sm border border-border-strong rounded bg-surface-card w-44 focus:outline-none focus:border-border-focused"
              placeholder="Filter by keyword..."
            />
            <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary text-[16px]" />
          </div>
          <Dropdown
            label="Sort comments"
            trigger={({ toggle: t, open }) => (
              <button
                type="button"
                onClick={t}
                aria-expanded={open}
                className="h-8 px-2.5 text-label-sm font-label-sm border border-border-strong rounded bg-surface-card hover:bg-surface-canvas flex items-center gap-1 font-semibold"
              >
                <Icon name="sort" className="text-[16px]" />
                <span>Sort: {sortLabels[sort]}</span>
              </button>
            )}
          >
            {(close) =>
              (Object.keys(sortLabels) as CommentSort[]).map((s) => (
                <MenuItem key={s} active={s === sort} onClick={() => (close(), onSort(s), table.setPage(1))}>
                  {sortLabels[s]}
                </MenuItem>
              ))
            }
          </Dropdown>
        </div>
      </div>

      {checked.size > 0 && (
        <div className="px-3 py-2 border-b border-border-strong bg-amber-50/40 flex flex-wrap items-center gap-2 text-label-sm font-label-sm" role="region" aria-label="Bulk actions">
          <span className="font-semibold text-text-primary">{checked.size} selected</span>
          <button type="button" onClick={() => onBulk('reviewed')} className="px-2 py-1 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas font-semibold flex items-center gap-1">
            <Icon name="done_all" className="text-[14px]" /> Mark reviewed
          </button>
          <button type="button" onClick={() => onBulk('responded')} className="px-2 py-1 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas font-semibold flex items-center gap-1">
            <Icon name="check" className="text-[14px]" /> Mark responded
          </button>
          <button type="button" onClick={() => onBulk('archived')} className="px-2 py-1 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas font-semibold flex items-center gap-1">
            <Icon name="archive" className="text-[14px]" /> Archive
          </button>
          <button type="button" onClick={() => onCheckedChange(new Set())} className="ml-auto text-text-secondary hover:text-text-primary">
            Clear selection
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon="forum"
            title="0 comments found"
            description="Filter parameters yielded an empty set. Try clearing filters."
            action={
              <button type="button" onClick={onResetFilters} className="text-primary hover:underline font-semibold text-label-md">
                Reset filters
              </button>
            }
          />
        </div>
      ) : (
        <TableShell>
          <thead>
            <tr className="bg-surface-canvas text-text-secondary uppercase text-label-code font-label-code border-b border-border-strong">
              <th className="py-2.5 px-3 w-8">
                <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={togglePage} label="Select all comments on this page" />
              </th>
              <th className={th}>User</th>
              <th className={cn(th, 'px-4 min-w-[18rem]')}>Comment Text</th>
              <th className={th}>Content / Reel</th>
              <th className={th}>Sentiment</th>
              <th className={th}>Intent</th>
              <th className={th}>Lead Potential</th>
              <th className={th}>Status</th>
              <th className={cn(th, 'text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody className="text-body-sm font-body-sm">
            {table.rows.map((c) => {
              const selected = c.id === selectedId;
              const lead = leadFor(c);
              const content = contentById.get(c.contentId);
              const leadId = c.leadId ?? (c.status === 'lead_created' ? lead?.id : undefined);
              return (
                <Tr
                  key={c.id}
                  onClick={() => actions.onSelect(c)}
                  selected={selected}
                  label={`Comment by ${c.authorName}`}
                  className={cn('border-b border-border-strong', selected && 'bg-surface-container-low/50 shadow-[inset_4px_0_0_#f5a623]')}
                >
                  <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={checked.has(c.id)} onChange={(on) => toggle(c.id, on)} label={`Select comment by ${c.authorName}`} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <CommentAvatar comment={c} />
                      <div className="min-w-0">
                        <div className="font-bold text-text-primary text-label-md font-label-md truncate max-w-[110px] flex items-center gap-1">
                          {c.authorName}
                          {c.flagged && <Icon name="flag" filled className="text-[13px] text-error" label="Flagged" />}
                        </div>
                        <div className="text-text-tertiary text-label-code font-label-code">@{c.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-[22rem]">
                    <p className={cn('text-text-primary line-clamp-2 whitespace-normal', selected && 'font-medium')}>
                      <HighlightedText
                        text={c.text}
                        highlights={c.highlights}
                        markClassName={c.intent === 'eligibility' ? 'bg-ai-subtle px-1 py-0.5 rounded text-ai-accent' : 'bg-primary-container/30 px-1 py-0.5 rounded text-on-primary-container'}
                      />
                    </p>
                    <span className="text-label-code font-label-code text-text-tertiary mt-0.5 block">
                      {c.receivedLabel} • {c.surface}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5 text-text-secondary text-label-sm font-label-sm max-w-[130px]" title={content?.title}>
                      <Icon name={content?.type === 'reel' ? 'smart_display' : content?.type === 'carousel' ? 'view_carousel' : 'image'} className="text-[14px] text-primary shrink-0" />
                      <span className="truncate">{content?.title ?? c.contentId}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Pill rounded="rounded-full" className={cn('font-semibold', sentimentMeta[c.sentiment].pill)}>
                      {sentimentMeta[c.sentiment].label}
                    </Pill>
                  </td>
                  <td className="py-3 px-2">
                    <Pill className={intentMeta[c.intent].pill}>{intentMeta[c.intent].short}</Pill>
                  </td>
                  <td className="py-3 px-2">
                    <Pill rounded="rounded-full" className={potentialMeta[c.leadPotential].pill}>
                      {c.leadPotential === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container" />}
                      {potentialMeta[c.leadPotential].label}
                    </Pill>
                  </td>
                  <td className="py-3 px-2">
                    <Pill className={statusMeta[c.status].pill}>{statusMeta[c.status].label}</Pill>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      {leadId ? (
                        <button type="button" onClick={() => actions.onOpenLead(leadId)} className="px-2 py-1 bg-surface-card border border-border-strong text-text-primary text-label-code font-label-code font-bold rounded hover:bg-surface-canvas">
                          View Lead
                        </button>
                      ) : c.status === 'needs_response' ? (
                        <button
                          type="button"
                          onClick={() => actions.onRespond(c)}
                          className={cn(
                            'px-2 py-1 text-label-code font-label-code font-bold rounded shadow-xs',
                            c.leadPotential === 'high' ? 'bg-primary-container text-on-primary-container hover:bg-brand-primary-hover' : 'bg-surface-card border border-border-strong text-text-primary hover:bg-surface-canvas',
                          )}
                        >
                          Respond
                        </button>
                      ) : (
                        <button type="button" onClick={() => actions.onSelect(c)} className="px-2 py-1 bg-surface-card border border-border-strong text-text-secondary text-label-code font-label-code font-bold rounded hover:bg-surface-canvas">
                          View
                        </button>
                      )}
                      <Dropdown
                        label={`More actions for ${c.authorName}`}
                        trigger={({ toggle: t, open }) => (
                          <button type="button" onClick={t} aria-expanded={open} aria-label={`More actions for comment by ${c.authorName}`} className="p-1 text-text-secondary hover:text-text-primary rounded">
                            <Icon name="more_vert" className="text-[18px]" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            {c.status !== 'reviewed' && c.status !== 'archived' && (
                              <MenuItem icon="done_all" onClick={() => (close(), actions.onSetStatus(c, 'reviewed'))}>
                                Mark reviewed
                              </MenuItem>
                            )}
                            <MenuItem icon="flag" onClick={() => (close(), actions.onToggleFlag(c))}>
                              {c.flagged ? 'Remove flag' : 'Flag for follow-up'}
                            </MenuItem>
                            {lead ? (
                              <MenuItem icon="contact_page" onClick={() => (close(), actions.onOpenLead(lead.id))}>
                                Open lead
                              </MenuItem>
                            ) : (
                              <MenuItem icon="star" onClick={() => (close(), actions.onConvert(c))}>
                                Convert to lead
                              </MenuItem>
                            )}
                            <MenuItem icon="smart_display" onClick={() => (close(), actions.onOpenContent(c.contentId))}>
                              Open content analytics
                            </MenuItem>
                            {c.status === 'archived' ? (
                              <MenuItem icon="unarchive" onClick={() => (close(), actions.onSetStatus(c, 'needs_response'))}>
                                Restore to queue
                              </MenuItem>
                            ) : (
                              <MenuItem icon="archive" danger onClick={() => (close(), actions.onSetStatus(c, 'archived'))}>
                                Archive
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        noun="sample comments"
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
        pageSizes={[5, 10, 25]}
      />
    </div>
  );
}
