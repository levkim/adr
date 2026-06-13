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
};
