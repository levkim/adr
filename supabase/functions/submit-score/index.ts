// Supabase Edge Function (Deno) — 대회 점수 제출 + 서버측 검증.
// 배포: `supabase functions deploy submit-score`  (로컬 tsc 대상 아님 — Deno 런타임 전용)
//
// 이 함수만 service_role 로 scores 에 쓸 수 있다(RLS). 클라는 직접 못 쓴다.
// 하는 일: 인증 확인 → 계정당 시도횟수 강제 → 동일IP 대량계정 감지 → 개연성 검증
//          → 리플레이 보관 → 최고점 upsert → 순위 반환.
//
// 필요한 함수 시크릿(supabase secrets set):
//   SB_URL, SB_SERVICE_ROLE_KEY, SB_ANON_KEY, IP_SALT,
//   MAX_ATTEMPTS(기본5), IP_ACCOUNT_LIMIT(기본8)

// @ts-nocheck  (Deno + 원격 import — 로컬 TypeScript 검사 비대상)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateSubmission } from './validate.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SB_URL = env('SB_URL');
  const SERVICE = env('SB_SERVICE_ROLE_KEY');
  const ANON = env('SB_ANON_KEY');
  const MAX_ATTEMPTS = Number(env('MAX_ATTEMPTS', '5'));
  const IP_ACCOUNT_LIMIT = Number(env('IP_ACCOUNT_LIMIT', '8'));
  if (!SB_URL || !SERVICE || !ANON) return json({ error: 'server_misconfigured' }, 500);

  // ── 인증: 전달된 유저 JWT 로 본인 확인 ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SB_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

  // ── 입력 ──
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const locationId = String(body.locationId ?? '');
  const nickname = String(body.nickname ?? '').trim().slice(0, 20);
  const card = body.card;
  const log = body.log;
  const clientVersion = String(body.clientVersion ?? '').slice(0, 40);
  if (!locationId || !nickname || !card || !log) return json({ error: 'missing_fields' }, 400);

  const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

  // ── 코스(서버측 검증 기준) 로드 ──
  const { data: course } = await admin
    .from('courses')
    .select('*')
    .eq('location_id', locationId)
    .eq('active', true)
    .maybeSingle();
  if (!course) return json({ error: 'course_inactive' }, 400);

  // ── IP 해시 + 이벤트 기록 ──
  const ipRaw = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256(ipRaw + '|' + env('IP_SALT', 'salt'));
  await admin.from('ip_events').insert({ ip_hash: ipHash, user_id: user.id, event: 'submit' });

  const logRejected = (reason: string) =>
    admin.from('submissions').insert({
      user_id: user.id,
      location_id: locationId,
      overall: typeof card?.overall === 'number' ? card.overall : null,
      accepted: false,
      reject_reason: reason,
      ip_hash: ipHash,
    });

  // ── 계정당 시도 횟수 강제 (accepted 기준) ──
  const { count: acceptedCount } = await admin
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .eq('accepted', true);
  if ((acceptedCount ?? 0) >= MAX_ATTEMPTS) {
    await logRejected('attempt_limit');
    return json({ error: 'attempt_limit', maxAttempts: MAX_ATTEMPTS }, 429);
  }

  // ── 개연성 검증 ──
  const verdict = validateSubmission(card, log, course);
  const flags = [...verdict.flags];

  // ── 동일 IP 대량 계정 감지 → flag (오탐 방지 위해 하드거부 대신 수동검토) ──
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: ipUsers } = await admin
    .from('ip_events')
    .select('user_id')
    .eq('ip_hash', ipHash)
    .gte('created_at', dayAgo);
  const distinctUsers = new Set((ipUsers ?? []).map((r: any) => r.user_id)).size;
  if (distinctUsers > IP_ACCOUNT_LIMIT) flags.push('ip_many_accounts');

  if (!verdict.ok) {
    await logRejected(verdict.reason ?? 'invalid');
    return json({ error: 'rejected', reason: verdict.reason }, 422);
  }

  const flagged = flags.length > 0;

  // ── 리플레이 보관 (수동 검토용) ──
  const { data: replay } = await admin
    .from('replays')
    .insert({ user_id: user.id, location_id: locationId, overall: card.overall, log })
    .select('id')
    .single();

  // ── 최고점 upsert (개선됐을 때만 갱신, created_at=달성시각) ──
  const { data: existing } = await admin
    .from('scores')
    .select('id, overall')
    .eq('user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle();

  const improved = !existing || card.overall > existing.overall;
  let scoreId = existing?.id ?? null;
  if (improved) {
    const row = {
      user_id: user.id,
      location_id: locationId,
      nickname,
      overall: card.overall,
      line: card.line,
      air: card.air,
      fluidity: card.fluidity,
      control: card.control,
      time_sec: card.timeSec,
      vertical: card.vertical,
      top_speed: card.topSpeed,
      tricks: card.tricks,
      crashes: card.crashes,
      best_air: card.bestAir,
      best_rotation: card.bestRotation,
      client_version: clientVersion,
      verified: true,
      flagged,
      created_at: new Date().toISOString(),
    };
    const { data: up } = await admin
      .from('scores')
      .upsert(row, { onConflict: 'user_id,location_id' })
      .select('id')
      .single();
    scoreId = up?.id ?? scoreId;
  }
  if (replay?.id && scoreId) {
    await admin.from('replays').update({ score_id: scoreId }).eq('id', replay.id);
  }

  await admin.from('submissions').insert({
    user_id: user.id,
    location_id: locationId,
    overall: card.overall,
    accepted: true,
    reject_reason: flagged ? 'flagged:' + flags.join(',') : null,
    ip_hash: ipHash,
  });

  // ── 순위 계산 (verified 기준, 동점은 먼저 기록 우선) ──
  const bestOverall = improved ? card.overall : (existing?.overall ?? card.overall);
  const { count: total } = await admin
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('verified', true);
  // 내 최고점보다 높은 사람 수 + 1 = 순위 (동점 tie-break 는 대략치, 정확 순위는 RPC 로)
  const { count: above } = await admin
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('verified', true)
    .gt('overall', bestOverall);

  return json({
    accepted: true,
    improved,
    best: bestOverall,
    rank: (above ?? 0) + 1,
    total: total ?? 1,
    flagged,
    attemptsUsed: (acceptedCount ?? 0) + 1,
    maxAttempts: MAX_ATTEMPTS,
  });
});
