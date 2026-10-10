/** Activity Log & Audit Trail entities (owned by the Activity screen). */

export type ActivityCategory = 'data_sync' | 'campaigns' | 'content' | 'ai' | 'reports' | 'leads' | 'security' | 'settings';

/** Outcome of an audited event. `resolved` = a warning that recovered / was addressed. */
export type ActivityOutcome = 'success' | 'in_progress' | 'warning' | 'failed' | 'resolved';

export type ActorKind = 'member' | 'system' | 'ai';

export interface ActivityActor {
  id: string;
  kind: ActorKind;
  /** Full display name, e.g. "Priya Sharma" or "System / Graph API". */
  name: string;
  /** Short row label, e.g. "Operator: Priya S.". */
  shortLabel: string;
  /** Material icon for system / AI actors. */
  icon?: string;
  email?: string;
  role?: string;
}

export interface ActivityTarget {
  /** Monospace chip label, e.g. "#REP-2024-884". */
  label: string;
  /** In-app route the entity opens at. */
  to?: string;
  /** Human-readable module name used for the "Open related module" button. */
  module?: string;
  emphasis?: 'warning' | 'strong';
}

export interface ActivityDiff {
  field: string;
  before: string;
  after: string;
}

export interface ActivityEntry {
  id: string;
  /** IST wall-clock timestamp, "YYYY-MM-DDTHH:mm:ss" (no offset; everything in the log is IST). */
  timestamp: string;
  category: ActivityCategory;
  /** Event-type pill label, e.g. "Report Generated". */
  kind: string;
  kindIcon: string;
  kindTone: 'neutral' | 'ai' | 'warning';
  /** Colour class for the pill icon when tone is neutral. */
  kindIconClass?: string;
  title: string;
  titleTag?: { label: string; tone: 'ai' | 'warning' };
  /** One-line summary shown in the table. */
  summary: string;
  /** Longer narrative for the detail modal. */
  narrative: string;
  target: ActivityTarget;
  actorId: string;
  accountId?: string;
  outcome: ActivityOutcome;
  /** Optional outcome pill override, e.g. "Success (4.2s)". */
  outcomeLabel?: string;
  /** e.g. "200 OK (0.34s)". */
  responseStatus: string;
  /** Origin descriptor (demo values use the documentation IP range). */
  origin: string;
  payload: Record<string, unknown>;
  diff?: ActivityDiff[];
}

export interface ActivitySummary {
  total: number;
  previousPeriodTotal: number;
  automated: number;
  operator: number;
  issues: number;
  issuesAddressed: number;
  activeOperators: number;
  pipelineHealth: number;
}
