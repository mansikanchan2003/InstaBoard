/** Sidebar structure — mirrors the SideNavBar shared component in the Stitch export. */
export interface NavItem {
  label: string;
  to: string;
  icon: string;
  iconClassName?: string;
  badge?: { kind: 'count'; key: 'comments' | 'leads' } | { kind: 'ai' } | { kind: 'dot' };
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const mainNav: NavSection[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
      { label: 'Campaigns', to: '/campaigns', icon: 'campaign' },
      { label: 'Content', to: '/content', icon: 'movie' },
      { label: 'Audience', to: '/audience', icon: 'group' },
      { label: 'Comments', to: '/comments', icon: 'chat_bubble', badge: { kind: 'count', key: 'comments' } },
      { label: 'Leads', to: '/leads', icon: 'contact_page', badge: { kind: 'count', key: 'leads' } },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ label: 'AI Insights', to: '/ai-insights', icon: 'auto_awesome', iconClassName: 'text-ai-accent', badge: { kind: 'ai' } }],
  },
  {
    label: 'Reporting',
    items: [{ label: 'Reports', to: '/reports', icon: 'assessment' }],
  },
];

export const footerNav: NavItem[] = [
  { label: 'Instagram Accounts', to: '/accounts', icon: 'switch_account' },
  { label: 'Notifications', to: '/notifications', icon: 'notifications', badge: { kind: 'dot' } },
  { label: 'Activity Log', to: '/activity', icon: 'history' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
];
