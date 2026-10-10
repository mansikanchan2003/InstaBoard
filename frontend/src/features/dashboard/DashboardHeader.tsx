import { useNavigate } from 'react-router-dom';
import { useAppUi } from '@/app/AppUiContext';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/States';
import { formatCompact } from '@/lib/format';

/** "Eko India Campaign Overview" banner with the active-campaign pill and page actions. */
export function DashboardHeader({ activeCount, followers, healthScore }: { activeCount?: number; followers?: number; healthScore?: number }) {
  const navigate = useNavigate();
  const { openCreateCampaign } = useAppUi();
  return (
    <div className="bg-gradient-to-r from-amber-50 via-white to-blue-50/40 border border-border-strong rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-primary-container text-text-primary flex items-center justify-center font-bold shrink-0">
          <Icon name="analytics" className="text-[24px]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-headline-md text-headline-md text-text-primary">Eko India Campaign Overview</h1>
            {activeCount !== undefined && (
              <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-status-active-subtle border border-emerald-200 text-status-active font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-active" /> {activeCount} Active Campaign{activeCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {followers !== undefined ? (
            <p className="text-body-sm text-text-secondary">
              Tracking agent recruitment, financial inclusion reels, and rural kiosk conversions across <span className="tnum">{formatCompact(followers)}</span> followers.
            </p>
          ) : (
            <Skeleton className="h-4 w-72 mt-1" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="px-3 py-1.5 bg-ai-subtle border border-ai-border text-ai-accent rounded-lg text-label-md font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
          onClick={() => navigate('/ai-insights')}
        >
          <Icon name="auto_awesome" className="text-[16px]" />
          <span>AI Health Score: {healthScore ?? '—'}/100</span>
        </button>
        <button
          type="button"
          className="px-3.5 py-1.5 bg-primary-container hover:bg-brand-primary-hover text-text-primary rounded-lg text-label-md font-bold transition-colors"
          onClick={openCreateCampaign}
        >
          + New Campaign
        </button>
      </div>
    </div>
  );
}
