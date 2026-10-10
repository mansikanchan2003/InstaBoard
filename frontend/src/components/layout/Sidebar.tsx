import { NavLink } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { commentsService } from '@/services/comments';
import { leadService } from '@/services/leads';
import { notificationService } from '@/services/notifications';
import { Icon } from '@/components/ui/Icon';
import { footerNav, mainNav, type NavItem } from './navigation';

type NavCounts = { comments?: number; leads?: number };

function NavBadge({ item, unread, counts }: { item: NavItem; unread: number; counts: NavCounts }) {
  if (!item.badge) return null;
  if (item.badge.kind === 'ai')
    return <span className="ml-auto text-[9px] font-bold px-1 py-0.5 rounded bg-ai-subtle text-ai-accent border border-ai-border">AI</span>;
  if (item.badge.kind === 'dot') return unread > 0 ? <span className="ml-auto w-2 h-2 rounded-full bg-status-active" aria-label={`${unread} unread`} /> : null;
  const value = counts[item.badge.key];
  if (value === undefined) return null;
  return item.badge.key === 'comments' ? (
    <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full bg-status-active-subtle text-status-active border border-emerald-200 tnum">{value}</span>
  ) : (
    <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full bg-primary-container/20 text-on-primary-container tnum">{value}</span>
  );
}

function SideLink({ item, unread, counts, onNavigate }: { item: NavItem; unread: number; counts: NavCounts; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 border-l-2',
          isActive
            ? 'bg-surface-container-low text-text-primary font-semibold border-primary-container'
            : 'text-text-secondary font-medium hover:bg-surface-canvas hover:text-text-primary border-transparent',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className={cn(isActive ? 'text-primary-container' : item.iconClassName)} />
          <span className="font-label-md text-label-md">{item.label}</span>
          <NavBadge item={item} unread={unread} counts={counts} />
        </>
      )}
    </NavLink>
  );
}

/** Fixed 240px control column (desktop) / slide-in drawer (mobile). */
export function Sidebar() {
  const { openCreateCampaign, mobileNavOpen, setMobileNavOpen } = useAppUi();
  const unread = useQuery('notifications:unread', notificationService.unreadCount);
  const unreadCount = unread.data ?? 0;
  // Badge counts come from the same services as the Comments / Leads screens (demo store or API).
  const commentSummary = useQuery('comments:summary', commentsService.summary);
  const leadSummary = useQuery('leads:summary', leadService.summary);
  const counts: NavCounts = { comments: commentSummary.data?.needsResponse, leads: leadSummary.data?.qualifiedLeads };
  const close = () => setMobileNavOpen(false);

  const content = (
    <>
      <div className="flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-lg bg-surface-canvas border border-border-strong p-1 flex items-center justify-center shrink-0">
            <img alt="Eko logo" className="w-full h-full object-contain" src="/eko-logo.png" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-md text-headline-sm text-text-primary font-bold tracking-tight">InstaBoard</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-container text-text-primary leading-none">v2.4</span>
            </div>
            <span className="font-label-sm text-label-sm text-text-secondary truncate">Enterprise Analytics</span>
          </div>
          <button type="button" className="ml-auto lg:hidden p-1 text-text-secondary hover:text-text-primary" onClick={close} aria-label="Close navigation">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <button
          type="button"
          className="w-full py-2 px-3 bg-primary-container hover:bg-brand-primary-hover text-text-primary font-bold rounded-lg text-label-md flex items-center justify-center gap-2 transition-colors duration-150 shadow-sm"
          onClick={() => {
            close();
            openCreateCampaign();
          }}
        >
          <Icon name="add_circle" className="text-[18px]" />
          <span>New Campaign</span>
        </button>
        <nav className="flex flex-col gap-1 mt-1 overflow-y-auto custom-scrollbar min-h-0" aria-label="Primary">
          {mainNav.map((section, i) => (
            <div key={section.label ?? i} className="flex flex-col gap-1">
              {section.label && <span className={cn('font-label-code text-label-code text-text-tertiary px-3 uppercase tracking-wider mb-1', i > 0 && 'mt-3')}>{section.label}</span>}
              {section.items.map((item) => (
                <SideLink key={item.to} item={item} unread={unreadCount} counts={counts} onNavigate={close} />
              ))}
            </div>
          ))}
        </nav>
      </div>
      <nav className="border-t border-border-strong pt-3 flex flex-col gap-1" aria-label="System">
        {footerNav.map((item) => (
          <SideLink key={item.to} item={item} unread={unreadCount} counts={counts} onNavigate={close} />
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 z-30 bg-surface-card border-r border-border-strong flex-col justify-between gap-4 p-4 select-none">{content}</aside>
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <aside className="h-full w-72 max-w-[85vw] bg-surface-card border-r border-border-strong flex flex-col justify-between gap-4 p-4 animate-slide-in-left" aria-label="Navigation drawer">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
