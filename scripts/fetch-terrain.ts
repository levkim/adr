// DEM 타일 다운로드 → 표고 디코딩 → heightmap 베이크
// 사용: npm run terrain -- --location=bec-des-rosses
//
// AWS Terrain Tiles (Mapzen Terrarium) 타일을 받아 bbox 픽셀 범위로 잘라
// Float32 바이너리 heightmap + 메타데이터 + 힐셰이드 미리보기를
// public/terrain/{location}/ 에 저장한다. 런타임은 외부 의존 없이 이 파일만 읽는다.

import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { LOCATIONS, type LocationDef } from '../src/world/locations.ts';

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TILE_SIZE = 256;
const FETCH_RETRIES = 4;
const RETRY_BASE_MS = 2000;
// Web Mercator 줌 0에서 적도 기준 m/px
const MERCATOR_RES_Z0 = 156543.03392804097;

// ── Web Mercator 좌표 변환 ──────────────────────────────
function lonToGlobalPx(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 2 ** zoom * TILE_SIZE;
}

function latToGlobalPx(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * 2 ** zoom * TILE_SIZE;
}

// ── 타일 다운로드 (재시도 + 백오프) ─────────────────────
async function fetchTile(z: number, x: number, y: number): Promise<PNG> {
  const url = TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return PNG.sync.read(buf);
    } catch (err) {
      if (attempt >= FETCH_RETRIES) throw new Error(`타일 다운로드 실패 ${url}: ${err}`);
      const wait = RETRY_BASE_MS * 2 ** attempt;
      console.warn(`재시도 ${attempt + 1}/${FETCH_RETRIES} (${wait}ms 후): ${url}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// ── 이상치 제거 (불량 DEM 픽셀로 인한 스파이크 방지) ────
function despike(heights: Float32Array, w: number, h: number): void {
  const win: number[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      win.length = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= h || cc < 0 || cc >= w) continue;
          win.push(heights[rr * w + cc]);
        }
      }
      if (win.length < 3) continue;
      win.sort((a, b) => a - b);
      const median = win[win.length >> 1];
      if (Math.abs(heights[r * w + c] - median) > 600) heights[r * w + c] = median;
    }
  }
}

// ── 힐셰이드 미리보기 (구글어스 형태 비교용) ────────────
function renderHillshade(
  heights: Float32Array,
  w: number,
  h: number,
  metersPerPx: number,
): PNG {
  const png = new PNG({ width: w, height: h });
  // 광원: 북서쪽 45도 상공 (지도 힐셰이드 관례)
  const lx = -0.5, ly = 0.70710678, lz = -0.5;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const cm = Math.min(col + 1, w - 1), cp = Math.max(col - 1, 0);
      const rm = Math.min(row + 1, h - 1), rp = Math.max(row - 1, 0);
      const dzdx = (heights[row * w + cm] - heights[row * w + cp]) / ((cm - cp) * metersPerPx);
      const dzdy = (heights[rm * w + col] - heights[rp * w + col]) / ((rm - rp) * metersPerPx);
      // 법선 (-dzdx, 1, -dzdy) 정규화 후 광원과 내적
      const inv = 1 / Math.hypot(dzdx, 1, dzdy);
      const shade = Math.max(0, (-dzdx * inv) * lx + inv * ly + (-dzdy * inv) * lz);
      const v = Math.round(40 + shade * 215);
      const i = (row * w + col) * 4;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

// ── 메인 베이크 ─────────────────────────────────────────
async function bake(loc: LocationDef): Promise<void> {
  const { bbox, zoom } = loc;

  // bbox의 글로벌 픽셀 범위 (y는 북쪽이 작다)
  const pxWest = Math.floor(lonToGlobalPx(bbox.west, zoom));
  const pxEast = Math.ceil(lonToGlobalPx(bbox.east, zoom));
  const pyNorth = Math.floor(latToGlobalPx(bbox.north, zoom));
  const pySouth = Math.ceil(latToGlobalPx(bbox.south, zoom));
  const w = pxEast - pxWest;
  const h = pySouth - pyNorth;

  const tileX0 = Math.floor(pxWest / TILE_SIZE);
  const tileX1 = Math.floor((pxEast - 1) / TILE_SIZE);
  const tileY0 = Math.floor(pyNorth / TILE_SIZE);
  const tileY1 = Math.floor((pySouth - 1) / TILE_SIZE);
  const tileCount = (tileX1 - tileX0 + 1) * (tileY1 - tileY0 + 1);

  console.log(`[${loc.id}] zoom=${zoom}, heightmap ${w}x${h}px, 타일 ${tileCount}개`);

  // 타일을 받아 bbox 픽셀 범위만 잘라 합성
  const heights = new Float32Array(w * h);
  for (let ty = tileY0; ty <= tileY1; ty++) {
    for (let tx = tileX0; tx <= tileX1; tx++) {
      const png = await fetchTile(zoom, tx, ty);
      console.log(`  타일 ${zoom}/${tx}/${ty} OK`);
      for (let py = 0; py < TILE_SIZE; py++) {
        const row = ty * TILE_SIZE + py - pyNorth;
        if (row < 0 || row >= h) continue;
        for (let px = 0; px < TILE_SIZE; px++) {
          const col = tx * TILE_SIZE + px - pxWest;
          if (col < 0 || col >= w) continue;
          const i = (py * TILE_SIZE + px) * 4;
          // Terrarium 인코딩: 표고(m) = R*256 + G + B/256 - 32768
          heights[row * w + col] =
            png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
        }
      }
    }
  }

  // 이상치(불량 픽셀) 제거: 주변 중앙값과 600m 넘게 벗어나는 셀을 중앙값으로 대체
  despike(heights, w, h);

  // 통계
  let min = Infinity, max = -Infinity, maxIdx = 0;
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] < min) min = heights[i];
    if (heights[i] > max) { max = heights[i]; maxIdx = i; }
  }

  const centerLatRad = (((bbox.south + bbox.north) / 2) * Math.PI) / 180;
  const metersPerPx = (MERCATOR_RES_Z0 * Math.cos(centerLatRad)) / 2 ** zoom;

  // 좌표 → 픽셀/표고 헬퍼 (검증 출력용)
  const toCell = (p: { lat: number; lon: number }) => ({
    col: Math.round(lonToGlobalPx(p.lon, zoom) - pxWest),
    row: Math.round(latToGlobalPx(p.lat, zoom) - pyNorth),
  });
  const elevAt = (p: { lat: number; lon: number }) => {
    const c = toCell(p);
    return heights[c.row * w + c.col];
  };
  const maxCol = maxIdx % w, maxRow = Math.floor(maxIdx / w);

  console.log(`표고 범위: ${min.toFixed(0)}m ~ ${max.toFixed(0)}m, 해상도 ${metersPerPx.toFixed(1)}m/px`);
  console.log(`시작점(${loc.start.lat}, ${loc.start.lon}) 표고: ${elevAt(loc.start).toFixed(0)}m`);
  console.log(`피니시(${loc.finish.lat}, ${loc.finish.lon}) 표고: ${elevAt(loc.finish).toFixed(0)}m`);
  console.log(`bbox 내 최고점: ${max.toFixed(0)}m @ cell(${maxCol}, ${maxRow})`);

  // 저장
  const outDir = `public/terrain/${loc.id}`;
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/heightmap.bin`, Buffer.from(heights.buffer));

  const meta = {
    id: loc.id,
    name: loc.name,
    nameEn: loc.nameEn,
    width: w,
    height: h,
    zoom,
    // 글로벌 mercator 픽셀 원점 (런타임 위경도→월드 좌표 변환용)
    originPx: { x: pxWest, y: pyNorth },
    bbox,
    start: loc.start,
    finish: loc.finish,
    metersPerPx,
    minElevation: min,
    maxElevation: max,
    encoding: 'float32-le-row-major-north-first',
  };
  await writeFile(`${outDir}/meta.json`, JSON.stringify(meta, null, 2));
  await writeFile(
    `${outDir}/preview.png`,
    PNG.sync.write(renderHillshade(heights, w, h, metersPerPx)),
  );
  console.log(`저장 완료: ${outDir}/ (heightmap.bin ${(heights.byteLength / 1024).toFixed(0)}KB, meta.json, preview.png)`);
}

// ── 엔트리 ──────────────────────────────────────────────
const locArg = process.argv.find((a) => a.startsWith('--location='))?.split('=')[1];
if (!locArg || !LOCATIONS[locArg]) {
  console.error(`사용법: npm run terrain -- --location=<id>\n장소: ${Object.keys(LOCATIONS).join(', ')}`);
  process.exit(1);
}
await bake(LOCATIONS[locArg]);
