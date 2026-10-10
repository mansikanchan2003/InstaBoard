import { useLocation } from 'react-router-dom';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  useDocumentTitle('Page not found');
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 bg-surface-card border border-border-strong rounded-lg">
      <div className="w-14 h-14 rounded-full bg-primary-container/15 flex items-center justify-center mb-4">
        <Icon name="explore_off" className="text-[30px] text-primary" />
      </div>
      <p className="font-label-code text-label-code text-text-tertiary uppercase tracking-wider">Error 404</p>
      <h1 className="font-headline-lg text-headline-lg text-text-primary mt-1">Page not found</h1>
      <p className="text-body-md text-text-secondary mt-2 max-w-md">
        There is no InstaBoard screen at <code className="px-1 py-0.5 rounded bg-surface-card-subtle text-text-primary text-[13px]">{pathname}</code>. It may have moved, or the link is
        incorrect.
      </p>
      <div className="flex gap-2 mt-6">
        <LinkButton to="/dashboard" variant="primary" icon="dashboard">
          Go to Dashboard
        </LinkButton>
        <LinkButton to="/campaigns" icon="campaign">
          View Campaigns
        </LinkButton>
      </div>
    </div>
  );
}
