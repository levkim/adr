-- ============================================================================
-- Freeride Powder Hunter — 대회 랭킹보드 스키마 (Supabase / Postgres)
-- 실행: Supabase 대시보드 SQL Editor 에 붙여넣고 실행하거나 `supabase db push`.
--
-- 보안 핵심:
--  * 클라이언트(anon/authenticated)는 scores 를 절대 직접 쓸 수 없다 (INSERT/UPDATE 정책 없음).
--    점수 기록은 오직 submit-score Edge Function(service_role)만 수행 → 클라 값 조작 차단.
--  * 리더보드 읽기는 SECURITY DEFINER RPC 로만 (이메일 등 민감정보 비노출).
--  * 이메일은 auth.users 에만 있고 scores 에 복제하지 않는다 → 리더보드로 새지 않음.
-- ============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ── 코스(대회) 서버측 파라미터: 검증 기준을 서버가 소유한다 (클라를 믿지 않음) ──
create table if not exists public.courses (
  location_id   text primary key,
  name          text not null,
  vertical_m    real not null,           -- 실제 낙차(m)
  min_time_sec  real not null default 15, -- 이보다 빠르면 불가능 → 거부
  max_time_sec  real not null default 900,
  max_speed_ms  real not null default 45, -- 구간 최고속도 상한(m/s) — 순간이동 차단
  west  double precision, south double precision,
  east  double precision, north double precision,
  active boolean not null default true
);

-- 대회 코스 시드 (백두산 천지) — 게임 locations.ts / meta 와 일치시켜 조정
insert into public.courses (location_id, name, vertical_m, min_time_sec, max_time_sec, max_speed_ms, west, south, east, north, active)
values ('baekdu-cheonji', '백두산 천지', 546, 15, 900, 45, 128.058, 41.98, 128.095, 42.02, true)
on conflict (location_id) do update set
  name=excluded.name, vertical_m=excluded.vertical_m, min_time_sec=excluded.min_time_sec,
  max_time_sec=excluded.max_time_sec, max_speed_ms=excluded.max_speed_ms,
  west=excluded.west, south=excluded.south, east=excluded.east, north=excluded.north, active=excluded.active;

-- ── 최고 점수 (유저·코스당 1행) ──
create table if not exists public.scores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  location_id   text not null references public.courses(location_id),
  nickname      text not null,
  name          text, -- 경품 연락용(비공개, 랭킹 RPC로 노출 안 함)
  phone         text, -- 경품 연락용(비공개)
  overall       real not null,
  line          real not null default 0,
  air           real not null default 0,
  fluidity      real not null default 0,
  control       real not null default 0,
  time_sec      real not null default 0,
  vertical      real not null default 0,
  top_speed     real not null default 0,
  tricks        int  not null default 0,
  crashes       int  not null default 0,
  best_air      real not null default 0,
  best_rotation int  not null default 0,
  client_version text,
  verified      boolean not null default false, -- 개연성 검증 통과
  flagged       boolean not null default false, -- 의심(수동 검토 필요)
  created_at    timestamptz not null default now(), -- 이 최고점을 '달성한' 시각(동점 tie-break)
  unique (user_id, location_id)
);
create index if not exists scores_board_idx on public.scores (location_id, overall desc, created_at asc);
-- 기존 DB용: 이름·연락처 컬럼 보강 (비공개)
alter table public.scores add column if not exists name text;
alter table public.scores add column if not exists phone text;

-- ── 모든 제출 시도 로그 (시도횟수 제한 + 감사) ──
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  location_id   text not null,
  overall       real,
  accepted      boolean not null,
  reject_reason text,
  ip_hash       text,
  created_at    timestamptz not null default now()
);
create index if not exists submissions_user_idx on public.submissions (user_id, location_id);

-- ── 리플레이(주행 로그) — 상위/의심 기록 수동 검토용 ──
create table if not exists public.replays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  score_id    uuid references public.scores(id) on delete set null,
  location_id text not null,
  overall     real not null,
  log         jsonb not null, -- RunLog: 시간·경로좌표·트릭이벤트
  created_at  timestamptz not null default now()
);
create index if not exists replays_board_idx on public.replays (location_id, overall desc);

