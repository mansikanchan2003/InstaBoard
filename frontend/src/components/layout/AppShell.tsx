import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { CreateCampaignModal } from '@/features/campaigns/CreateCampaignModal';
import { PageSkeleton } from '@/components/ui/States';
import { PreviewStateBar } from './PreviewStateBar';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Fixed sidebar + fixed header + scrollable canvas (matches the export's ml-60 pt-14 layout). */
export function AppShell() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { createCampaignOpen, closeCreateCampaign } = useAppUi();

  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-full bg-surface-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-surface-card focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-flyout">
        Skip to content
      </a>
      <Sidebar />
      <TopBar />
      <main ref={mainRef} id="main" className="lg:ml-60 pt-14 min-h-screen">
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          <PreviewStateBar />
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <CreateCampaignModal open={createCampaignOpen} onClose={closeCreateCampaign} />
    </div>
  );
}
