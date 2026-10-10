import { modeText } from '@/lib/config';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import type { InstagramAccount } from '@/types/domain';

/** Confirmation before removing an account from the local demo list (replaces the export's window.alert). */
export function DisconnectAccountModal({
  account,
  pending,
  onCancel,
  onConfirm,
}: {
  account: InstagramAccount | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={!!account}
      onClose={onCancel}
      size="sm"
      icon="link_off"
      title="Disconnect account?"
      subtitle={account ? `${account.displayName} (@${account.handle})` : undefined}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" icon="link_off" loading={pending} onClick={onConfirm} data-autofocus>
            Disconnect
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-body-sm text-text-secondary">
        <p>
          In a connected workspace this would revoke Instagram access, pause webhook ingestion and stop media synchronization for{' '}
          <strong className="text-text-primary">@{account?.handle}</strong>.
        </p>
        <Notice tone="demo" title="Prototype behaviour">
          {modeText('No Meta connection exists, so nothing is revoked. The account is only removed from the local demo list until you reload the page.', 'Disconnecting needs Meta token revocation, which this backend does not have yet — the server will decline the request and nothing will change.')}
        </Notice>
      </div>
    </Modal>
  );
}
