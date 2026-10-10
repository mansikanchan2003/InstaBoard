import { Link, useNavigate } from 'react-router-dom';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/format';
import type { InstagramAccount } from '@/types/domain';
import { accountTypeLabel, availabilityCategories, availabilityIcon, canSync } from './accountMeta';
import { AccountStatusPill } from './AccountStatusPill';
import type { useAccountActions } from './useAccountActions';

type Actions = ReturnType<typeof useAccountActions>;

export function AccountAvatar({ account, size = 'md' }: { account: InstagramAccount; size?: 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-16 h-16 rounded-xl' : 'w-14 h-14 rounded-lg';
  if (account.status === 'expired') {
    return (
      <div className={cn(dims, 'bg-surface-card-subtle text-text-tertiary font-bold flex items-center justify-center text-lg border border-border-strong flex-shrink-0')}>
        <Icon name="link_off" className="text-[28px]" />
      </div>
    );
  }
  if (account.avatarUrl) {
    return (
      <div className="relative flex-shrink-0">
        <img alt={`${account.displayName} brand avatar`} className={cn(dims, 'object-contain p-1.5 bg-white border border-border-strong shadow-sm')} src={account.avatarUrl} />
        {account.verified && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-container text-text-primary flex items-center justify-center ring-2 ring-white" title="Verified (sample)">
            <Icon name="verified" filled className="text-[13px]" />
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn(dims, 'bg-surface-container text-text-primary font-bold flex items-center justify-center text-lg border border-border-strong flex-shrink-0')} aria-hidden>
      {account.initials}
    </div>
  );
}

function AccountMoreMenu({ account, actions }: { account: InstagramAccount; actions: Actions }) {
  const navigate = useNavigate();
  const toast = useToast();
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(account.externalId);
      toast({ tone: 'success', title: 'Account ID copied', description: `${account.externalId} (sample ID)` });
    } catch {
      toast({ tone: 'warning', title: 'Copy unavailable', description: `Clipboard access was blocked. ID: ${account.externalId}` });
    }
  };
  return (
    <Dropdown
      label={`Actions for @${account.handle}`}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`More actions for @${account.handle}`}
          className="h-8 w-8 text-text-secondary hover:text-text-primary hover:bg-surface-canvas rounded flex items-center justify-center border border-border-strong transition"
        >
          <Icon name="more_vert" className="text-[18px]" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon="open_in_new" onClick={() => (close(), navigate(`/accounts/${account.id}`))}>
            View details
          </MenuItem>
          {canSync(account) && (
            <MenuItem icon="sync" onClick={() => (close(), actions.sync(account))}>
              Sync now (demo)
            </MenuItem>
          )}
          <MenuItem icon="key" onClick={() => (close(), actions.reviewPermissions(account))}>
            Review permissions
          </MenuItem>
          <MenuItem icon="sync_problem" onClick={() => (close(), actions.reconnect())}>
            Reconnect account
          </MenuItem>
          <MenuItem icon="content_copy" onClick={() => (close(), copyId())}>
            Copy account ID
          </MenuItem>
          <div className="my-1 border-t border-border-subtle" />
          <MenuItem icon="link_off" danger onClick={() => (close(), actions.requestDisconnect(account))}>
            Disconnect
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

function AvailabilityMatrix({ account }: { account: InstagramAccount }) {
  return (
    <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {availabilityCategories.map((c) => {
        const d = account.dataAvailability[c.key];
        const meta = availabilityIcon[d.level];
        return (
          <div key={c.key} className={cn('p-2.5 bg-white border border-border-strong rounded flex flex-col justify-between', d.level === 'inactive' && 'opacity-75')}>
            <div className="flex items-center justify-between text-text-secondary gap-1">
              <span className="text-[11px] font-semibold uppercase">{c.label}</span>
              <Icon name={meta.icon} className={cn('text-[16px]', meta.cls)} />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className={cn('text-label-md font-label-md font-bold', meta.valueCls)}>{d.label}</span>
              <span className={cn('text-[10px] text-right', c.key === 'comments' && d.detail === 'AI Sentiment' ? 'text-ai-accent font-semibold' : 'text-text-secondary')}>{d.detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One account card from the overview list; layout varies by status exactly as in the export. */
export function AccountCard({ account, actions }: { account: InstagramAccount; actions: Actions }) {
  const expired = account.status === 'expired';
  const attention = account.status === 'action_required';
  const typeIcon = account.type === 'business' ? 'business_center' : 'person';

  return (
    <article
      className={cn(
        'bg-surface-card rounded-lg p-4 sm:p-5 shadow-sm transition',
        expired ? 'border border-border-strong opacity-80 hover:opacity-100' : attention ? 'border-2 border-amber-300' : 'border-2 border-border-strong hover:border-slate-400',
      )}
      aria-label={`${account.displayName} (@${account.handle})`}
    >
      <div className={cn('flex flex-col lg:flex-row lg:items-center justify-between gap-4', !expired && 'pb-4 border-b border-border-strong')}>
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <AccountAvatar account={account} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/accounts/${account.id}`}
                className={cn('font-headline-md text-headline-md font-bold hover:underline', expired ? 'text-text-secondary' : 'text-text-primary')}
              >
                {account.displayName}
              </Link>
              <span className={cn('text-label-md font-label-md', expired ? 'text-text-tertiary' : 'text-text-secondary')}>@{account.handle}</span>
              <AccountStatusPill status={account.status} />
              {account.isPrimary && <span className="text-label-code font-label-code uppercase tracking-wider px-2 py-0.5 rounded bg-surface-container-low text-primary font-bold">Primary</span>}
            </div>
            {expired ? (
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-body-sm font-body-sm text-text-tertiary mt-1">
                <span>{accountTypeLabel[account.type]}</span>
                <span aria-hidden>•</span>
                <span>Last successfully synced: {account.lastSyncedAt}</span>
                {account.statusNote && (
                  <>
                    <span aria-hidden>•</span>
                    <span>{account.statusNote}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-body-sm font-body-sm text-text-secondary mt-1">
                <span className="flex items-center gap-1">
                  <Icon name={typeIcon} className="text-[16px] text-text-tertiary" />
                  {accountTypeLabel[account.type]}
                </span>
                <span aria-hidden>•</span>
                <span>
                  ID: <code className="font-label-code bg-surface-card-subtle px-1 rounded text-text-primary">{account.externalId}</code>
                </span>
                <span aria-hidden>•</span>
                <span>
                  {account.isPrimary ? 'Connected since' : 'Connected'} {formatDate(account.connectedSince)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
          {expired ? (
            <>
              <Button icon="sync_problem" onClick={actions.reconnect} className="font-bold shadow-sm">
                Reconnect Account
              </Button>
              <Button size="icon" aria-label={`Disconnect @${account.handle}`} onClick={() => actions.requestDisconnect(account)}>
                <Icon name="delete_outline" className="text-[18px]" />
              </Button>
            </>
          ) : attention ? (
            <>
              <button
                type="button"
                onClick={() => actions.reviewPermissions(account)}
                className="h-8 px-3.5 bg-status-paused hover:bg-brand-primary-hover text-white font-bold rounded text-label-md font-label-md transition flex items-center gap-1.5 shadow-sm"
              >
                <Icon name="key" className="text-[16px]" />
                <span>Review Permissions</span>
              </button>
              <LinkButton to={`/accounts/${account.id}`}>View Details</LinkButton>
              <AccountMoreMenu account={account} actions={actions} />
            </>
          ) : (
            <>
              <Button icon="sync" loading={actions.isSyncing(account.id)} onClick={() => actions.sync(account)}>
                Sync Now
              </Button>
              <LinkButton to={`/accounts/${account.id}`} variant="primary" className="px-3.5">
                View Details
              </LinkButton>
              <AccountMoreMenu account={account} actions={actions} />
            </>
          )}
        </div>
      </div>

      {!expired && (
        <div className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {attention ? (
            <div className="p-3 bg-amber-50/60 rounded border border-amber-200 flex flex-col justify-center">
              <span className="text-label-code font-label-code uppercase tracking-wider text-amber-800">Token Status Alert</span>
              <div className="text-body-sm font-body-sm text-text-primary font-semibold mt-1">{account.statusNote ?? 'Renewal required'}</div>
              <span className="text-[11px] text-amber-700 font-medium mt-0.5">Graph API long-lived user token</span>
            </div>
          ) : (
            <div className="p-3 bg-surface-canvas rounded border border-border-subtle flex flex-col justify-center">
              <span className="text-label-code font-label-code uppercase tracking-wider text-text-secondary">Telemetry Schedule</span>
              <div className="text-body-sm font-body-sm text-text-primary font-semibold mt-1">{account.lastSyncedAt}</div>
              {account.nextSyncLabel && (
                <span className="text-[11px] text-status-active font-medium mt-0.5 flex items-center gap-1">
                  <Icon name="schedule" className="text-[13px]" /> {account.nextSyncLabel}
                </span>
              )}
            </div>
          )}
          <AvailabilityMatrix account={account} />
        </div>
      )}
    </article>
  );
}
