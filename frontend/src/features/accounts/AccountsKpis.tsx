import type { ReactNode } from 'react';
import { useAppUi } from '@/app/AppUiContext';
import { Icon } from '@/components/ui/Icon';
import { cn, formatNumber } from '@/lib/format';
import type { AccountsSummaryMeta } from '@/types/accounts';
import type { InstagramAccount } from '@/types/domain';

function KpiShell({ label, icon, iconCls, hoverCls, children, footer }: { label: string; icon: string; iconCls: string; hoverCls?: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className={cn('bg-surface-card border border-border-strong rounded p-4 flex flex-col justify-between transition-colors', hoverCls ?? 'hover:border-slate-400')}>
      <div className="flex items-center justify-between text-text-secondary gap-2">
        <span className="text-label-sm font-label-sm uppercase tracking-wider text-text-secondary font-semibold">{label}</span>
        <Icon name={icon} className={cn('text-[20px]', iconCls)} />
      </div>
      <div className="my-2">{children}</div>
      <div className="pt-2 border-t border-border-subtle">{footer}</div>
    </div>
  );
}

/** Four summary cards; counts are derived from the (demo) account list. */
export function AccountsKpis({ accounts, meta }: { accounts: InstagramAccount[]; meta: AccountsSummaryMeta }) {
  const { lastSyncedLabel } = useAppUi();
  const active = accounts.filter((a) => a.status !== 'expired');
  const business = active.filter((a) => a.type === 'business').length;
  const creator = active.filter((a) => a.type === 'creator').length;
  const actionRequired = accounts.filter((a) => a.status === 'action_required');
  const expired = accounts.filter((a) => a.status === 'expired').length;
  const quotaPct = Math.round((meta.apiCallsUsed / meta.apiCallsLimit) * 100);
  const lastSync = lastSyncedLabel.replace(/^Synced\s+/i, '');

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Account summary">
      <KpiShell
        label="Connected Accounts"
        icon="account_circle"
        iconCls="text-text-tertiary"
        footer={
          <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-card-subtle text-text-primary font-semibold text-[11px] tnum">{business} Business</span>
            <span className="text-text-tertiary">•</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-card-subtle text-text-primary font-semibold text-[11px] tnum">{creator} Creator</span>
          </div>
        }
      >
        <div className="font-metric-stat-lg text-metric-stat-lg text-text-primary tracking-tight font-bold tnum">{active.length} Active</div>
      </KpiShell>

      <KpiShell
        label="Requiring Attention"
        icon="warning"
        iconCls="text-status-paused"
        hoverCls="hover:border-status-paused"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-1 text-body-sm font-body-sm text-text-secondary">
            {actionRequired[0]?.statusNote ? (
              <span className="text-status-paused font-medium text-[12px] flex items-center gap-1">
                <Icon name="lock_clock" className="text-[14px]" /> OAuth token: {actionRequired[0].statusNote.toLowerCase()}
              </span>
            ) : (
              <span className="text-[12px]">No token renewals pending</span>
            )}
            {expired > 0 && <span className="text-[11px] font-semibold text-status-draft tnum">+{expired} expired</span>}
          </div>
        }
      >
        <div className={cn('font-metric-stat-lg text-metric-stat-lg tracking-tight font-bold tnum', actionRequired.length ? 'text-status-paused' : 'text-text-primary')}>
          {actionRequired.length} Action Req.
        </div>
      </KpiShell>

      <KpiShell
        label="Last Successful Sync"
        icon="update"
        iconCls="text-status-active"
        footer={
          <div className="flex items-center justify-between text-body-sm font-body-sm text-text-secondary gap-2">
            <span className="text-text-secondary text-[12px]">Auto-scheduled cadence:</span>
            <span className="text-text-primary font-semibold text-[12px]">{meta.cadenceLabel}</span>
          </div>
        }
      >
        <div className="font-metric-stat-lg text-metric-stat-lg text-text-primary tracking-tight font-bold first-letter:uppercase">{lastSync}</div>
      </KpiShell>

      <KpiShell
        label="API Quota & Health"
        icon="speed"
        iconCls="text-status-completed"
        footer={
          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-valuenow={quotaPct} aria-valuemin={0} aria-valuemax={100} aria-label="Graph rate limit used">
              <div className="bg-primary-container h-1.5 rounded-full" style={{ width: `${quotaPct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-text-secondary">
              <span>Graph Rate Limit (sample)</span>
              <span className="font-mono text-text-primary font-medium">
                {formatNumber(meta.apiCallsUsed)} / {formatNumber(meta.apiCallsLimit)} calls
              </span>
            </div>
          </div>
        }
      >
        <div className="flex items-baseline justify-between">
          <div className="font-metric-stat-lg text-metric-stat-lg text-text-primary tracking-tight font-bold tnum">{meta.apiHealthPercent}%</div>
          <span className="text-[11px] font-semibold text-status-active bg-status-active-subtle border border-emerald-200 px-1.5 py-0.5 rounded">{meta.apiHealthLabel}</span>
        </div>
      </KpiShell>
    </section>
  );
}
