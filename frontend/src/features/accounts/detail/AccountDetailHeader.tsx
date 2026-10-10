import { Link } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/format';
import type { AccountTelemetry, HealthTone } from '@/types/accounts';
import type { InstagramAccount } from '@/types/domain';
import { AccountAvatar } from '../AccountCard';
import { accountTypeLabel } from '../accountMeta';
import { AccountStatusPill } from '../AccountStatusPill';
import type { useAccountActions } from '../useAccountActions';

const toneIcon: Record<HealthTone, { icon: string; cls: string; detailCls: string }> = {
  active: { icon: 'verified_user', cls: 'text-status-active', detailCls: 'text-[#065F46]' },
  warning: { icon: 'lock_clock', cls: 'text-status-paused', detailCls: 'text-[#92400E]' },
  error: { icon: 'gpp_bad', cls: 'text-error', detailCls: 'text-error' },
};

export function AccountDetailTitle({ account }: { account: InstagramAccount }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-strong pb-4">
      <div className="min-w-0">
        <Breadcrumbs
          className="mb-1"
          items={[{ label: 'Connect' }, { label: 'Instagram Accounts', to: '/accounts' }, { label: `${account.displayName} (@${account.handle})` }]}
        />
        <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-text-primary tracking-tight">
          Account Detail: {account.displayName} (@{account.handle})
        </h1>
      </div>
      <Link
        to="/accounts"
        className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-label-md text-label-md font-medium transition-colors self-start sm:self-auto py-1 px-2.5 rounded border border-border-strong bg-surface-card hover:bg-surface-canvas whitespace-nowrap"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        <span>Back to Accounts Overview</span>
      </Link>
    </div>
  );
}

export function AccountDetailHeader({
  account,
  telemetry,
  actions,
}: {
  account: InstagramAccount;
  telemetry: AccountTelemetry;
  actions: ReturnType<typeof useAccountActions>;
}) {
  const toast = useToast();
  const token = toneIcon[telemetry.token.tone];
  const testConnection = () =>
    toast({
      tone: 'demo',
      title: 'API connection test unavailable',
      description: `No request was sent to the Instagram Graph API — @${account.handle} is a sample account and this prototype has no Meta connection.`,
    });

  return (
    <div className="bg-surface-card border border-border-strong rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <AccountAvatar account={account} size="lg" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline-md text-headline-md text-text-primary font-bold">{account.displayName}</span>
              <span className="font-label-md text-label-md text-text-secondary">@{account.handle}</span>
              <AccountStatusPill status={account.status} prefix="Status: " />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-text-secondary font-label-sm text-label-sm">
              <span className="px-2 py-0.5 rounded bg-surface-card-subtle border border-border-strong text-text-primary font-medium">{accountTypeLabel[account.type]}</span>
              <span className="text-text-tertiary">•</span>
              <span className="font-label-code text-label-code font-mono text-text-secondary bg-surface-canvas px-1.5 py-0.5 rounded border border-border-strong">ID: {account.externalId}</span>
              <span className="text-text-tertiary">•</span>
              <span>Connected {formatDate(account.connectedSince)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {account.status === 'expired' ? (
            <Button variant="primary" size="md" icon="sync_problem" onClick={actions.reconnect}>
              Reconnect Account
            </Button>
          ) : (
            <Button
              variant={account.status === 'connected' ? 'primary' : 'secondary'}
              size="md"
              icon="sync"
              loading={actions.isSyncing(account.id)}
              onClick={() => actions.sync(account)}
            >
              Sync Now
            </Button>
          )}
          <Button size="md" icon="network_check" onClick={testConnection}>
            Test API Connection
          </Button>
          {account.status !== 'expired' && (
            <Button variant={account.status === 'action_required' ? 'primary' : 'secondary'} size="md" icon="key" onClick={actions.reconnect}>
              Renew Token
            </Button>
          )}
          <Button variant="danger" size="md" icon="link_off" onClick={() => actions.requestDisconnect(account)} className="border-red-200">
            Disconnect Account
          </Button>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border-strong grid grid-cols-1 md:grid-cols-3 gap-4 text-body-sm font-body-sm">
        <div className="flex items-start gap-2 text-text-secondary">
          <Icon name="schedule" className="text-[18px] text-text-tertiary" />
          <span>
            Last successful sync: <strong className="text-text-primary font-semibold">{account.lastSyncedAt.startsWith('Just now') ? account.lastSyncedAt : telemetry.lastSync.label}</strong>{' '}
            {telemetry.lastSync.detail && <span className="text-text-tertiary">{telemetry.lastSync.detail}</span>}
          </span>
        </div>
        <div className="flex items-start gap-2 text-text-secondary">
          <Icon name="timelapse" className="text-[18px] text-text-tertiary" />
          <span>
            Scheduled cadence: <strong className="text-text-primary font-semibold">{telemetry.cadence.label}</strong>{' '}
            {telemetry.cadence.detail && <span className="text-text-tertiary">{telemetry.cadence.detail}</span>}
          </span>
        </div>
        <div className="flex items-start gap-2 text-text-secondary">
          <Icon name={token.icon} className={cn('text-[18px]', token.cls)} />
          <span>
            Token Status: <strong className="text-text-primary font-semibold">{telemetry.token.label}</strong> <span className={cn('font-medium', token.detailCls)}>{telemetry.token.detail}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