-- ── IP 이벤트 — 동일 IP 대량 계정 생성/제출 감지 ──
create table if not exists public.ip_events (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  user_id    uuid,
  event      text not null, -- 'submit'
  created_at timestamptz not null default now()
);
create index if not exists ip_events_idx on public.ip_events (ip_hash, created_at);

-- ============================================================================
-- RLS: 클라이언트는 읽기도 쓰기도 직접 못 한다. service_role(Edge Function)만 전권.
-- 리더보드는 아래 SECURITY DEFINER RPC 로만 노출.
-- ============================================================================
alter table public.scores      enable row level security;
alter table public.submissions enable row level security;
alter table public.replays     enable row level security;
alter table public.ip_events   enable row level security;
alter table public.courses     enable row level security;
-- (정책을 하나도 만들지 않으면 anon/authenticated 는 전부 거부. service_role 은 RLS 우회.)

-- courses 는 클라가 읽어도 무방(민감정보 없음): 읽기만 허용
-- (재실행 가능하도록 drop 후 create — create policy 는 IF NOT EXISTS 미지원)
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select using (true);

-- ============================================================================
-- 랭킹 RPC (SECURITY DEFINER — scores 를 안전한 컬럼만 집계해 반환)
-- 정렬: overall DESC, created_at ASC  → 동점자는 먼저 기록한 사람이 상위.
-- ============================================================================
-- 이메일 마스킹: 아이디(로컬파트) 첫 글자만 + ***@도메인 (전체 이메일은 클라로 안 나감).
-- 반환 컬럼이 바뀌므로 재실행 위해 drop 후 create.
create or replace function public.mask_email(p_email text)
returns text language sql immutable as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then ''
    else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
  end;
$$;

-- 이름 마스킹: 성+끝 글자만 노출, 가운데는 * (예: 홍길동 → 홍*동)
create or replace function public.mask_name(p_name text)
returns text language sql immutable as $$
  select case
    when p_name is null or char_length(p_name) = 0 then ''
    when char_length(p_name) <= 2 then p_name
    else left(p_name, 1) || repeat('*', char_length(p_name) - 2) || right(p_name, 1)
  end;
$$;

drop function if exists public.get_leaderboard(text, int);
create function public.get_leaderboard(p_location text, p_limit int default 100)
returns table(rank bigint, nickname text, name_masked text, email_masked text, overall real, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.overall desc, s.created_at asc) as rank,
         s.nickname, public.mask_name(s.name) as name_masked, public.mask_email(u.email) as email_masked,
         s.overall, s.created_at, (s.user_id = auth.uid()) as is_me
  from public.scores s
  join auth.users u on u.id = s.user_id
  where s.location_id = p_location and s.verified = true
  order by s.overall desc, s.created_at asc
  limit greatest(1, least(p_limit, 500));
$$;

drop function if exists public.get_my_rank(text, int);
create function public.get_my_rank(p_location text, p_around int default 3)
returns table(rank bigint, nickname text, name_masked text, email_masked text, overall real, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select s.user_id, s.nickname, s.name, u.email, s.overall, s.created_at,
           row_number() over (order by s.overall desc, s.created_at asc) as rank
    from public.scores s
    join auth.users u on u.id = s.user_id
    where s.location_id = p_location and s.verified = true
  ), me as (select rank from ranked where user_id = auth.uid())
  select r.rank, r.nickname, public.mask_name(r.name), public.mask_email(r.email), r.overall, r.created_at, (r.user_id = auth.uid())
  from ranked r, me
  where r.rank between me.rank - p_around and me.rank + p_around
  order by r.rank;
$$;

create or replace function public.leaderboard_count(p_location text)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.scores where location_id = p_location and verified = true;
$$;

grant execute on function public.get_leaderboard(text,int)  to anon, authenticated;
grant execute on function public.get_my_rank(text,int)      to anon, authenticated;
grant execute on function public.leaderboard_count(text)    to anon, authenticated;
