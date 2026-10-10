import { activityEntries, previousPeriodEventTotal, systemActors } from '@/data/activity';
import { teamMembers } from '@/data/workspace';
import { fromSource } from '@/lib/api/source';
import type { ActivityActor, ActivityEntry, ActivitySummary } from '@/types/activity';

/**
 * Activity Log service. In demo mode entries live in an in-memory store for this browser
 * session only (other demo services — e.g. settings saves — append to it via `recordActivity`).
 * Query keys must start with "activity".
 */
const store: ActivityEntry[] = structuredClone(activityEntries);

const shortName = (name: string) => {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

/** Operators come from the canonical team list; system / AI actors from the activity data. */
const actors: ActivityActor[] = [
  ...teamMembers.map<ActivityActor>((m) => ({
    id: m.id,
    kind: 'member',
    name: m.name,
    shortLabel: `Operator: ${shortName(m.name)}`,
    email: m.email,
    role: `${m.role} · ${m.access}`,
  })),
  ...systemActors,
];

export const actorById = (id: string) => actors.find((a) => a.id === id);

/** Reporting window used by the KPI strip. */
export const ACTIVITY_PERIOD = { start: '2024-10-01', end: '2024-10-31', label: 'OCT 01 - 31, 2024' } as const;

function summarize(entries: ActivityEntry[]): ActivitySummary {
  const inPeriod = entries.filter((e) => e.timestamp.slice(0, 10) >= ACTIVITY_PERIOD.start && e.timestamp.slice(0, 10) <= ACTIVITY_PERIOD.end);
  const isOperator = (e: ActivityEntry) => actorById(e.actorId)?.kind === 'member';
  const automated = inPeriod.filter((e) => !isOperator(e));
  const issues = inPeriod.filter((e) => e.outcome === 'warning' || e.outcome === 'failed' || e.outcome === 'resolved');
  return {
    total: inPeriod.length,
    previousPeriodTotal: previousPeriodEventTotal,
    automated: automated.length,
    operator: inPeriod.length - automated.length,
    issues: issues.length,
    issuesAddressed: issues.filter((e) => e.outcome === 'resolved').length,
    activeOperators: new Set(inPeriod.filter(isOperator).map((e) => e.actorId)).size,
    pipelineHealth: automated.length ? (automated.filter((e) => e.outcome !== 'failed').length / automated.length) * 100 : 100,
  };
}

export const activityService = {
  list: () => fromSource(() => store, '/activity'),
  actors: () => fromSource(() => actors, '/activity/actors'),
  summary: () => fromSource(() => summarize(store), '/activity/summary'),
};

/**
 * Appends an audit entry to the local demo store (called from other demo mutations, e.g. a
 * settings save). Timestamps continue the demo timeline (Oct 31, 2024 IST) so new entries sort first.
 */
let localSeq = 0;
export function recordActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'responseStatus' | 'origin'> & { origin?: string }): ActivityEntry {
  localSeq += 1;
  const minutes = 35 + localSeq; // 10:36, 10:37 … on the demo "today"
  const hh = String(10 + Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  const created: ActivityEntry = {
    ...entry,
    id: `EVT_LOCAL_${String(localSeq).padStart(3, '0')}`,
    timestamp: `2024-10-31T${hh}:${mm}:00`,
    responseStatus: 'Local demo store',
    origin: entry.origin ?? 'This browser (prototype session)',
  };
  store.unshift(created);
  return created;
}
