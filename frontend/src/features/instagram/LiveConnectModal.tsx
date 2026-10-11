import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Overlay';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { instagramService } from '@/services/instagram';
import { META_DOCS_URL } from '@/features/accounts/AccountsOverview';
import { LiveStateBadge } from './LiveConnectionsSection';
import { scopeDescriptions } from './liveMeta';
import { useInstagramActions } from './useInstagramActions';

const requirements = [
  'An Instagram Business or Creator (professional) account — personal accounts cannot be connected.',
  'You can sign in to that Instagram account in this browser.',
  'While the Meta app is in development mode, the account must be added to the app as an Instagram tester (see README).',
];

/** API mode: the real connect step. Starts Meta's official Instagram Login; nothing is simulated. */
export function LiveConnectModal({ onClose }: { onClose: () => void }) {
  const status = useQuery('instagram:status', instagramService.status);
  const actions = useInstagramActions();
  const data = status.data;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon="add_link"
      title="Connect an Instagram professional account"
      subtitle="You will be sent to Instagram to sign in and approve read-only access. InstaBoard never sees your Instagram password."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={actions.connecting ? 'progress_activity' : 'open_in_new'}
            onClick={() => void actions.connect()}
            loading={actions.connecting}
            disabled={!data?.enabled || !data.canManage}
          >
            {actions.connecting ? 'Redirecting to Instagram…' : 'Continue with Instagram'}
          </Button>
        </>
      }
    >
      {status.status === 'loading' ? (
        <Skeleton className="h-40" />
      ) : status.error || !data ? (
        <ErrorState title="Could not load the integration status" error={status.error} onRetry={status.refetch} />
      ) : (
        <div className="space-y-5 text-body-sm">
          <div className="flex items-center gap-2">
            <LiveStateBadge state={actions.connecting ? 'connecting' : 'not_connected'} />
            {data.apiVersion && <span className="text-[12px] text-text-tertiary">Instagram API with Instagram Login · Graph API {data.apiVersion}</span>}
          </div>
          {!data.enabled && (
            <Notice tone="warning" title="Not configured on this server">
              Set <span className="font-mono text-[12px]">{data.missingConfig.join(', ')}</span> in <code>backend/.env</code> and restart the API.
            </Notice>
          )}
          {data.enabled && !data.canManage && (
            <Notice tone="warning" title="Owner or admin required">Your role can view connected accounts but cannot connect new ones.</Notice>
          )}
          <div>
            <h3 className="font-semibold text-text-primary mb-2">Before you continue</h3>
            <ul className="space-y-1.5">
              {requirements.map((r) => (
                <li key={r} className="flex items-start gap-2 text-text-secondary">
                  <Icon name="check_circle" className="text-[16px] text-status-active mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary mb-2">Permissions InstaBoard will request</h3>
            <ul className="space-y-2">
              {data.requestedScopes.map((scope) => (
                <li key={scope} className="p-2.5 rounded border border-border-strong bg-surface-canvas">
                  <code className="text-[12px] font-semibold text-text-primary">{scope}</code>
                  <p className="text-text-secondary text-[12px] mt-0.5">{scopeDescriptions[scope] ?? 'Read access.'}</p>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-text-tertiary mt-2">
              You can decline optional permissions on Instagram; the related data is then shown as unavailable. Not requested: publishing, direct messages.{' '}
              <a href={META_DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline">Meta documentation</a>
            </p>
          </div>
        </div>
      )}
      {actions.overlays}
    </Modal>
  );
}
