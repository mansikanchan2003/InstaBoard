import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import NotFoundPage from '@/pages/NotFoundPage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CampaignsPage = lazy(() => import('@/pages/campaigns/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('@/pages/campaigns/CampaignDetailPage'));
const ContentLibraryPage = lazy(() => import('@/pages/content/ContentLibraryPage'));
const ReelAnalyticsPage = lazy(() => import('@/pages/content/ReelAnalyticsPage'));
const AudiencePage = lazy(() => import('@/pages/AudiencePage'));
const CommentsPage = lazy(() => import('@/pages/CommentsPage'));
const LeadsPage = lazy(() => import('@/pages/LeadsPage'));
const AiInsightsPage = lazy(() => import('@/pages/ai-insights/AiInsightsPage'));
const AiInsightDetailPage = lazy(() => import('@/pages/ai-insights/AiInsightDetailPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const ReportDetailPage = lazy(() => import('@/pages/reports/ReportDetailPage'));
const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
const ConnectAccountPage = lazy(() => import('@/pages/accounts/ConnectAccountPage'));
const AccountDetailPage = lazy(() => import('@/pages/accounts/AccountDetailPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

/** Route table. Each path maps to a screen in design-reference/ (see README "Screen map"). */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'campaigns/:campaignId', element: <CampaignDetailPage /> },
      { path: 'content', element: <ContentLibraryPage /> },
      { path: 'content/:contentId', element: <ReelAnalyticsPage /> },
      { path: 'audience', element: <AudiencePage /> },
      { path: 'comments', element: <CommentsPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'ai-insights', element: <AiInsightsPage /> },
      { path: 'ai-insights/:insightId', element: <AiInsightDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/:reportId', element: <ReportDetailPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'accounts/connect', element: <ConnectAccountPage /> },
      { path: 'accounts/:accountId', element: <AccountDetailPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'activity', element: <ActivityLogPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
