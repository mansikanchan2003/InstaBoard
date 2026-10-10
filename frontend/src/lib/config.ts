/** Runtime configuration read from Vite env vars (see .env.example). No secrets belong here. */
export type DataSource = 'demo' | 'api';

export const config = {
  /** `npm run dev:api` (Vite mode "api") or VITE_DATA_SOURCE=api selects the FastAPI backend; demo is the default. */
  dataSource: (import.meta.env.VITE_DATA_SOURCE === 'api' || import.meta.env.MODE === 'api' ? 'api' : 'demo') as DataSource,
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8100/api/v1',
  /** Simulated latency for demo responses so loading states are visible but brief. */
  demoLatencyMs: import.meta.env.MODE === 'test' ? 0 : 250,
} as const;

export const isDemoMode = config.dataSource === 'demo';

/** Copy that depends on where changes are persisted (browser demo store vs the FastAPI/PostgreSQL backend). */
export function modeText(demo: string, api: string): string {
  return config.dataSource === 'api' ? api : demo;
}
