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
    // 정상 (실제 3222m / DEM 3144m)
    start: { lat: 46.0718, lon: 7.2998 },
    // 북면 직하 토르탱 빙하 플랫 (FWT 피니시 일대, ~2705m)
    finish: { lat: 46.0778, lon: 7.2995 },
    zoom: 13,
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
  },
};
