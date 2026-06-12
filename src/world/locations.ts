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
};
