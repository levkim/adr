import * as THREE from 'three';
import { tournskiLogoCanvas } from '../ui/brand';
import type { Terrain } from './terrain';

// 시작·베이스 지점에 펄럭이는 tournski 깃발. 폴 + 천(로고 텍스처) + CPU 정점 웨이브.
// 깃발 2개뿐이라 매 프레임 정점/법선 갱신 비용은 무시 가능.

const FLAG_W = 5.0; // 크게(멀리서도 보이게) + 캐릭터 키 높이에 배치
const FLAG_H = 1.7;
const POLE_H = 3.6; // 라이더 눈높이 부근
const FLAG_Y = 1.9; // 깃발 중심 높이(캐릭터 키 ~1.7m 부근)

export class Flags {
  readonly group = new THREE.Group();
  private readonly waving: { geo: THREE.BufferGeometry; base: Float32Array }[] = [];

  constructor(terrain: Terrain, start: { x: number; z: number }, finish: { x: number; z: number }) {
    const tex = new THREE.CanvasTexture(tournskiLogoCanvas(900, 270, '#f5f8fc'));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const flagMat = new THREE.MeshStandardMaterial({
      map: tex,
      side: THREE.DoubleSide,
      roughness: 0.7,
    });
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xdfe3e8,
      roughness: 0.4,
      metalness: 0.3,
    });

    const spots: { p: { x: number; z: number }; accent: number; yaw: number }[] = [
      { p: start, accent: 0x46c98b, yaw: 0.5 }, // 출발 (초록)
      { p: finish, accent: 0x3a9ae0, yaw: -0.7 }, // 베이스 (파랑)
    ];
    for (const { p, accent, yaw } of spots) {
      const f = new THREE.Group();
      f.position.set(p.x, terrain.getHeight(p.x, p.z), p.z);
      f.rotation.y = yaw;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, POLE_H, 10), poleMat);
      pole.position.y = POLE_H / 2;
      pole.castShadow = true;

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 10),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 }),
      );
      ball.position.y = POLE_H + 0.1;

      const geo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, 24, 1);
      geo.translate(FLAG_W / 2, 0, 0); // 왼쪽 끝(x=0)이 폴에 고정
      const flag = new THREE.Mesh(geo, flagMat);
      flag.position.set(0.1, FLAG_Y, 0); // 캐릭터 키 높이
      flag.castShadow = true;

      this.waving.push({
        geo,
        base: Float32Array.from(geo.getAttribute('position').array as Float32Array),
      });
      f.add(pole, ball, flag);
      this.group.add(f);
    }
  }

  /** @param t 누적 시간(초) */
  update(t: number): void {
    for (const w of this.waving) {
      const pos = w.geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = w.base[i * 3];
        const k = x / FLAG_W; // 폴(0)에서 고정, 자유단(1)에서 최대
        const z = (Math.sin(x * 2.4 - t * 6) * 0.42 + Math.sin(x * 4.2 - t * 9) * 0.13) * k;
        pos.setZ(i, z);
        pos.setY(i, w.base[i * 3 + 1] + Math.sin(x * 3.2 - t * 7) * 0.1 * k);
      }
      pos.needsUpdate = true;
      w.geo.computeVertexNormals();
    }
  }
}
