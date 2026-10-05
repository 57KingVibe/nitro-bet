import { API_BASE_URL } from './config';

// ---------- session token ----------
// Kept in localStorage so a refresh does not log you out. Wrapped in try/catch: some private modes block storage.
const TOKEN_KEY = 'nitro_token';
export const getToken = (): string | null => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t: string): void => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };
export const clearToken = (): void => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

// ---------- types (mirror the API) ----------
export interface Outcome { id: string; label: string; odds: string; oddsCenti: number }
export interface Market { id: string; title: string; sport: string; status: string; closesAt: string | null; outcomes: Outcome[] }
export interface Profile {
  id: string; email: string; displayName: string; currency: string; realMoney: boolean;
  balanceMinor: number; balance: string; ghostMode: boolean; selfExcludedUntil: string | null;
}
export interface WagerRow {
  id: string; marketTitle: string; outcomeLabel: string; stake: string; odds: string; potentialPayout: string;
  status: 'open' | 'won' | 'lost' | 'void'; createdAt: string; settledAt: string | null;
}
export interface LedgerEntry { id: number; kind: string; currency: string; amount: string; amountMinor: number; createdAt: string }
export interface LeaderboardEntry { rank: number; name: string; net: string; netMinor: number; predictions: number }
export interface Leaderboard { period: 'week' | 'all'; endsAt: string | null; prizesEnabled: boolean; minSettled: number; entries: LeaderboardEntry[] }
export interface MyRank { period: string; ranked: boolean; rank?: number; net?: string; predictions?: number }
export interface AuthResult { token: string; player: { id: string; email: string; displayName: string } }

// ---------- errors ----------
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: { path: string; message: string }[];
  currentOddsCenti?: number;
  constructor(status: number, message: string, extra: { code?: string; details?: { path: string; message: string }[]; currentOddsCenti?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    Object.assign(this, extra);
  }
}

/** True when the token is missing, wrong or expired, so the user must sign in again. */
export const isSessionError = (e: unknown): boolean =>
  e instanceof ApiError && (e.status === 401 || (e.status === 403 && /token/i.test(e.message)));

/** Plain-language text for any failure. */
export function friendlyError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (e.code) {
    case 'NETWORK': return e.message;
    case 'UNDERAGE': return 'You must be 18 or older to join.';
    case 'EMAIL_TAKEN': return 'That email already has an account. Try signing in.';
    case 'BAD_CREDENTIALS': return 'Wrong email or password.';
    case 'VALIDATION': return e.details?.[0]?.message ? `Check your details: ${e.details[0].message}` : 'Please check what you entered.';
    case 'INSUFFICIENT_FUNDS': return 'Not enough points.';
    case 'ODDS_CHANGED': return 'The odds changed. Check the new price and confirm again.';
    case 'MARKET_CLOSED': return 'This market just closed.';
    case 'MARKET_FINISHED': return 'This market has finished.';
    default: return e.message || 'Something went wrong. Please try again.';
  }
}

// ---------- requests ----------
interface Opts { method?: string; body?: unknown; auth?: boolean; timeoutMs?: number }

async function request<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth) { const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`; }

  const ctrl = new AbortController();
  // 60s: a sleeping free-tier server can take close to a minute to wake up
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? 'GET', headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || data?.error || `Request failed (${res.status})`,
      { code: data?.code, details: data?.details, currentOddsCenti: data?.currentOddsCenti });
  }
  return data as T;
}

export const api = {
  markets: () => request<{ markets: Market[] }>('/api/markets'),
  leaderboard: (period: 'week' | 'all') => request<Leaderboard>(`/api/leaderboard?period=${period}`),
  myRank: (period: 'week' | 'all') => request<MyRank>(`/api/leaderboard/me?period=${period}`, { auth: true }),
  register: (b: { email: string; password: string; displayName: string; dateOfBirth: string }) =>
    request<AuthResult>('/api/auth/register', { method: 'POST', body: b }),
  login: (b: { email: string; password: string }) => request<AuthResult>('/api/auth/login', { method: 'POST', body: b }),
  me: () => request<Profile>('/api/me', { auth: true }),
  ledger: () => request<{ entries: LedgerEntry[] }>('/api/me/ledger', { auth: true }),
  wagers: () => request<{ wagers: WagerRow[] }>('/api/wagers', { auth: true }),
  placeWager: (b: { outcomeId: string; stake: number | string; acceptedOdds: string; idempotencyKey: string }) =>
    request<{ balance: string; replayed: boolean }>('/api/wagers', { method: 'POST', body: b, auth: true }),
  setGhostMode: (ghostMode: boolean) => request<{ ghostMode: boolean }>('/api/me/settings', { method: 'PATCH', body: { ghostMode }, auth: true }),
};

/** "1234.5" -> "1,234.50" */
export const fmtPts = (s: string | number): string =>
  Number(s).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
