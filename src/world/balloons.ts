import * as THREE from 'three';
import { CONFIG } from '../config';

// 장소명(한글/영문) 프랑카드를 매단 열기구 4개. 캐릭터 기준 동·서·남·북 방향,
// 일정한 고각(angleDeg)·거리(distance)·고도를 유지하며 따라다닌다. 천은 CPU 정점 웨이브로 펄럭임.

const BANNER_W = 7.0; // m, 프랑카드 가로
const BANNER_H = 2.0; // m, 세로
const ENVELOPE_R = 2.6; // m, 풍선 반지름

// 동·서·남·북 수평 단위벡터 (월드축 고정). N=-z, S=+z, E=+x, W=-x.
const DIRS: { name: string; dir: THREE.Vector3; color: number }[] = [
  { name: 'E', dir: new THREE.Vector3(1, 0, 0), color: 0xe5533a },
  { name: 'W', dir: new THREE.Vector3(-1, 0, 0), color: 0x3a9ae0 },
  { name: 'S', dir: new THREE.Vector3(0, 0, 1), color: 0xf2b134 },
  { name: 'N', dir: new THREE.Vector3(0, 0, -1), color: 0x46c98b },
];

interface BalloonUnit {
  group: THREE.Group;
  banner: THREE.Mesh;
  bannerBase: Float32Array;
  offset: THREE.Vector3; // 캐릭터 기준 목표 오프셋 (수평*horiz + y=height)
  phase: number; // 부유 위상
}

export class LocationBalloons {
  readonly group = new THREE.Group();
  private readonly units: BalloonUnit[] = [];
  private readonly _target = new THREE.Vector3();

  constructor(nameKr: string, nameEn: string) {
    const tex = new THREE.CanvasTexture(bannerCanvas(nameKr, nameEn));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    const rad = THREE.MathUtils.degToRad(CONFIG.balloons.angleDeg);
    const horiz = CONFIG.balloons.distance * Math.cos(rad);
    const height = CONFIG.balloons.distance * Math.sin(rad);

    DIRS.forEach((d, i) => {
      const unit = this.buildBalloon(tex, d.color);
      unit.offset = d.dir.clone().multiplyScalar(horiz);
      unit.offset.y = height;
      unit.phase = (i / DIRS.length) * Math.PI * 2;
      this.units.push(unit);
      this.group.add(unit.group);
    });
  }

  private buildBalloon(tex: THREE.Texture, color: number): BalloonUnit {
    const g = new THREE.Group();

    // 풍선 외피 (구를 물방울 형태로 살짝 늘림)
    const envelope = new THREE.Mesh(
      new THREE.SphereGeometry(ENVELOPE_R, 18, 14),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.0 }),
    );
    envelope.scale.set(1, 1.25, 1);
    envelope.position.y = ENVELOPE_R * 1.25;
    envelope.castShadow = true;

    // 바구니
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
    );
    basket.position.y = -0.4;
    basket.castShadow = true;

    // 외피↔바구니 줄 4가닥
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x3a3027, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), ropeMat);
        rope.position.set(sx * 0.4, 0.3, sz * 0.4);
        rope.rotation.x = sz * 0.18;
        rope.rotation.z = -sx * 0.18;
        g.add(rope);
      }
    }

    // 프랑카드: 바구니 아래에 매달려 펄럭임. 천 윗변(y=0)이 매달리고 아래로 늘어짐.
    const geo = new THREE.PlaneGeometry(BANNER_W, BANNER_H, 24, 6);
    geo.translate(0, -BANNER_H / 2, 0);
    const banner = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.7,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.25, // 하늘 역광에서도 글자가 읽히게 살짝 자발광
      }),
    );
    banner.position.y = -1.0; // 바구니 바로 아래
    banner.castShadow = true;

    g.add(envelope, basket, banner);
    return {
      group: g,
      banner,
      bannerBase: Float32Array.from(geo.getAttribute('position').array as Float32Array),
      offset: new THREE.Vector3(),
      phase: 0,
    };
  }

  /** @param riderPos 캐릭터 위치, @param t 누적 시간(초) */
  update(dt: number, riderPos: THREE.Vector3, t: number): void {
    this.group.visible = CONFIG.balloons.enabled;
    if (!CONFIG.balloons.enabled) return;

    const k = 1 - Math.exp(-CONFIG.balloons.followLerp * dt);
    for (const u of this.units) {
      // 목표: 캐릭터 + 오프셋, 거기에 상하 부유
      const bob = Math.sin(t * CONFIG.balloons.bobSpeed + u.phase) * CONFIG.balloons.bob;
      this._target.copy(riderPos).add(u.offset);
      this._target.y += bob;
      u.group.position.lerp(this._target, k);

      // 프랑카드가 캐릭터를 향하도록 Y축 빌보드 (글자가 항상 읽히게)
      const dx = riderPos.x - u.group.position.x;
      const dz = riderPos.z - u.group.position.z;
      u.group.rotation.y = Math.atan2(dx, dz);

      // 천 펄럭임 (정점 웨이브 + 약한 흔들림)
      const pos = u.banner.geometry.getAttribute('position') as THREE.BufferAttribute;
      const base = u.bannerBase;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const sway = (bx / BANNER_W + 0.5); // 한쪽 끝일수록 크게
        const z = Math.sin(bx * 1.6 - t * 5 + u.phase) * 0.32 * sway +
          Math.sin(by * 2.0 - t * 6) * 0.1;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
      u.banner.geometry.computeVertexNormals();
    }
  }
}

// 한글명(위, 큰 글씨) + 영문명(아래)을 담은 프랑카드 텍스처.
function bannerCanvas(kr: string, en: string): HTMLCanvasElement {
  const w = 1024;
  const h = 288;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  // 배경: 크림색 천 + 테두리
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2f6fb0';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, w - 14, h - 14);
  // 상단 액센트 띠
  ctx.fillStyle = '#2f6fb0';
  ctx.fillRect(14, 14, w - 28, 10);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#16202b';
  ctx.font = '700 92px system-ui, -apple-system, sans-serif';
  ctx.fillText(kr, w / 2, 138, w - 70);
  ctx.fillStyle = '#3a5066';
  ctx.font = '600 56px system-ui, -apple-system, sans-serif';
  ctx.fillText(en, w / 2, 218, w - 70);

  return c;
}
