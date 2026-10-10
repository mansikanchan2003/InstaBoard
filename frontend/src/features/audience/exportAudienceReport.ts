import { downloadCsv, type CsvCell } from '@/features/content/csv';
import type { AudiencePageData } from './model';

/** Builds the client-side "Audience Report" CSV from the demo dataset. */
export function exportAudienceReport({ summary, intel, overview }: AudiencePageData) {
  const rows: CsvCell[][] = [
    ['# Eko InstaBoard — Audience report for @ekoindia, Oct 1–31 2024 (DEMO DATA, not retrieved from Instagram)'],
    [],
    ['KPI', 'Value', 'Change vs Sep (%)'],
    ['Total reach', overview.reach.value, overview.reach.delta],
    ['Engaged audience', summary.engagedAudience, intel.kpis.engagedAudienceDeltaPct],
    ['Followers', summary.followers, summary.followerGrowthPct],
    ['Net new followers', summary.netNewFollowers, ''],
    ['New followers (gross)', intel.kpis.newFollowersGross, intel.kpis.newFollowersDeltaPct],
    ['Non-follower reach share (%)', summary.nonFollowerReachPct, intel.kpis.nonFollowerDeltaPct],
    ['Engagement rate (%)', overview.engagementRate.value, overview.engagementRate.delta],
    [],
    ['Follower split', 'Followers', 'Non-followers', 'Total'],
    ...intel.followerSplit.map((r) => [r.label, r.followers, r.nonFollowers, r.total]),
    [],
    ['Gender', 'Share (%)'],
    ['Male', summary.gender.male],
    ['Female', summary.gender.female],
    ['Unknown', summary.gender.unknown],
    [],
    ['Age bracket', 'Share (%)', 'Audience', 'Change vs Sep (pp)'],
    ...summary.age.map((a) => [a.label, a.share, a.audience, a.deltaPct]),
    [],
    ['State', 'Share (%)', 'Reach', 'Engaged', 'Attributed leads'],
    ...summary.topStates.map((s) => [s.label, s.share, s.reach, s.engaged, s.leads]),
    [],
    ['City', 'Reach', 'Leads', 'Conversion (%)'],
    ...intel.cities.map((c) => [c.city, c.reach, c.leads, c.conversionPct]),
    [],
    ['Segment', 'Reach', 'Engaged users', 'Engagement rate (%)', 'Leads', 'Conversion rate (%)'],
    ...intel.segments.map((s) => [s.label, s.reach, s.engagedUsers, s.engagementRate, s.leads, s.conversionRate]),
    [],
    ['Date', 'Followers (Oct)', 'Followers (Sep baseline)'],
    ...intel.followerGrowth.map((p) => [p.date, p.current, p.previous]),
  ];
  downloadCsv('ekoindia-audience-report-oct-2024-demo.csv', rows);
}
