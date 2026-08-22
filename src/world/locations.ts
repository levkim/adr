// 실제 장소 정의. 좌표는 WGS84 (위도, 경도).
// bbox/시작·피니시 좌표는 베이크 후 DEM 표고와 대조해 검증한다.

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface LocationDef {
  id: string;
  name: string;
  nameEn: string;
  /** 지형 범위 (WGS84) */
  bbox: { west: number; south: number; east: number; north: number };
  /** 드랍 인 지점 (정상) */
  start: GeoPoint;
  /** 피니시 (베이스) */
  finish: GeoPoint;
  /** 타일 줌 레벨 (12~14) */
  zoom: number;
  /** 수목한계선 표고 (m) — 이 아래로 나무 절차 배치 */
  treeline: number;
  // ── 시작 화면 카드 표시용 ──
  country: string;
  summit: number; // 정상 표고 (m, 실측 기준)
  vertical: number; // 런 낙차 (m)
  desc: string;
}

export const LOCATIONS: Record<string, LocationDef> = {
  'hakuba-happo': {
    id: 'hakuba-happo',
    name: '하쿠바 핫포 북사면',
    nameEn: 'Hakuba Happo North Face',
    // 좌표 검증: DEM 국소 최고점 분석 (2026-06). 우시로타테야마 능선 체인 일치 —
    // 고류다케(DEM 2793/실제 2814) ─ 가라마츠다케(DEM 2672/실제 2696 @ 36.6871,137.7545)
    // ─ 가에라즈노켄(DEM 2596) ─ 텐구노아타마(DEM 2811/실제 2812). 오프셋 -20m 일관.
    // 런: 핫포 능선 상단에서 북동향 사면 2646→1770m, 낙차 876m, 지속 24~40°
    // (FWT 하쿠바 베뉴 제원과 부합: NE향, ~800m급 낙차).
    bbox: { west: 137.735, south: 36.664, east: 137.795, north: 36.712 },
    start: { lat: 36.686, lon: 137.7598 },
    finish: { lat: 36.6969, lon: 137.7676 },
    zoom: 13,
    treeline: 1850, // 핫포 능선 일대 — 런 하단부가 트리런이 된다
    country: '일본 · 나가노 하쿠바',
    summit: 2696,
    vertical: 870,
    desc: '우시로타테야마 능선의 북동 사면. 깊은 일본 파우더와 하단 트리런.',
  },
  'jyrgalan-alatoo': {
    id: 'jyrgalan-alatoo',
    name: '지르갈란 알라투',
    nameEn: 'Jyrgalan Ala-Too',
    // 사용자 지정 좌표(지르갈란 알라투). DEM 검증: 시작 3164m → 도착 2251m,
    // 전 구간 하강(5~19°, NE향). 낙차 913m, 수평 4.7km.
    bbox: { west: 78.922, south: 42.546, east: 78.984, north: 42.626 },
    start: { lat: 42.579003, lon: 78.944483 }, // 42°34'44.41"N 78°56'40.14"E
    finish: { lat: 42.617739, lon: 78.966358 }, // 42°37'03.86"N 78°57'59.09"E
    zoom: 13,
    treeline: 2950, // 상단 알파인 → 하단 라치/가문비 트리런
    country: '키르기스스탄 · 지르갈란',
    summit: 3164,
    vertical: 913,
    desc: '톈샨 동부 지르갈란의 롱 런. 3164m에서 라치 숲을 지나 0.9km 강하.',
  },
  'ala-archa': {
    id: 'ala-archa',
    name: '알라아르차 (톈샨)',
    nameEn: 'Ala Archa, Tian Shan',
    // 좌표 검증: 비슈케크 남쪽 알라아르차 산군 DEM 분석 (2026-06).
    // 최고봉 4763m(스보보드나야 코레야 일대) 인근, 낙차 스캔으로 선정한
    // 4454m봉 → 서측 계곡 2731m 연속 폴라인(낙차 1723m, 14~53°, 역경사 없음).
    bbox: { west: 74.47, south: 42.495, east: 74.54, north: 42.53 },
    // 드랍 인: 정상부 평탄셀을 피해 페이스 5% 하단(4383m, 27°)
    start: { lat: 42.5122, lon: 74.5201 },
    finish: { lat: 42.5151, lon: 74.488 },
    zoom: 13,
    treeline: 2900, // 톈샨 가문비 한계선 — 런 최하단부만 수림
    country: '키르기스스탄 · 톈샨',
    summit: 4450,
    vertical: 1720,
    desc: '톈샨 알라아르차 산군의 빙하 빅 라인. 4400m대 정상에서 1.7km 연속 강하.',
  },
  'tanigawadake': {
    id: 'tanigawadake',
    name: '다니가와다케',
    nameEn: 'Mt. Tanigawadake',
    // 사용자 지정 좌표. DEM 검증: 시작 1927m → 베이스 742m, 전 구간 하강(3~46°),
    // 동사면(텐진다이라 방향) 강하. 낙차 1185m, 수평 2.9km.
    bbox: { west: 138.918, south: 36.823, east: 138.974, north: 36.847 },
    start: { lat: 36.833508, lon: 138.930214 }, // 36°50'00.63"N 138°55'48.77"E
    finish: { lat: 36.836472, lon: 138.962447 }, // 36°50'11.30"N 138°57'44.81"E
    zoom: 13,
    treeline: 1700, // 상단 알파인 → 하단 텐진다이라 트리런
    country: '일본 · 군마 谷川岳',
    summit: 1977,
    vertical: 1185,
    desc: '일본 군마 다니가와다케의 동사면. 정상에서 텐진다이라로 1.2km 강하, 하단 트리런.',
  },
  'karakol': {
    id: 'karakol',
    name: '카라콜 스키베이스',
    nameEn: 'Karakol Ski Base',
    // 사용자 지정 좌표(카라콜 스키베이스, 키르기스스탄). DEM 검증: 시작 3479m → 도착 2405m,
    // 전 구간 하강(상승 2/24, 최대 +36m), 북서향. 낙차 1074m, 수평 5.6km.
    bbox: { west: 78.452, south: 42.356, east: 78.53, north: 42.42 },
    start: { lat: 42.373, lon: 78.515403 }, // 42°22'22.80"N 78°30'55.45"E
    finish: { lat: 42.408133, lon: 78.466408 }, // 42°24'29.28"N 78°27'59.07"E
    zoom: 13,
    treeline: 3000, // 톈샨 가문비 트리런으로 유명
    country: '키르기스스탄 · 카라콜',
    summit: 3479,
    vertical: 1074,
    desc: '키르기스스탄 카라콜의 톈샨 가문비 트리런. 3479m에서 1.1km 북서 사면 강하.',
  },
  'hakkaisan': {
    id: 'hakkaisan',
    name: '핫카이산 로프웨이',
    nameEn: 'Hakkaisan Ropeway',
    // 사용자 지정 좌표(핫카이산 로프웨이 스키리조트, 일본 니가타). DEM 검증: 시작 1157m → 정지 382m,
    // 전 구간 하강(11~27°), 남서향. 낙차 775m, 수평 2.1km. z14(7.6m/px).
    bbox: { west: 138.965, south: 37.098, east: 139.005, north: 37.135 },
    start: { lat: 37.12485, lon: 138.992225 }, // 37°07'29.46"N 138°59'32.01"E
    finish: { lat: 37.109242, lon: 138.978594 }, // 37°06'33.27"N 138°58'42.94"E
    zoom: 14,
    treeline: 1500, // 런 전 구간 수림 (너도밤나무·침엽수 트리런)
    country: '일본 · 니가타 八海山',
    summit: 1157,
    vertical: 775,
    desc: '일본 니가타 핫카이산 로프웨이. 정상역 1157m에서 베이스로 775m 트리런.',
  },
  'tuyuksu-pogrebetskogo-1': {
    id: 'tuyuksu-pogrebetskogo-1',
    name: '투육수 빙하 1코스 — 포그레베츠코고봉',
    nameEn: 'Tuyuksu Glacier 1 — Peak Pogrebetskogo',
    // 사용자 지정 좌표(투육수 빙하, 자일리스키 알라타우). DEM 검증: 시작 4202m → 도착 3372m,
    // 전 구간 하강(상승 4/24, 최대 +34m), 빙하 보울. 낙차 830m, 수평 3.8km.
    bbox: { west: 77.052, south: 43.022, east: 77.098, north: 43.08 },
    start: { lat: 43.034125, lon: 77.071703 }, // 43°02'02.85"N 77°04'18.13"E
    finish: { lat: 43.067197, lon: 77.081722 }, // 43°04'01.91"N 77°04'54.20"E
    zoom: 13,
    treeline: 2700, // 자일리스키 알라타우 톈샨 가문비 한계선 — 런 전 구간 빙하·알파인
    country: '카자흐스탄 · 알마티 자일리스키 알라타우',
    summit: 4202,
    vertical: 830,
    desc: '카자흐스탄 투육수 빙하 상부. 포그레베츠코고봉 4202m에서 빙하 보울로 0.8km 강하.',
  },
  'tuyuksu-shymbulak': {
    id: 'tuyuksu-shymbulak',
    name: '투육수 빙하 3코스 — 침불락 퇴근길',
    nameEn: 'Tuyuksu Glacier 3 — Shymbulak Commute',
    // 사용자 지정 좌표(투육수→침불락, 자일리스키 알라타우). DEM 검증: 시작 3372m → 도착 2513m,
    // 전 구간 하강(상승 1/24, 최대 +3m), 침불락 방향. 낙차 859m, 수평 4.7km.
    bbox: { west: 77.062, south: 43.057, east: 77.098, north: 43.119 },
    start: { lat: 43.067197, lon: 77.081722 }, // 43°04'01.91"N 77°04'54.20"E
    finish: { lat: 43.108997, lon: 77.075947 }, // 43°06'32.39"N 77°04'33.41"E
    zoom: 13,
    treeline: 2700, // 하단부 침불락 일대에서 톈샨 가문비 트리런
    country: '카자흐스탄 · 알마티 자일리스키 알라타우',
    summit: 3372,
    vertical: 859,
    desc: '카자흐스탄 투육수 빙하에서 침불락으로 내려오는 퇴근길. 3372m에서 0.9km 강하.',
  },
  'baikal-mamay': {
    id: 'baikal-mamay',
    name: '바이칼 마마이',
    nameEn: 'Baikal Mamay',
    // 사용자 지정 좌표(러시아 바이칼 마마이, 하마르다반 산맥). DEM 검증: 시작 1588m → 도착 842m,
    // 전 구간 하강(상승 0/24), 평균 ~23°. 낙차 746m, 수평 1.7km.
    bbox: { west: 104.82, south: 51.37, east: 104.852, north: 51.406 },
    start: { lat: 51.381144, lon: 104.838228 }, // 51°22'52.12"N 104°50'17.62"E
    finish: { lat: 51.396453, lon: 104.833633 }, // 51°23'47.23"N 104°50'01.08"E
    zoom: 13,
    treeline: 1700, // 시베리아 타이가 — 런 전 구간이 침엽수 트리런
    country: '러시아 · 바이칼 마마이',
    summit: 1588,
    vertical: 746,
    desc: '바이칼 하마르다반 산맥의 마마이. 시베리아 파우더 트리런, 1588m에서 746m 강하.',
  },
  'bec-des-rosses': {
    id: 'bec-des-rosses',
    name: '벡 데 로스',
    nameEn: 'Bec des Rosses',
    // 좌표 검증: DEM 국소 최고점 분석으로 확정 (2026-06).
    // 벡 데 로스(DEM 3144) ─ 젠티안 콜 안부(DEM 2844 @ 46.0753,7.3049)
    // ─ 프티 몽포르(DEM 3128 @ 46.0788,7.3101) ─ 몽포르(DEM 3272 @ 46.0803,7.3186)
    // 체인과 북쪽 토르탱 빙하 보울(~2700m 플랫)이 실제 지형 관계와 일치.
    // 실표고 대비 -50~-80m은 DEM 평활화에 의한 일관 오프셋.
    bbox: { west: 7.272, south: 46.052, east: 7.332, north: 46.096 },
    // 드랍 인: 정상(46.0718, 실제 3222m/DEM 3144m) 바로 아래 북면 상단.
    // 정점 셀은 평평해서 출발이 안 되므로 페이스 쪽으로 ~100m 내림
    start: { lat: 46.0727, lon: 7.2998 },
    // 북면 직하 토르탱 빙하 플랫 (FWT 피니시 일대, ~2705m)
    finish: { lat: 46.0778, lon: 7.2995 },
    zoom: 13,
    treeline: 2200, // 발레 알프스 수목한계선 — 런 구간은 전부 알파인
    country: '스위스 · 베르비에',
    summit: 3222,
    vertical: 400,
    desc: 'FWT 결승 무대. 급사면 노스페이스에 클리프와 슈트가 깔린 알파인 빅 라인.',
  },
  'valdez-thompson-pass': {
    id: 'valdez-thompson-pass',
    name: '발데즈 톰슨 패스',
    nameEn: 'Valdez Thompson Pass',
    // 좌표 검증: 톰슨 패스 안부 DEM 808m(실제 816m) @ (61.127,-145.73) 확인.
    // 패스 북서쪽 추가치 산군에서 낙차 스캔으로 선정한 무명봉 런:
    // 1963m → 로우 리버 협곡 431m, 수평 2.6km, 낙차 1532m 연속 사면(16~41°, 벤치 없음).
    bbox: { west: -145.886, south: 61.131, east: -145.795, north: 61.175 },
    start: { lat: 61.162, lon: -145.826 },
    finish: { lat: 61.1444, lon: -145.8578 },
    zoom: 13,
    treeline: 750, // 추가치 연안 수목한계선 — 런 최하단 협곡부만 수림
    country: '미국 · 알래스카 발데즈',
    summit: 1963,
    vertical: 1530,
    desc: '추가치 산군의 빅마운틴 헬리스키 라인. 벤치 없는 1.5km 연속 사면.',
  },
  'baekdu-cheonji': {
    id: 'baekdu-cheonji',
    name: '백두산 천지',
    nameEn: 'Baekdu Cheonji (Tianchi)',
    // 사용자 지정 좌표(백두산 천지, 북·중 국경 칼데라). DEM 검증: 시작 2741m → 도착 2194m,
    // 전 구간 하강(상승 0/24), 평균 ~20°. 낙차 547m, 수평 1.46km. 외륜→천지 호수면.
    bbox: { west: 128.058, south: 41.98, east: 128.095, north: 42.02 },
    start: { lat: 41.9934, lon: 128.077375 }, // 41°59'36.24"N 128°04'38.55"E
    finish: { lat: 42.006433, lon: 128.075147 }, // 42°00'23.16"N 128°04'30.53"E
    zoom: 13,
    treeline: 2000, // 창바이산 수목한계선 — 런 전 구간 알파인 툰드라
    country: '북한·중국 · 백두산 천지',
    summit: 2741,
    vertical: 547,
    desc: '백두산 칼데라 외륜에서 천지 호수면으로 내리꽂는 알파인 라인. 2741m에서 547m 강하.',
  },
  'lotte-arai': {
    id: 'lotte-arai',
    name: '롯데 아라이 리조트',
    nameEn: 'Lotte Arai Resort',
    // 사용자 지정 좌표(롯데 아라이, 일본 니가타 묘코). DEM 검증: 시작 1359m → 도착 651m,
    // 전 구간 하강(상승 0/24), 평균 ~19°. 낙차 708m, 수평 2.0km.
    bbox: { west: 138.12, south: 36.978, east: 138.163, north: 37.006 },
    start: { lat: 36.989881, lon: 138.134722 }, // 36°59'23.57"N 138°08'05.00"E
    finish: { lat: 36.988108, lon: 138.157217 }, // 36°59'17.19"N 138°09'25.98"E
    zoom: 13,
    treeline: 0, // 나무 제거 (대회 코스 — 지형 최저 표고보다 낮춰 나무 0)
    country: '일본 · 니가타 묘코',
    summit: 1359,
    vertical: 708,
    desc: '일본 묘코 롯데 아라이. 대회 고정 코스, 1359m에서 708m 강하.',
  },
};
