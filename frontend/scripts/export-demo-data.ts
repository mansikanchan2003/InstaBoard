/**
 * Exports the frontend's typed demo dataset for the FastAPI backend.
 *
 *   npm run export:demo-data
 *
 * Writes two files (both generated — do not edit by hand):
 *  - backend/app/seed/demo_data.json            raw demo records, imported by `python -m scripts.seed_demo_data`
 *  - backend/tests/fixtures/contract_expected.json   what each demo-mode service call returns, keyed by the
 *                                                   API path the same call uses in api mode. Backend contract
 *                                                   tests assert the seeded API returns exactly these payloads.
 *
 * Reading the TypeScript modules directly (instead of re-typing records in Python) keeps one source of truth.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { accountsSummaryMeta, accountTelemetry, connectCandidates, connectPrerequisites, rateLimitNotes, retentionPolicy, scopeCatalog, syncLogs } from '@/data/accountDetails';
import { accounts, primaryAccountId } from '@/data/accounts';
import { activityEntries, previousPeriodEventTotal, systemActors } from '@/data/activity';
import { audienceSummary } from '@/data/audience';
import { audienceIntelligence } from '@/data/audienceIntelligence';
import { campaignDetailExtras } from '@/data/campaignDetail';
import { campaigns } from '@/data/campaigns';
import { comments, commentSummary, sentimentTrend } from '@/data/comments';
import { contentItems } from '@/data/content';
import { contentAnalytics } from '@/data/contentAnalytics';
import { executiveBrief } from '@/data/dashboard';
import { insights, insightsOverview, recommendedActions } from '@/data/insights';
import { leadPipelineSummary, leads, octoberLeadChannels, octoberLeadFunnel } from '@/data/leads';
import { defaultNotificationPreferences, notifications } from '@/data/notifications';
import { accountOverview, dailyTrends } from '@/data/overview';
import { campaignBoostSpendInr, cplBenchmarkInr, reports } from '@/data/reports';
import { defaultWorkspaceSettings, notificationTriggerMeta, settingsEnvironment, settingsSession } from '@/data/settings';
import { currentUserId, teamMembers, workspace } from '@/data/workspace';

import { accountDetailService } from '@/services/accountDetails';
import { accountService } from '@/services/accounts';
import { activityService } from '@/services/activity';
import { audienceService } from '@/services/audience';
import { campaignService } from '@/services/campaigns';
import { commentsService } from '@/services/comments';
import { contentService } from '@/services/content';
import { contentAnalyticsService } from '@/services/contentAnalytics';
import { dashboardService } from '@/services/dashboard';
import { insightsService } from '@/services/insights';
import { leadService } from '@/services/leads';
import { notificationService } from '@/services/notifications';
import { settingsService } from '@/services/settings';
import { workspaceService } from '@/services/workspace';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const seed = {
  _meta: {
    description: 'Eko InstaBoard DEMONSTRATION dataset exported from frontend/src/data. Not live Instagram data.',
    source: 'frontend/scripts/export-demo-data.ts',
  },
  workspace,
  currentUserId,
  teamMembers,
  accounts,
  primaryAccountId,
  campaigns,
  campaignDetailExtras,
  campaignBoostSpendInr,
  cplBenchmarkInr,
  contentItems,
  contentAnalytics,
  leads,
  leadPipelineSummary,
  octoberLeadFunnel,
  octoberLeadChannels,
  accountOverview,
  dailyTrends,
  audienceSummary,
  audienceIntelligence,
  commentSummary,
  sentimentTrend,
  comments,
  insightsOverview,
  insights,
  recommendedActions,
  executiveBrief,
  notifications,
  defaultNotificationPreferences,
  reports,
  activityEntries,
  systemActors,
  previousPeriodEventTotal,
  defaultWorkspaceSettings,
  notificationTriggerMeta,
  settingsEnvironment,
  settingsSession,
  scopeCatalog,
  accountsSummaryMeta,
  rateLimitNotes,
  retentionPolicy,
  accountTelemetry,
  syncLogs,
  connectPrerequisites,
  connectCandidates,
};

/** Each entry: API path (as the service uses it in api mode) → payload the demo-mode call returns. */
async function buildContract(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const add = async (path: string, call: () => Promise<unknown>) => {
    out[path] = await call();
  };

  await add('/workspace', workspaceService.get);
  await add('/workspace/members', workspaceService.team);
  await add('/me', workspaceService.currentUser);

  await add('/accounts', accountService.list);
  for (const a of accounts) {
    await add(`/accounts/${a.id}`, () => accountService.get(a.id));
    await add(`/accounts/${a.id}/telemetry`, () => accountDetailService.telemetry(a.id));
    await add(`/accounts/${a.id}/sync-logs`, () => accountDetailService.syncLogs(a.id));
  }
  await add(`/accounts/${primaryAccountId}/overview`, accountService.overview);
  await add(`/accounts/${primaryAccountId}/trends`, accountService.trends);
  await add('/accounts/summary', accountDetailService.summary);
  await add('/meta/scopes', accountDetailService.scopeCatalog);
  await add('/accounts/sync-logs', () => accountDetailService.syncLogs());
  await add('/accounts/connect/reference', accountDetailService.connectReference);

  await add('/activity', activityService.list);
  await add('/activity/actors', activityService.actors);
  await add('/activity/summary', activityService.summary);

  await add('/audience/summary', audienceService.summary);
  await add('/audience/intelligence', audienceService.intelligence);

  await add('/campaigns', campaignService.list);
  for (const c of campaigns) {
    await add(`/campaigns/${c.id}`, () => campaignService.get(c.id));
    await add(`/campaigns/${c.id}/detail`, () => campaignService.detail(c.id));
    await add(`/campaigns/${c.id}/content`, () => contentService.listByCampaign(c.id));
    await add(`/campaigns/${c.id}/leads`, () => leadService.listByCampaign(c.id));
    await add(`/campaigns/${c.id}/leads/funnel`, () => leadService.campaignFunnel(c.id));
  }

  await add('/comments/summary', commentsService.summary);
  await add('/comments/sentiment-trend', commentsService.sentimentTrend);
  await add('/comments', commentsService.list);
  for (const c of comments) await add(`/comments/${c.id}`, () => commentsService.get(c.id));

  await add('/content', contentService.list);
  for (const c of contentItems) {
    await add(`/content/${c.id}`, () => contentService.get(c.id));
    await add(`/content/${c.id}/analytics`, () => contentAnalyticsService.get(c.id));
  }

  await add('/dashboard/executive-brief', dashboardService.executiveBrief);

  await add('/insights/overview', insightsService.overview);
  await add('/insights', insightsService.list);
  await add('/insights/actions', insightsService.actions);
  for (const i of insights) await add(`/insights/${i.id}`, () => insightsService.get(i.id));

  await add('/leads', leadService.list);
  await add('/leads/summary', leadService.summary);

  await add('/notifications', notificationService.list);
  await add('/notifications/unread-count', notificationService.unreadCount);
  await add('/notifications/preferences', notificationService.getPreferences);

  // reportService.list/get compute figures client-side from other services; the API only serves the stored reports.
  out['/reports'] = reports;
  for (const r of reports) out[`/reports/${r.id}`] = r;
  out['/reports/reference'] = { boostSpendInr: campaignBoostSpendInr, cplBenchmarkInr };

  await add('/settings', settingsService.get);
  await add('/settings/environment', settingsService.environment);
  await add('/me/session', settingsService.session);
  out['/settings/notification-triggers'] = notificationTriggerMeta;

  return out;
}

function write(relPath: string, data: unknown) {
  const file = resolve(root, relPath);
  mkdirSync(dirname(file), { recursive: true });
  // JSON.stringify drops `undefined` keys — the same thing the browser sees.
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`wrote ${relPath}`);
}

write('backend/app/seed/demo_data.json', seed);
write('backend/tests/fixtures/contract_expected.json', await buildContract());
