import { AccountsOverview } from '@/features/accounts/AccountsOverview';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** Instagram Accounts Overview (design-reference: eko_instaboard_instagram_accounts_overview). */
export default function AccountsPage() {
  useDocumentTitle('Instagram Accounts');
  return <AccountsOverview />;
}
