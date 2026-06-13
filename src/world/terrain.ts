import * as THREE from 'three';
import { applySurfaceColors, createSurfaceMaterial } from './surface';

// 베이크된 heightmap 로드 / 지형 메시 생성 / 높이 샘플링.
// 월드 좌표계: 원점 = heightmap 중심, +x 동쪽, +z 남쪽,
// y = 표고(m) - minElevation (실표고 = y + minElevation)

const TILE_SIZE = 256;

export interface TerrainMeta {
  id: string;
  name: string;
  nameEn: string;
  width: number;
  height: number;
  zoom: number;
  originPx: { x: number; y: number };
  bbox: { west: number; south: number; east: number; north: number };
  start: { lat: number; lon: number };
  finish: { lat: number; lon: number };
  metersPerPx: number;
  minElevation: number;
  maxElevation: number;
}

export class Terrain {
  readonly widthMeters: number;
  readonly depthMeters: number;

  private constructor(
    readonly meta: TerrainMeta,
    private readonly heights: Float32Array,
  ) {
    this.widthMeters = (meta.width - 1) * meta.metersPerPx;
    this.depthMeters = (meta.height - 1) * meta.metersPerPx;
  }

  static async load(id: string): Promise<Terrain> {
    const base = `${import.meta.env.BASE_URL}terrain/${id}`;
    const [metaRes, binRes] = await Promise.all([
      fetch(`${base}/meta.json`),
      fetch(`${base}/heightmap.bin`),
    ]);
    if (!metaRes.ok || !binRes.ok) {
      throw new Error(`지형 데이터 로드 실패: ${id} — 먼저 npm run terrain -- --location=${id}`);
    }
    const meta = (await metaRes.json()) as TerrainMeta;
    const heights = new Float32Array(await binRes.arrayBuffer());
    if (heights.length !== meta.width * meta.height) {
      throw new Error(`heightmap 크기 불일치: ${heights.length} != ${meta.width}x${meta.height}`);
    }
    return new Terrain(meta, heights);
  }

  /** 셀 표고 (minElevation 기준 y). row 0 = 북쪽 */
  private cellY(col: number, row: number): number {
    const { width, height, minElevation } = this.meta;
    const c = THREE.MathUtils.clamp(col, 0, width - 1);
    const r = THREE.MathUtils.clamp(row, 0, height - 1);
    return this.heights[r * width + c] - minElevation;
  }

  /** 월드 (x, z)의 지형 높이 y — bilinear 보간 */
  getHeight(x: number, z: number): number {
    const { width, height, metersPerPx } = this.meta;
    const fc = THREE.MathUtils.clamp(x / metersPerPx + (width - 1) / 2, 0, width - 1);
    const fr = THREE.MathUtils.clamp(z / metersPerPx + (height - 1) / 2, 0, height - 1);
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const tc = fc - c0;
    const tr = fr - r0;
    const top = this.cellY(c0, r0) * (1 - tc) + this.cellY(c0 + 1, r0) * tc;
    const bot = this.cellY(c0, r0 + 1) * (1 - tc) + this.cellY(c0 + 1, r0 + 1) * tc;
    return top * (1 - tr) + bot * tr;
  }

  /** 월드 (x, z)의 지형 법선 — 중심차분, out에 기록 */
  getNormal(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const s = this.meta.metersPerPx;
    const dx = (this.getHeight(x + s, z) - this.getHeight(x - s, z)) / (2 * s);
    const dz = (this.getHeight(x, z + s) - this.getHeight(x, z - s)) / (2 * s);
    return out.set(-dx, 1, -dz).normalize();
  }

  /** 위경도 → 월드 xz (베이크와 동일한 Web Mercator 픽셀 매핑) */
  geoToWorld(lat: number, lon: number): { x: number; z: number } {
    const { zoom, originPx, width, height, metersPerPx } = this.meta;
    const scale = 2 ** zoom * TILE_SIZE;
    const gx = ((lon + 180) / 360) * scale;
    const gy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * scale;
    return {
      x: (gx - originPx.x - (width - 1) / 2) * metersPerPx,
      z: (gy - originPx.y - (height - 1) / 2) * metersPerPx,
    };
  }

  /** 지형 메시 생성 (실측 1:1 스케일, 경사 기반 버텍스 컬러) */
  buildMesh(): THREE.Mesh {
    const { width: w, height: h, metersPerPx } = this.meta;

    const positions = new Float32Array(w * h * 3);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = (r * w + c) * 3;
        positions[i] = (c - (w - 1) / 2) * metersPerPx;
        positions[i + 1] = this.cellY(c, r);
        positions[i + 2] = (r - (h - 1) / 2) * metersPerPx;
      }
    }

    const indices = new Uint32Array((w - 1) * (h - 1) * 6);
    let k = 0;
    for (let r = 0; r < h - 1; r++) {
      for (let c = 0; c < w - 1; c++) {
        const a = r * w + c;
        const b = a + 1;
        const d = a + w;
        const e = d + 1;
        indices[k++] = a;
        indices[k++] = d;
        indices[k++] = b;
        indices[k++] = b;
        indices[k++] = d;
        indices[k++] = e;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    applySurfaceColors(geometry);

    const material = createSurfaceMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }
}
