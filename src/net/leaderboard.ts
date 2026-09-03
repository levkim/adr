import { CONFIG } from '../config';
import type { RunLog } from '../scoring/run';
import type { ScoreCard } from '../scoring/run';

// Supabase 랭킹보드 클라이언트 (fetch 기반, SDK 의존 없음).
// 이메일 OTP 로그인 → submit-score Edge Function 제출 → 랭킹 RPC 읽기.
// 백엔드 미배포(enabled:false) 시 isEnabled()=false 로 게임에 영향 없음.

const SESSION_KEY = 'tournski_sb_session';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch sec
  email: string;
}

export interface LeaderRow {
  rank: number;
  nickname: string;
  name_masked: string; // 서버 마스킹 이름 (예: 홍**)
  email_masked: string; // 서버 마스킹 이메일 (예: j***@gmail.com)
  overall: number;
  created_at: string;
  is_me: boolean;
}

export interface SubmitResult {
  accepted: boolean;
  improved: boolean;
  best: number;
  rank: number;
  total: number;
  flagged: boolean;
  attemptsUsed: number;
  maxAttempts: number;
}

export function isEnabled(): boolean {
  const l = CONFIG.leaderboard;
  return !!(l.enabled && l.supabaseUrl && l.anonKey);
}

// ── 세션 저장/로드 ──
function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function saveSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isLoggedIn(): boolean {
  return !!loadSession();
}
export function currentEmail(): string | null {
  return loadSession()?.email ?? null;
}
export function signOut(): void {
  saveSession(null);
}

function base(): string {
  return CONFIG.leaderboard.supabaseUrl.replace(/\/$/, '');
}
function authHeaders(token?: string): Record<string, string> {
  return {
    apikey: CONFIG.leaderboard.anonKey,
    Authorization: `Bearer ${token ?? CONFIG.leaderboard.anonKey}`,
    'content-type': 'application/json',
  };
}

// ── 이메일 OTP ──
export async function sendOtp(email: string): Promise<void> {
  const res = await fetch(`${base()}/auth/v1/otp`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      msg?: string;
      error_description?: string;
      error?: string;
      code?: string;
    };
    const reason = j.msg || j.error_description || j.error || j.code || `HTTP ${res.status}`;
    throw new Error(`인증코드 전송 실패: ${reason}`);
  }
}

export async function verifyOtp(email: string, token: string): Promise<void> {
  const res = await fetch(`${base()}/auth/v1/verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type: 'email', email, token }),
  });
  if (!res.ok) throw new Error('인증코드가 올바르지 않습니다');
  const j = await res.json();
  saveSession({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
    email,
  });
}

// 만료 임박 시 리프레시 후 유효 토큰 반환 (없으면 null)
async function ensureToken(): Promise<string | null> {
  const s = loadSession();
  if (!s) return null;
  if (s.expires_at - 30 > Math.floor(Date.now() / 1000)) return s.access_token;
  try {
    const res = await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) {
      saveSession(null);
      return null;
    }
    const j = await res.json();
    saveSession({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
      email: s.email,
    });
    return j.access_token as string;
  } catch {
    return null;
  }
}

// ── 점수 제출 (Edge Function) ──
export async function submitScore(payload: {
  locationId: string;
  nickname: string;
  name?: string; // 경품 연락용(비공개)
  phone?: string; // 경품 연락용(비공개)
  card: ScoreCard;
  log: RunLog;
  clientVersion?: string;
}): Promise<SubmitResult> {
  const token = await ensureToken();
  if (!token) throw new Error('로그인이 필요합니다');
  const res = await fetch(`${base()}/functions/v1/submit-score`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (j.error === 'attempt_limit') throw new Error('시도 횟수를 모두 사용했습니다');
    if (j.error === 'rejected') throw new Error(`검증 거부: ${j.reason ?? ''}`);
    throw new Error(j.error ? `제출 실패: ${j.error}` : `제출 실패 (${res.status})`);
  }
  return j as SubmitResult;
}

// ── 랭킹 읽기 (RPC) ──
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const token = (await ensureToken()) ?? undefined;
  const res = await fetch(`${base()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`랭킹 조회 실패 (${res.status})`);
  return (await res.json()) as T;
}

export function getTop(locationId: string, limit = CONFIG.leaderboard.topLimit): Promise<LeaderRow[]> {
  return rpc<LeaderRow[]>('get_leaderboard', { p_location: locationId, p_limit: limit });
}
export function getMyRank(
  locationId: string,
  around = CONFIG.leaderboard.aroundMe,
): Promise<LeaderRow[]> {
  return rpc<LeaderRow[]>('get_my_rank', { p_location: locationId, p_around: around });
}
