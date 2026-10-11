import { config } from '@/lib/config';
import { ApiNotFoundError } from './errors';

/**
 * HTTP client for the InstaBoard FastAPI backend (used when VITE_DATA_SOURCE=api).
 * In demo mode (the default) nothing calls this, so the prototype makes no network requests.
 *
 * Errors are surfaced, never swallowed: there is no fallback to demo data after an API failure,
 * because that would show stale numbers as if they came from the database.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Machine-readable code from the backend error envelope, e.g. "not_available". */
    public readonly code?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Backend error envelope: {"error": {"code", "message", "details"}}. */
export type ApiErrorBody = { error?: { code?: string; message?: string; details?: unknown } };

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * CSRF token for the current session (from POST /auth/login or GET /auth/me). Kept in memory only —
 * never in localStorage/sessionStorage — and sent as `X-CSRF-Token` on state-changing requests.
 * The session itself lives in an HttpOnly cookie the browser attaches automatically.
 */
let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

/** Fired when the API answers 401 (no / expired / revoked session). `AuthProvider` listens. */
export const UNAUTHORIZED_EVENT = 'instaboard:unauthorized';

async function request<T>(method: Method, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(init?.headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiError(`Cannot reach the InstaBoard API at ${config.apiBaseUrl}. Is the backend running?`, 0, 'network_error');
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const envelope = (data as ApiErrorBody | undefined)?.error;
    const message = envelope?.message ?? `Request failed: ${method} ${path} (${res.status})`;
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/invitations')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { code: envelope?.code, message } }));
    }
    // 404 → NotFoundError subclass so screens show their designed "not found" state.
    if (res.status === 404) throw new ApiNotFoundError(message, envelope?.code);
    throw new ApiError(message, res.status, envelope?.code, data);
  }
  return (res.status === 204 ? undefined : data) as T;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
