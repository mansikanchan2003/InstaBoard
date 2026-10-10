import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoBadge } from '@/components/ui/Badge';
import { LinkButton, Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useQuery';
import { cn, formatNumber } from '@/lib/format';
import { accountService } from '@/services/accounts';
import type { InstagramAccount } from '@/types/domain';
import { MASKED_SECRET } from './settingsUi';

const statusPill: Record<InstagramAccount['status'], { label: string; cls: string }> = {
  connected: { label: 'HEALTHY (DEMO)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  syncing: { label: 'SYNCING', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  action_required: { label: 'ACTION REQUIRED', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  expired: { label: 'TOKEN EXPIRED', cls: 'bg-red-50 text-error border-red-200' },
};

function AccountCard({ account, onRaw, onDisconnect }: { account: InstagramAccount; onRaw: () => void; onDisconnect: () => void }) {
  const toast = useToast();
  const pill = statusPill[account.status];
  const healthy = account.status === 'connected';
  const reauth = () =>
    toast({
      tone: 'demo',
      title: healthy ? 'Token not re-verified' : 'OAuth refresh unavailable',
      description: 'This prototype has no Meta Graph API connection, so tokens cannot be verified or refreshed. Manage the account in Instagram Accounts.',
    });
  return (
    <div className="bg-surface-card border border-border-strong rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/accounts/${account.id}`} className="flex items-center gap-3 min-w-0 group">
          <Avatar name={account.displayName} src={account.avatarUrl} size="lg" className="w-12 h-12" />
          <div className="min-w-0">
            <h3 className="font-label-md text-label-md font-bold text-text-primary group-hover:underline truncate">{account.displayName}</h3>
            <div className="font-body-sm text-body-sm text-text-secondary">
              @{account.handle} · {account.type === 'business' ? 'Business' : 'Creator'}
            </div>
          </div>
        </Link>
        <span className={cn('px-2 py-0.5 rounded-full font-label-code text-label-code border whitespace-nowrap', pill.cls)}>{pill.label}</span>
      </div>
      <div className="mt-4 pt-3 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-text-tertiary block">Token Status:</span>
          <span className={cn('font-medium', healthy ? 'text-text-primary' : account.status === 'expired' ? 'text-error' : 'text-amber-700')}>
            {account.statusNote ?? 'Valid (sample status)'}
          </span>
        </div>
        <div>
          <span className="text-text-tertiary block">Connected Feed Media:</span>
          <span className="font-medium text-text-primary tnum">{formatNumber(account.mediaCount)} Posts &amp; Reels</span>
        </div>
        <div>
          <span className="text-text-tertiary block">Access Token:</span>
          <span className="font-mono text-text-secondary">{MASKED_SECRET}</span>
          <button
            type="button"
            className="ml-2 text-primary font-semibold hover:underline"
            onClick={() => toast({ tone: 'demo', title: 'Nothing to reveal', description: 'The prototype stores no Instagram tokens — this masked value is a placeholder.' })}
          >
            Reveal
          </button>
        </div>
        <div>
          <span className="text-text-tertiary block">Last Synced:</span>
          <span className="font-medium text-text-primary">{account.lastSyncedAt}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 pt-2 flex-wrap">
        <button
          type="button"
          onClick={reauth}
          className={cn('font-label-sm text-label-sm font-semibold hover:underline flex items-center gap-1', healthy ? 'text-primary' : 'text-amber-700')}
        >
          <Icon name={healthy ? 'refresh' : 'sync_problem'} className="text-[16px]" /> {healthy ? 'Re-verify Token' : 'Refresh OAuth Token'}
        </button>
        <div className="flex items-center gap-3">
          <button type="button" className="font-label-sm text-label-sm text-text-secondary hover:text-text-primary" onClick={onRaw}>
            View Raw Meta Object
          </button>
          {!account.isPrimary && (
            <button type="button" className="font-label-sm text-label-sm text-error hover:underline" onClick={onDisconnect}>
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function InstagramTab() {
  const accountsQ = useQuery('accounts:list', accountService.list);
  const [raw, setRaw] = useState<InstagramAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState<InstagramAccount | null>(null);
  const primary = accountsQ.data?.find((a) => a.isPrimary) ?? accountsQ.data?.[0];
  const scopes = Array.from(new Set((accountsQ.data ?? []).flatMap((a) => a.scopes)));

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface-card border border-border-strong rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-border-strong">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">Meta Graph API Health &amp; Scopes</h2>
              <span className="font-label-code text-label-code bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">NO LIVE API CONNECTION</span>
              <DemoBadge />
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary mt-1">
              This prototype does not connect to the Meta Graph API (v19.0 planned). Account statuses and scopes below are sample records from the Instagram Accounts module.
            </p>
          </div>
          <LinkButton to="/accounts" iconRight="arrow_forward" className="shrink-0">
            Manage in Instagram Accounts Module
          </LinkButton>
        </div>
        <div className="mb-2">
          <span className="font-label-sm text-label-sm text-text-secondary block mb-2 font-medium">
            Scopes on record{primary ? ` (sample, across ${accountsQ.data?.length ?? 0} accounts)` : ''}:
          </span>
          <div className="flex flex-wrap gap-2">
            {scopes.map((s) => (
              <span key={s} className="px-2.5 py-1 rounded bg-surface-canvas border border-border-strong text-xs font-mono text-text-primary flex items-center gap-1.5">
                <Icon name="check" className="text-[14px] text-emerald-600" /> {s}
              </span>
            ))}
            {accountsQ.status === 'success' && scopes.length === 0 && <span className="text-body-sm text-text-tertiary">No scopes on record.</span>}
          </div>
        </div>
      </div>

      <QueryState
        query={accountsQ}
        loading={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
        }
        empty={
          <div className="p-6 text-center bg-surface-card border border-dashed border-border-strong rounded-lg text-body-sm text-text-secondary">
            No Instagram accounts on record. <Link to="/accounts/connect" className="text-primary font-semibold hover:underline">Connect an account</Link>
          </div>
        }
      >
        {(accounts) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} onRaw={() => setRaw(a)} onDisconnect={() => setDisconnecting(a)} />
            ))}
          </div>
        )}
      </QueryState>

      <div className="p-4 rounded-lg bg-surface-card-subtle border border-border-strong flex items-start gap-3">
        <Icon name="lock" className="text-text-secondary text-[22px]" />
        <div>
          <div className="font-label-md text-label-md font-bold text-text-primary">Zero Password Storage</div>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
            InstaBoard never asks for Instagram passwords, and this prototype stores no tokens at all. In production, tokens would be received via Meta&apos;s server-to-server
            exchange and kept in vault storage, never exposed to the browser.
          </p>
        </div>
      </div>

      <Modal open={!!raw} onClose={() => setRaw(null)} size="lg" icon="data_object" title="Raw account object" subtitle={raw ? `@${raw.handle} · sample record (not fetched from Meta)` : undefined}>
        <div className="bg-text-primary text-slate-200 p-3 rounded-lg font-mono text-[11px] overflow-x-auto custom-scrollbar border border-slate-700">
          <pre>{raw ? JSON.stringify({ ...raw, access_token: MASKED_SECRET }, null, 2) : ''}</pre>
        </div>
      </Modal>

      <Modal
        open={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        size="sm"
        icon="link_off"
        title={`Disconnect @${disconnecting?.handle ?? ''}?`}
        footer={
          <>
            <Button onClick={() => setDisconnecting(null)}>Cancel</Button>
            <LinkButton to={disconnecting ? `/accounts/${disconnecting.id}` : '/accounts'} variant="danger" iconRight="arrow_forward">
              Open account settings
            </LinkButton>
          </>
        }
      >
        <div className="text-body-sm text-text-secondary space-y-2">
          <p>Disconnecting is handled from the account&apos;s page in Instagram Accounts, where you can review which data streams would stop.</p>
          <p className="text-text-tertiary">Nothing has been disconnected.</p>
        </div>
      </Modal>
    </section>
  );
}
