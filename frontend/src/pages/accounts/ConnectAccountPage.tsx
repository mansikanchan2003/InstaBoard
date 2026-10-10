import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountsOverview } from '@/features/accounts/AccountsOverview';
import { ConnectFlowModal } from '@/features/accounts/connect/ConnectFlowModal';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Connect Instagram Account flow (design-reference: eko_instaboard_connect_instagram_account_flow).
 * As in the export, the accounts overview renders blurred and inert underneath the modal flow.
 */
export default function ConnectAccountPage() {
  useDocumentTitle('Connect Instagram Account');
  const navigate = useNavigate();
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // React 18 typings lack `inert`; set it imperatively so the background can't be focused.
    backgroundRef.current?.setAttribute('inert', '');
  }, []);

  return (
    <>
      <div ref={backgroundRef} aria-hidden className="blur-[2px] opacity-40 pointer-events-none select-none">
        <AccountsOverview background />
      </div>
      <ConnectFlowModal onClose={() => navigate('/accounts')} />
    </>
  );
}
