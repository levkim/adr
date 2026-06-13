import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Terrain } from './terrain';

// 나무/바위 절차 배치: 경사·고도 규칙 + 시드 고정 난수로 결정적 배치.
// 렌더는 InstancedMesh, 충돌은 공간 해시 그리드로 O(1) 조회.

export interface Obstacle {
  x: number;
  z: number;
  /** 충돌 반경 (m) */
  r: number;
  /** 지면 기준 충돌 상단 높이 (m) — 이 위로는 통과 */
  top: number;
}

/** 시드 고정 의사난수 (mulberry32) — 같은 장소는 항상 같은 배치 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Props {
  readonly group = new THREE.Group();
  readonly treeCount: number;
  readonly rockCount: number;
  private readonly grid = new Map<number, Obstacle[]>();

  private constructor(treeCount: number, rockCount: number) {
    this.treeCount = treeCount;
    this.rockCount = rockCount;
  }

  static generate(terrain: Terrain, treeline: number): Props {
    const p = CONFIG.props;
    const rand = mulberry32(hashString(terrain.meta.id));
    const normal = new THREE.Vector3();

    const trees: { x: number; z: number; y: number; s: number; rot: number }[] = [];
    const rocks: { x: number; z: number; y: number; s: number; rot: number }[] = [];

    const halfW = terrain.widthMeters / 2 - CONFIG.world.edgeMargin;
    const halfD = terrain.depthMeters / 2 - CONFIG.world.edgeMargin;
    const treeMaxCos = Math.cos(THREE.MathUtils.degToRad(p.treeMaxSlope));
    const rockMinCos = Math.cos(THREE.MathUtils.degToRad(p.rockMinSlope));
    const rockMaxCos = Math.cos(THREE.MathUtils.degToRad(p.rockMaxSlope));

    for (let x = -halfW; x <= halfW; x += p.spacing) {
      for (let z = -halfD; z <= halfD; z += p.spacing) {
        const jx = x + (rand() - 0.5) * p.spacing;
        const jz = z + (rand() - 0.5) * p.spacing;
        const y = terrain.getHeight(jx, jz);
        const elev = y + terrain.meta.minElevation;
        terrain.getNormal(jx, jz, normal);
        const r = rand();

        // 나무: 수목한계선 아래 + 완경사, 한계선에서 멀어질수록 밀도 증가
        if (elev < treeline && normal.y > treeMaxCos && trees.length < p.maxTrees) {
          const density =
            p.treeDensity * Math.min(1, (treeline - elev) / p.treeDensityRamp);
          if (r < density) {
            trees.push({ x: jx, z: jz, y, s: 0.7 + rand() * 0.7, rot: rand() * Math.PI * 2 });
            continue;
          }
        }
        // 바위: 급경사 암벽 노출부 주변
        if (
          normal.y < rockMinCos &&
          normal.y > rockMaxCos &&
          rocks.length < p.maxRocks &&
          rand() < p.rockDensity
        ) {
          rocks.push({ x: jx, z: jz, y, s: 0.7 + rand() * 1.8, rot: rand() * Math.PI * 2 });
        }
      }
    }

    const props = new Props(trees.length, rocks.length);
    props.buildTreeMeshes(trees);
    props.buildRockMesh(rocks);

    // 충돌 등록
    for (const t of trees) {
      props.addObstacle({
        x: t.x,
        z: t.z,
        r: p.treeCollisionRadius * t.s,
        top: t.y + p.treeCollisionHeight * t.s,
      });
    }
    for (const rk of rocks) {
      props.addObstacle({ x: rk.x, z: rk.z, r: rk.s * 0.85, top: rk.y + rk.s * 1.1 });
    }
    return props;
  }

  // ── 렌더 메시 ───────────────────────────────────────────
  private buildTreeMeshes(
    trees: { x: number; z: number; y: number; s: number; rot: number }[],
  ): void {
    if (trees.length === 0) return;
    // 침엽수: 줄기 + 눈 덮인 캐노피 (인스턴스 2개 드로우콜)
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.2, 6);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
    const canopyGeo = new THREE.ConeGeometry(1.7, 5.2, 7);
    canopyGeo.translate(0, 4.2, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x39584a, roughness: 0.85 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, trees.length);
    trunks.castShadow = true;
    canopies.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      sc.set(t.s, t.s, t.s);
      pos.set(t.x, t.y - 0.2, t.z); // 살짝 묻어 들뜸 방지
      m.compose(pos, q, sc);
      trunks.setMatrixAt(i, m);
      canopies.setMatrixAt(i, m);
    });
    this.group.add(trunks, canopies);
  }

  private buildRockMesh(
    rocks: { x: number; z: number; y: number; s: number; rot: number }[],
  ): void {
    if (rocks.length === 0) return;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x655f58, roughness: 0.95 });
    const mesh = new THREE.InstancedMesh(geo, mat, rocks.length);
    // 바위는 낮고 그림자 기여가 작아 셰도우 패스에서 제외 (최적화)
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const axis = new THREE.Vector3(1, 0, 0);
    rocks.forEach((r, i) => {
      q.setFromAxisAngle(axis, r.rot).normalize();
      sc.set(r.s, r.s * 0.8, r.s);
      pos.set(r.x, r.y - r.s * 0.25, r.z); // 일부 매몰
      m.compose(pos, q, sc);
      mesh.setMatrixAt(i, m);
    });
    this.group.add(mesh);
  }

  // ── 충돌 공간 해시 ─────────────────────────────────────
  private cellKey(cx: number, cz: number): number {
    return cx * 100003 + cz;
  }

  private addObstacle(o: Obstacle): void {
    const cell = CONFIG.props.hashCell;
    const key = this.cellKey(Math.floor(o.x / cell), Math.floor(o.z / cell));
    const list = this.grid.get(key);
    if (list) list.push(o);
    else this.grid.set(key, [o]);
  }

  /** (x,z) 주변 반경 r 내 장애물 — y가 장애물 상단보다 낮을 때만 충돌 */
  query(x: number, z: number, y: number, r: number): Obstacle | null {
    const cell = CONFIG.props.hashCell;
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.grid.get(this.cellKey(cx + dx, cz + dz));
        if (!list) continue;
        for (const o of list) {
          if (y > o.top) continue;
          const ddx = o.x - x;
          const ddz = o.z - z;
          const rr = o.r + r;
          if (ddx * ddx + ddz * ddz < rr * rr) return o;
        }
      }
    }
    return null;
  }
}
