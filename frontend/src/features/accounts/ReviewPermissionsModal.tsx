import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { accountDetailService } from '@/services/accountDetails';
import type { InstagramAccount } from '@/types/domain';

/** "Review Permissions": compares the sample account's granted scopes with what InstaBoard requests. */
export function ReviewPermissionsModal({ account, onClose, onReconnect }: { account: InstagramAccount | null; onClose: () => void; onReconnect: () => void }) {
  const catalog = useQuery('accounts:scopes', accountDetailService.scopeCatalog);
  const scopes = catalog.data ?? [];
  const missingMandatory = account ? scopes.filter((s) => s.mandatory && !account.scopes.includes(s.scope)) : [];

  return (
    <Modal
      open={!!account}
      onClose={onClose}
      size="md"
      icon="key"
      title="Review permissions"
      subtitle={account ? `${account.displayName} (@${account.handle})` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            icon="sync_problem"
            onClick={() => {
              onClose();
              onReconnect();
            }}
          >
            Re-authorize account
          </Button>
        </>
      }
    >
      {account && (
        <div className="space-y-3">
          {account.statusNote && (
            <Notice tone={account.status === 'expired' ? 'warning' : 'info'} title="Token status (sample)">
              {account.statusNote}
            </Notice>
          )}
          <ul className="space-y-2">
            {scopes.map((s) => {
              const granted = account.scopes.includes(s.scope);
              return (
                <li key={s.scope} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border-strong">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-label-code font-label-code text-primary bg-primary-fixed/30 px-2 py-0.5 rounded font-bold">{s.scope}</code>
                      {s.mandatory && <span className="text-label-code font-label-code uppercase tracking-wider text-text-secondary">Mandatory</span>}
                    </div>
                    <p className="text-body-sm text-text-secondary mt-1">{s.detailDescription}</p>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap', granted ? 'text-[#065F46]' : 'text-error')}>
                    <Icon name={granted ? 'check_circle' : 'cancel'} className="text-[16px]" />
                    {granted ? 'Granted' : 'Not granted'}
                  </span>
                </li>
              );
            })}
          </ul>
          <Notice tone="demo">
            {missingMandatory.length > 0
              ? `${missingMandatory.length} mandatory scope${missingMandatory.length === 1 ? ' is' : 's are'} missing in this sample. `
              : 'All mandatory scopes are granted in this sample. '}
            Re-authorizing opens the connect walkthrough — Meta authorization itself isn’t available in this prototype.
          </Notice>
        </div>
      )}
    </Modal>
  );
}
