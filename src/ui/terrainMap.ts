import type { Terrain } from '../world/terrain';

// 탑다운 힐셰이드 렌더 + 월드→맵 좌표 변환 (미니맵 / 결과 화면 공용).
// 북쪽이 위(+z = 남쪽 = 아래). 지형은 정적이라 한 번만 렌더해 캐시한다.

export function renderHillshade(terrain: Terrain, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const W = terrain.widthMeters;
  const D = terrain.depthMeters;
  const img = ctx.createImageData(size, size);
  const step = W / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size - 0.5) * W;
      const wz = (py / size - 0.5) * D;
      const hC = terrain.getHeight(wx, wz);
      const dzdx = (terrain.getHeight(wx + step, wz) - hC) / step;
      const dzdz = (terrain.getHeight(wx, wz + step) - hC) / step;
      const inv = 1 / Math.hypot(dzdx, 1, dzdz);
      const shade = Math.max(0, -dzdx * inv * -0.5 + inv * 0.7071 + -dzdz * inv * -0.5);
      const v = 70 + shade * 170;
      const i = (py * size + px) * 4;
      img.data[i] = v * 0.93;
      img.data[i + 1] = v * 0.97;
      img.data[i + 2] = Math.min(255, v * 1.04 + 8);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 월드 (x,z) → 맵 픽셀 (북쪽 위) */
export function worldToMapPx(
  terrain: Terrain,
  x: number,
  z: number,
  size: number,
): { x: number; y: number } {
  return {
    x: (x / terrain.widthMeters + 0.5) * size,
    y: (z / terrain.depthMeters + 0.5) * size,
  };
}
