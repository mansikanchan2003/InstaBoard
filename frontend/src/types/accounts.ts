/**
 * Instagram Accounts screens (overview, connect flow, account detail).
 * Shapes mirror what a FastAPI backend would return for account telemetry / sync audit endpoints.
 */
import type { AccountType, ID } from './domain';

/* --------------------------------- Scopes ---------------------------------- */

export interface ScopeDefinition {
  scope: string;
  /** Required for the core analytics features (shown as "Mandatory" in the connect flow). */
  mandatory: boolean;
  /** Copy used in the connect flow disclosure. */
  connectDescription: string;
  /** Copy used on the account detail scopes grid. */
  detailDescription: string;
}

export type ScopeGrantStatus = 'approved' | 'missing' | 'revoked' | 'not_requested';

export interface ScopeGrant {
  scope: string;
  status: ScopeGrantStatus;
}

/* ------------------------------ Summary / policy ---------------------------- */

export interface AccountsSummaryMeta {
  /** Auto-scheduled cadence label ("Every 6 hours"). */
  cadenceLabel: string;
  apiHealthPercent: number;
  apiHealthLabel: string;
  apiCallsUsed: number;
  apiCallsLimit: number;
  graphApiVersion: string;
}

export interface RetentionPolicyRow {
  label: string;
  value: string;
}

/* -------------------------------- Telemetry -------------------------------- */

export type TileTone = 'active' | 'ai' | 'info' | 'warning' | 'neutral' | 'error';

export interface TelemetryTile {
  key: 'media' | 'audience' | 'comments' | 'quota';
  label: string;
  badge: { label: string; tone: TileTone; icon?: string };
  value: string;
  caption: string;
  footLabel?: string;
  footValue?: string;
  footTone?: 'active' | 'neutral' | 'error' | 'warning';
  /** 0-100, renders a progress bar instead of the foot row. */
  progress?: number;
}

export type CapabilityStatus = 'available' | 'partial' | 'permission_required' | 'unavailable';

export interface CapabilityRow {
  key: string;
  category: string;
  icon: string;
  iconClassName?: string;
  endpoints: string;
  status: CapabilityStatus;
  lastUpdated: string | null;
  note: string;
  /** Optional scope rendered as inline code after the note. */
  noteScope?: string;
}

export type HealthTone = 'active' | 'warning' | 'error';

export interface AccountTelemetry {
  accountId: ID;
  lastSync: { label: string; detail?: string };
  cadence: { label: string; detail?: string };
  token: { label: string; detail: string; tone: HealthTone };
  tiles: TelemetryTile[];
  capabilities: CapabilityRow[];
  scopes: ScopeGrant[];
  tokenFooter: { title: string; body: string; tone: HealthTone };
  /** Total runs recorded for this account in the demo audit log (may exceed the rows bundled). */
  totalSyncRuns: number;
}

/* --------------------------------- Sync log -------------------------------- */

export type SyncTrigger = 'scheduled' | 'manual' | 'webhook' | 'token_refresh';
export type SyncRunStatus = 'success' | 'partial' | 'failed';

export interface SyncLogEntry {
  id: ID;
  accountId: ID;
  /** ISO datetime (IST offset) used for sorting. */
  executedAt: string;
  /** Display label as designed: "Oct 31, 2024, 10:18:14 IST". */
  executedLabel: string;
  trigger: SyncTrigger;
  triggerLabel: string;
  durationSec: number | null;
  media: number;
  comments?: number;
  status: SyncRunStatus;
  statusLabel: string;
  /** Sample response payload shown in the "view_json" dialog. */
  raw: Record<string, unknown>;
}

/* ------------------------------- Connect flow ------------------------------ */

export type ConnectCandidateOutcome = 'ready' | 'insufficient_permissions' | 'personal' | 'already_linked';

/** Sample Instagram accounts offered in the connect-flow demo walkthrough (never real Meta data). */
export interface ConnectCandidate {
  id: ID;
  displayName: string;
  handle: string;
  type: AccountType | 'personal';
  facebookPage: string | null;
  followers: number;
  outcome: ConnectCandidateOutcome;
  outcomeNote: string;
}

export interface ConnectPrerequisite {
  id: string;
  label: string;
}
