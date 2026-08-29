// Supabase Edge Function (Deno) — 대회 점수 제출 + 서버측 검증. (자체 완결 단일 파일)
// 배포: 대시보드 Edge Functions 에 이 파일 하나만 붙여넣거나 `supabase functions deploy submit-score`.
// (로컬 tsc 대상 아님 — Deno 런타임 전용)
//
// 이 함수만 service_role 로 scores 에 쓸 수 있다(RLS). 클라는 직접 못 쓴다.
// 하는 일: 인증 확인 → 계정당 시도횟수 강제 → 동일IP 대량계정 감지 → 개연성 검증
//          → 리플레이 보관 → 최고점 upsert → 순위 반환.
//
// 필요한 함수 시크릿(supabase secrets set 또는 대시보드 Secrets):
//   SB_URL, SB_SERVICE_ROLE_KEY, SB_ANON_KEY, IP_SALT,
//   MAX_ATTEMPTS(기본5), IP_ACCOUNT_LIMIT(기본8)

// @ts-nocheck  (Deno + 원격 import — 로컬 TypeScript 검사 비대상)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// 개연성(plausibility) 검증 — 클라 점수를 믿지 않고 주행 로그로 서버가 재검사.
// "불가능"이면 reject, "의심"이면 flag(수동검토). 완전 재시뮬 아님 → 상위는 리플레이 검토.
// ============================================================================
interface Course {
  location_id: string;
  vertical_m: number;
  min_time_sec: number;
  max_time_sec: number;
  max_speed_ms: number;
}
interface RunLogTrick {
  t: number;
  airtime: number;
  rotationDeg: number;
  landing: 'clean' | 'wobble' | 'crash';
  style: number;
}
interface RunLog {
  timeSec: number;
  startAlt: number;
  finishAlt: number;
  topSpeed: number;
  crashes: number;
  sampleDt: number;
  trajectory: { x: number; z: number }[];
  tricks: RunLogTrick[];
}
interface ClaimCard {
  overall: number;
  line: number;
  air: number;
  fluidity: number;
  control: number;
  timeSec: number;
  vertical: number;
  topSpeed: number;
  tricks: number;
  crashes: number;
  bestAir: number;
  bestRotation: number;
}
interface VerifyResult {
  ok: boolean;
  reason?: string;
  flags: string[];
}

const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

function validateSubmission(card: ClaimCard, log: RunLog, course: Course): VerifyResult {
  const flags: string[] = [];
  const bad = (reason: string): VerifyResult => ({ ok: false, reason, flags });

  if (!log || !Array.isArray(log.trajectory)) return bad('malformed_log');
  if (!num(log.timeSec) || !num(log.startAlt) || !num(log.finishAlt) || !num(log.sampleDt))
    return bad('malformed_log');
  if (![card.overall, card.line, card.air, card.fluidity, card.control].every(num))
    return bad('malformed_card');
  if (card.overall < 0 || card.overall > 100) return bad('score_out_of_range');
  for (const v of [card.line, card.air, card.fluidity, card.control]) {
    if (v < 0 || v > 100) return bad('subscore_out_of_range');
  }

  // 카드 vs 로그 일치 (조작 탐지)
  if (Math.abs(card.timeSec - log.timeSec) > 0.5) return bad('time_mismatch');
  if (Math.abs(card.crashes - log.crashes) > 0) flags.push('crash_count_mismatch');

  // 시간 개연성
  if (log.timeSec < course.min_time_sec) return bad('time_too_fast');
  if (log.timeSec > course.max_time_sec) return bad('time_too_slow');
  if (log.sampleDt <= 0 || log.sampleDt > 2) return bad('bad_sample_dt');

  // 하강 개연성
  const drop = log.startAlt - log.finishAlt;
  if (drop <= 0) return bad('not_descending');
  if (drop > course.vertical_m * 1.25) return bad('vertical_exceeds_course');
  if (card.vertical > course.vertical_m * 1.25) return bad('claim_vertical_exceeds_course');

  // 속도 개연성 (구간 순간이동/초과속도 차단)
  const traj = log.trajectory;
  if (traj.length < 3) return bad('trajectory_too_short');
  let pathLen = 0;
  let maxSeg = 0;
  for (let i = 1; i < traj.length; i++) {
    const a = traj[i - 1];
    const b = traj[i];
    if (!num(a?.x) || !num(a?.z) || !num(b?.x) || !num(b?.z)) return bad('malformed_trajectory');
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    pathLen += d;
    if (d > maxSeg) maxSeg = d;
  }
  const maxSegSpeed = maxSeg / log.sampleDt;
  if (maxSegSpeed > course.max_speed_ms * 1.2) return bad('teleport_or_overspeed');
  if (log.topSpeed > course.max_speed_ms * 1.2) return bad('top_speed_impossible');
  if (card.topSpeed / 3.6 > course.max_speed_ms * 1.25) return bad('claim_top_speed_impossible');

  const trajSeconds = (traj.length - 1) * log.sampleDt;
  if (trajSeconds > log.timeSec * 1.6 + 3) return bad('trajectory_time_mismatch');
  if (trajSeconds < log.timeSec * 0.3) flags.push('sparse_trajectory');

  const straight = Math.hypot(
    traj[traj.length - 1].x - traj[0].x,
    traj[traj.length - 1].z - traj[0].z,
  );
  if (straight > 1 && pathLen > straight * 6) flags.push('path_too_winding');

  // 트릭/스타일 일관성
  const tricks = Array.isArray(log.tricks) ? log.tricks : [];
  const landedTricks = tricks.filter((t) => t.landing !== 'crash').length;
  if (card.air > 15 && landedTricks === 0) return bad('air_score_without_tricks');
  if (card.tricks > landedTricks + 1) flags.push('trick_count_mismatch');
  const maxAir = tricks.reduce((m, t) => Math.max(m, t.airtime), 0);
  if (maxAir > 12) return bad('airtime_impossible');
  if (card.bestAir > maxAir + 0.5 && card.air > 0) flags.push('best_air_mismatch');

  return { ok: true, flags };
}

// ============================================================================
// HTTP 핸들러
// ============================================================================
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // 인증: 전달된 유저 JWT 로 본인 확인
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SB_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

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

  const { data: course } = await admin
    .from('courses')
    .select('*')
    .eq('location_id', locationId)
    .eq('active', true)
    .maybeSingle();
  if (!course) return json({ error: 'course_inactive' }, 400);

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

  // 계정당 시도 횟수 강제 (accepted 기준)
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

  const verdict = validateSubmission(card, log, course);
  const flags = [...verdict.flags];

  // 동일 IP 대량 계정 감지 → flag (오탐 방지 위해 하드거부 대신 수동검토)
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

  const { data: replay } = await admin
    .from('replays')
    .insert({ user_id: user.id, location_id: locationId, overall: card.overall, log })
    .select('id')
    .single();

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

  const bestOverall = improved ? card.overall : (existing?.overall ?? card.overall);
  const { count: total } = await admin
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('verified', true);
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
