// 임시 DEM 프로브: 시작→피니시 직선 표고 프로파일 확인 (장소 추가 검증용)
// 사용: node scripts/probe.ts <zoom> <slat> <slon> <flat> <flon>
import { PNG } from 'pngjs';

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TILE = 256;

function lonPx(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z * TILE;
}
function latPx(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z * TILE;
}

const cache = new Map<string, PNG>();
async function tile(z: number, x: number, y: number): Promise<PNG> {
  const k = `${z}/${x}/${y}`;
  const c = cache.get(k);
  if (c) return c;
  const url = TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  for (let a = 0; ; a++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
      cache.set(k, png);
      return png;
    } catch (e) {
      if (a >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** a));
    }
  }
}

async function elev(lat: number, lon: number, z: number): Promise<number> {
  const gx = lonPx(lon, z), gy = latPx(lat, z);
  const tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
  const px = Math.floor(gx) % TILE, py = Math.floor(gy) % TILE;
  const png = await tile(z, tx, ty);
  const i = (py * TILE + px) * 4;
  return png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
}

const [, , zs, slat, slon, flat, flon] = process.argv;
const z = Number(zs);
const s = { lat: Number(slat), lon: Number(slon) };
const f = { lat: Number(flat), lon: Number(flon) };
const N = 24;
let prev = Infinity, ups = 0, maxUp = 0;
const profile: string[] = [];
for (let i = 0; i <= N; i++) {
  const t = i / N;
  const lat = s.lat + (f.lat - s.lat) * t;
  const lon = s.lon + (f.lon - s.lon) * t;
  const e = await elev(lat, lon, z);
  if (i > 0 && e > prev) { ups++; maxUp = Math.max(maxUp, e - prev); }
  prev = e;
  profile.push(`${(t * 100).toFixed(0).padStart(3)}% ${e.toFixed(0)}m`);
}
// 수평거리
const latRad = (s.lat * Math.PI) / 180;
const mPerDegLat = 111320;
const mPerDegLon = 111320 * Math.cos(latRad);
const dx = (f.lon - s.lon) * mPerDegLon;
const dy = (f.lat - s.lat) * mPerDegLat;
const horiz = Math.hypot(dx, dy);
console.log(profile.join('  '));
const e0 = Number(profile[0].split(' ')[1].replace('m', ''));
const e1 = Number(profile[N].split(' ')[1].replace('m', ''));
console.log(`시작 ${e0}m → 피니시 ${e1}m, 낙차 ${(e0 - e1).toFixed(0)}m, 수평 ${(horiz / 1000).toFixed(2)}km, 상승구간 ${ups}/${N} (최대 +${maxUp.toFixed(0)}m)`);
