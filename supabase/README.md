# 대회 랭킹보드 백엔드 (Supabase)

단일 코스 대회 랭킹 + 서버측 점수 검증 + 어뷰징 방지 + 리플레이 보관.
**클라이언트는 scores 를 직접 쓸 수 없고**, `submit-score` Edge Function(service_role)만 기록한다.

## 구성
- `schema.sql` — 테이블·RLS·랭킹 RPC (`courses`, `scores`, `submissions`, `replays`, `ip_events`)
- `functions/submit-score/` — 점수 제출 Edge Function + 개연성 검증(`validate.ts`)

## 배포 순서

1. **Supabase 프로젝트 생성** (무료). Project URL 과 anon public key 확보.
2. **Auth 설정**: Authentication → Providers → **Email** 활성화. 이메일 OTP 로그인 사용.
   (Authentication → URL Configuration 에 게임 도메인 `https://levkim.github.io` 추가)
3. **스키마 적용**: SQL Editor 에 `schema.sql` 붙여넣고 실행. (대회 코스는 `courses` 시드 확인/조정)
4. **함수 시크릿 설정**:
   ```bash
   supabase secrets set \
     SB_URL=https://<ref>.supabase.co \
     SB_SERVICE_ROLE_KEY=<service_role_key> \
     SB_ANON_KEY=<anon_key> \
     IP_SALT=<임의의 긴 랜덤 문자열> \
     MAX_ATTEMPTS=5 IP_ACCOUNT_LIMIT=8
   ```
   > service_role 키는 **절대 클라이언트에 넣지 말 것**. 함수 시크릿에만.
5. **함수 배포**:
   ```bash
   supabase functions deploy submit-score
   ```
6. **게임 연결**: `src/config.ts` 의 `CONFIG.leaderboard` 에
   `enabled: true`, `supabaseUrl`, `anonKey` 를 채우고 커밋. (anon 키는 공개돼도 안전)

## 보안 모델 (실물 경품 대비)

- **직접 쓰기 차단**: RLS 로 anon/authenticated 의 scores INSERT/UPDATE 정책이 아예 없음 → 오직 Edge Function.
- **점수 재검사**: 클라가 보낸 점수를 믿지 않고, 함께 보낸 **주행 로그(시간·경로좌표·트릭)**를
  서버(`validate.ts`)가 물리적 개연성으로 검사 — 불가능한 시간/낙차/속도(순간이동)/트릭은 **거부**.
- **계정당 시도 제한**: `MAX_ATTEMPTS` 를 서버가 강제(수락된 제출 기준). 클라 우회 불가.
- **동일 IP 대량 계정**: IP 해시로 24h 내 계정 수를 세어 `IP_ACCOUNT_LIMIT` 초과 시 **flag**
  (공유 IP 오탐 방지를 위해 하드 거부 대신 수동검토 대상 표시).
- **리플레이 보관**: 모든 제출의 주행 로그를 `replays` 에 저장 → 상위 입상권은 사람이 검토.

### ⚠️ 한계 (반드시 인지)
개연성 검사는 **완전 재시뮬이 아니다.** 정상 범위 안에서 조작된 입력열이나 봇은 통과할 수 있다.
**경품 입상권은 자동 랭킹을 최종 확정으로 쓰지 말고, 아래 리플레이로 사람이 검토**한 뒤 확정할 것.
더 강한 방어가 필요하면 다음 단계로 "입력 로그 서버 재시뮬(물리엔진 Deno 포팅)"을 추가한다.

## 관리자: 상위 기록 리플레이 검토

SQL Editor(또는 service_role)로 상위 기록의 주행 로그 조회:
```sql
select s.nickname, s.overall, s.flagged, s.time_sec, s.top_speed, r.log
from scores s join replays r on r.score_id = s.id
where s.location_id = 'baekdu-cheonji' and s.verified
order by s.overall desc, s.created_at asc
limit 20;
```
- `flagged=true` (의심) 우선 검토. `r.log.trajectory` / `r.log.tricks` / `r.log.timeSec` 확인.
- 부정으로 판단되면 해당 행을 `verified=false` 로 내리면 랭킹에서 즉시 제외된다:
  ```sql
  update scores set verified=false where id='<score_id>';
  ```
