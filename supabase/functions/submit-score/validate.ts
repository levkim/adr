// 개연성(plausibility) 검증 — 순수 함수(Deno/Node 공용, 외부 의존 없음).
// 클라이언트가 보낸 점수를 그대로 믿지 않고, 함께 보낸 주행 로그가 물리적으로
// 말이 되는지 서버가 재검사한다. "불가능"이면 reject, "의심"이면 flag(수동검토).
//
// 주의: 이건 완전 재시뮬이 아니라 규칙 기반 개연성 검사다. 상위 입상권은 반드시
// replays 의 로그를 사람이 리플레이로 최종 검토해야 한다 (README 참고).

export interface Course {
  location_id: string;
  vertical_m: number;
  min_time_sec: number;
  max_time_sec: number;
  max_speed_ms: number;
}

export interface RunLogTrick {
  t: number;
  airtime: number;
  rotationDeg: number;
  landing: 'clean' | 'wobble' | 'crash';
  style: number;
}
export interface RunLog {
  timeSec: number;
  startAlt: number;
  finishAlt: number;
  topSpeed: number; // m/s
  crashes: number;
  sampleDt: number;
  trajectory: { x: number; z: number }[];
  tricks: RunLogTrick[];
}
export interface ClaimCard {
  overall: number;
  line: number;
  air: number;
  fluidity: number;
  control: number;
  timeSec: number;
  vertical: number;
  topSpeed: number; // km/h
  tricks: number;
  crashes: number;
  bestAir: number;
  bestRotation: number;
}

export interface VerifyResult {
  ok: boolean; // false → 거부
  reason?: string; // 거부 사유
  flags: string[]; // 의심 표식(수동검토 대상)
}

const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

export function validateSubmission(card: ClaimCard, log: RunLog, course: Course): VerifyResult {
  const flags: string[] = [];
  const bad = (reason: string): VerifyResult => ({ ok: false, reason, flags });

  // ── 형식/범위 기본 검사 ──
  if (!log || !Array.isArray(log.trajectory)) return bad('malformed_log');
  if (!num(log.timeSec) || !num(log.startAlt) || !num(log.finishAlt) || !num(log.sampleDt))
    return bad('malformed_log');
  if (![card.overall, card.line, card.air, card.fluidity, card.control].every(num))
    return bad('malformed_card');
  if (card.overall < 0 || card.overall > 100) return bad('score_out_of_range');
  for (const v of [card.line, card.air, card.fluidity, card.control]) {
    if (v < 0 || v > 100) return bad('subscore_out_of_range');
  }

  // ── 클라가 보낸 카드 vs 로그 일치 (조작 탐지) ──
  if (Math.abs(card.timeSec - log.timeSec) > 0.5) return bad('time_mismatch');
  if (Math.abs(card.crashes - log.crashes) > 0) flags.push('crash_count_mismatch');

  // ── 시간 개연성 ──
  if (log.timeSec < course.min_time_sec) return bad('time_too_fast');
  if (log.timeSec > course.max_time_sec) return bad('time_too_slow');
  if (log.sampleDt <= 0 || log.sampleDt > 2) return bad('bad_sample_dt');

  // ── 하강(고도) 개연성: 반드시 내려가야 하고, 낙차가 코스 범위 안 ──
  const drop = log.startAlt - log.finishAlt;
  if (drop <= 0) return bad('not_descending');
  if (drop > course.vertical_m * 1.25) return bad('vertical_exceeds_course');
  if (card.vertical > course.vertical_m * 1.25) return bad('claim_vertical_exceeds_course');

  // ── 속도 개연성: 구간 순간이동(텔레포트)·초과속도 차단 ──
  // 궤적은 ~sampleDt 간격 균일 샘플로 가정 → 구간 속도 = 거리 / sampleDt
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
  // 여유 20% — 샘플 경계 오차 감안. 그 이상이면 물리적으로 불가능 → 거부
  if (maxSegSpeed > course.max_speed_ms * 1.2) return bad('teleport_or_overspeed');
  if (log.topSpeed > course.max_speed_ms * 1.2) return bad('top_speed_impossible');
  if (card.topSpeed / 3.6 > course.max_speed_ms * 1.25) return bad('claim_top_speed_impossible');

  // 궤적이 커버한 시간(대략) vs 신고 시간: 샘플수*dt 가 신고시간과 크게 어긋나면 조작
  const trajSeconds = (traj.length - 1) * log.sampleDt;
  if (trajSeconds > log.timeSec * 1.6 + 3) return bad('trajectory_time_mismatch');
  if (trajSeconds < log.timeSec * 0.3) flags.push('sparse_trajectory');

  // 경로가 비정상적으로 길면(왕복/맴돌기) 의심
  const straight = Math.hypot(
    traj[traj.length - 1].x - traj[0].x,
    traj[traj.length - 1].z - traj[0].z,
  );
  if (straight > 1 && pathLen > straight * 6) flags.push('path_too_winding');

  // ── 트릭/스타일 일관성 ──
  const tricks = Array.isArray(log.tricks) ? log.tricks : [];
  const landedTricks = tricks.filter((t) => t.landing !== 'crash').length;
  if (card.air > 15 && landedTricks === 0) return bad('air_score_without_tricks');
  if (card.tricks > landedTricks + 1) flags.push('trick_count_mismatch');
  const maxAir = tricks.reduce((m, t) => Math.max(m, t.airtime), 0);
  if (maxAir > 12) return bad('airtime_impossible'); // 12초 체공은 불가능
  if (card.bestAir > maxAir + 0.5 && card.air > 0) flags.push('best_air_mismatch');

  return { ok: true, flags };
}
