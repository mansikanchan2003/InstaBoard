import { modeText } from '@/lib/config';
import type { ReactNode } from 'react';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import type { ActivityActor, ActivityCategory } from '@/types/activity';
import type { InstagramAccount } from '@/types/domain';
import { categoryLabels, dateScopes, defaultFilters, outcomeLabels, type ActivityFilterState, type DateScope, type OutcomeFilter } from './activityUi';

const selectCls =
  'w-full pl-3 pr-8 py-1.5 text-label-md font-label-md border border-border-strong rounded-lg focus:border-border-focused focus:ring-0 bg-white text-text-primary cursor-pointer appearance-none';

function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <Icon name="expand_more" className="text-text-secondary absolute right-2.5 top-2 pointer-events-none text-[18px]" />
    </div>
  );
}

function ScopeChip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-surface-canvas border border-border-strong px-2 py-0.5 rounded text-[12px] text-text-primary font-medium">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-error ml-0.5 flex" aria-label={removeLabel}>
          <Icon name="close" className="text-[13px]" />
        </button>
      )}
    </span>
  );
}

export function ActivityFilters({
  filters,
  onChange,
  actors,
  accounts,
  matchCount,
}: {
  filters: ActivityFilterState;
  onChange: (patch: Partial<ActivityFilterState>) => void;
  actors: ActivityActor[];
  accounts: InstagramAccount[];
  matchCount: number;
}) {
  const members = actors.filter((a) => a.kind === 'member');
  const systems = actors.filter((a) => a.kind !== 'member');
  const actorLabel =
    filters.actor === 'kind:member' ? 'All operators' : filters.actor === 'kind:automated' ? 'All automated' : actors.find((a) => a.id === filters.actor)?.name;
  const account = accounts.find((a) => a.id === filters.account);
  const isDefault = JSON.stringify(filters) === JSON.stringify(defaultFilters);

  return (
    <div className="bg-surface-card border border-border-strong rounded-xl p-3 mb-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 relative">
          <Icon name="search" className="text-text-tertiary absolute left-3 top-2.5 text-[18px] pointer-events-none" />
          <input
            type="search"
            aria-label="Search activity log"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-3 py-1.5 text-label-md font-label-md border border-border-strong rounded-lg focus:border-border-focused focus:ring-0 placeholder:text-text-tertiary text-text-primary"
            placeholder="Search by event, entity ID, actor, or description..."
          />
        </div>
        <div className="md:col-span-3">
          <SelectWrap>
            <select aria-label="Event category" className={selectCls} value={filters.category} onChange={(e) => onChange({ category: e.target.value as ActivityCategory | '' })}>
              <option value="">All Categories ({Object.keys(categoryLabels).length})</option>
              {(Object.keys(categoryLabels) as ActivityCategory[]).map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </SelectWrap>
        </div>
        <div className="md:col-span-2">
          <SelectWrap>
            <select aria-label="Outcome" className={selectCls} value={filters.outcome} onChange={(e) => onChange({ outcome: e.target.value as OutcomeFilter })}>
              <option value="">All Outcomes</option>
              <option value="success">Success</option>
              <option value="in_progress">In Progress</option>
              <option value="warning">Warning / Attention</option>
              <option value="failed">Error / Failed</option>
              <option value="resolved">Resolved</option>
              <option value="issues">All warnings &amp; failures</option>
            </select>
          </SelectWrap>
        </div>
        <div className="md:col-span-3">
          <SelectWrap>
            <select aria-label="Actor" className={selectCls} value={filters.actor} onChange={(e) => onChange({ actor: e.target.value })}>
              <option value="">All Actors</option>
              <option value="kind:automated">All System / AI sources</option>
              <option value="kind:member">All Operators</option>
              <optgroup label="System sources">
                {systems.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.shortLabel}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Operators">
                {members.map((a) => (
                  <option key={a.id} value={a.id}>
                    Operator: {a.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </SelectWrap>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border-subtle text-body-sm font-body-sm text-text-secondary">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-text-tertiary font-label-code text-label-code font-semibold uppercase">ACTIVE SCOPE:</span>
          <Dropdown
            align="left"
            label="Account scope"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="inline-flex items-center gap-1 bg-surface-canvas border border-border-strong px-2 py-0.5 rounded text-[12px] text-text-primary font-medium hover:border-text-secondary"
              >
                Account: {account ? `@${account.handle}` : 'All accounts'}
                <Icon name="expand_more" className="text-[14px] text-text-tertiary" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem active={!filters.account} onClick={() => (onChange({ account: '' }), close())}>
                  All accounts
                </MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} active={filters.account === a.id} onClick={() => (onChange({ account: a.id }), close())}>
                    @{a.handle}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
          <span className="inline-flex items-center gap-1 bg-surface-canvas border border-border-strong rounded text-[12px] text-text-primary font-medium">
            <Dropdown
              align="left"
              label="Date scope"
              trigger={({ toggle, open }) => (
                <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-1 pl-2 py-0.5 hover:text-text-primary">
                  Date: {dateScopes[filters.date].label}
                  <Icon name="expand_more" className="text-[14px] text-text-tertiary" />
                </button>
              )}
            >
              {(close) =>
                (Object.keys(dateScopes) as DateScope[]).map((d) => (
                  <MenuItem key={d} active={filters.date === d} onClick={() => (onChange({ date: d }), close())}>
                    {dateScopes[d].label}
                  </MenuItem>
                ))
              }
            </Dropdown>
            {filters.date !== 'all' ? (
              <button type="button" onClick={() => onChange({ date: 'all' })} className="hover:text-error pr-2 flex" aria-label="Remove date scope">
                <Icon name="close" className="text-[13px]" />
              </button>
            ) : (
              <span className="pr-2" />
            )}
          </span>
          {filters.category && (
            <ScopeChip onRemove={() => onChange({ category: '' })} removeLabel="Remove category filter">
              Category: {categoryLabels[filters.category]}
            </ScopeChip>
          )}
          {filters.outcome && (
            <ScopeChip onRemove={() => onChange({ outcome: '' })} removeLabel="Remove outcome filter">
              Outcome: {filters.outcome === 'issues' ? 'Warnings & failures' : outcomeLabels[filters.outcome]}
            </ScopeChip>
          )}
          {filters.actor && (
            <ScopeChip onRemove={() => onChange({ actor: '' })} removeLabel="Remove actor filter">
              Actor: {actorLabel}
            </ScopeChip>
          )}
          {filters.search && (
            <ScopeChip onRemove={() => onChange({ search: '' })} removeLabel="Clear search">
              “{filters.search}”
            </ScopeChip>
          )}
          {!isDefault && (
            <button type="button" onClick={() => onChange(defaultFilters)} className="text-primary hover:underline text-[12px] font-semibold ml-2">
              Clear filters
            </button>
          )}
        </div>
        <div className="text-text-tertiary font-label-code text-label-code shrink-0">
          INDEX STATE: <span className="text-text-secondary font-semibold">{modeText('IN-MEMORY DEMO', 'DATABASE')} · {matchCount} MATCHES</span>
        </div>
      </div>
    </div>
  );
}
