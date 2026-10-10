import type { AccountType } from '@/types/domain';

export type ConnectStep = 1 | 2 | 3 | 4;

export interface ConnectFormState {
  prerequisites: string[];
  accountType: AccountType | null;
  /** User clicked "Continue with Facebook / Meta Login" and saw that it's unavailable. */
  authAttempted: boolean;
  /** User chose the clearly-labelled demo walkthrough instead of real OAuth. */
  demoMode: boolean;
  candidateId: string | null;
  includeOptionalScopes: boolean;
  scopesAcknowledged: boolean;
  cadence: string;
  backfill: string;
}

export const initialConnectState: ConnectFormState = {
  prerequisites: [],
  accountType: null,
  authAttempted: false,
  demoMode: false,
  candidateId: null,
  includeOptionalScopes: true,
  scopesAcknowledged: false,
  cadence: 'Every 6 hours',
  backfill: 'Last 90 days',
};

export const cadenceOptions = ['Every 6 hours', 'Every 12 hours', 'Daily at 04:00 IST'];
export const backfillOptions = ['Last 30 days', 'Last 90 days', 'Last 12 months'];

export const connectSteps: Array<{ step: ConnectStep; label: string }> = [
  { step: 1, label: 'Requirements' },
  { step: 2, label: 'Meta Authorization' },
  { step: 3, label: 'Scopes & Permissions' },
  { step: 4, label: 'Confirmation' },
];
