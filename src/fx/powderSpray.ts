import * as THREE from 'three';
import { CONFIG } from '../config';

// 월드 파우더 스프레이: 고정 풀 GPU 파티클.
// CPU는 방출 시 링버퍼에 초기값만 기록, 이동/페이드는 전부 버텍스 셰이더에서.

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uGravity;
  uniform float uExpand;
  uniform float uTurb;
  attribute vec3 aVel;
  attribute float aBirth;
  attribute float aLife;
  attribute float aSize;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    float age = uTime - aBirth;
    float t = age / aLife;
    if (t < 0.0 || t > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    // 입자별 고유 시드 (방출 시각 기반) → 난류 위상 분산
    float seed = fract(aBirth * 13.17 + aSize * 7.31);
    vSeed = seed;
    float ph = seed * 6.2831;
    vec3 pos = position + aVel * age;
    pos.y -= 0.5 * uGravity * age * age;
    // 난류: 나이가 들수록 좌우/상하로 부드럽게 흔들려 파우더가 흩어지는 느낌
    float drift = uTurb * t;
    pos.x += sin(ph + age * 3.1) * drift;
    pos.z += cos(ph * 1.7 + age * 2.6) * drift;
    pos.y += sin(ph * 2.3 + age * 4.0) * drift * 0.4;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 + uExpand * t) * 320.0 / max(-mv.z, 0.5);
    // 페이드: 태어날 때 살짝 부풀어 오르고(0→0.15 구간 인) 이후 서서히 사라짐
    float fadeIn = smoothstep(0.0, 0.12, t);
    float fadeOut = (1.0 - t) * (1.0 - t);
    vAlpha = fadeIn * fadeOut;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    // 푹신한 가우시안형 falloff + 은은한 코어 → 솜털 같은 파우더
    float soft = smoothstep(0.5, 0.0, r);
    float fluff = pow(soft, 1.6);
    float core = smoothstep(0.32, 0.0, r) * 0.35;
    float a = (fluff + core) * vAlpha * uOpacity;
    if (a < 0.01) discard;
    // 입자마다 미세한 청백 색조 변이 (그늘진 눈가루 느낌)
    vec3 tint = mix(vec3(0.92, 0.95, 1.0), vec3(1.0, 1.0, 1.0), vSeed);
    gl_FragColor = vec4(tint, clamp(a, 0.0, 1.0));
  }
`;

export class PowderSpray {
  readonly points: THREE.Points;
  private readonly origins: Float32Array;
  private readonly vels: Float32Array;
  private readonly births: Float32Array;
  private readonly lives: Float32Array;
  private readonly sizes: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private cursor = 0;
  private time = 0;
  private emitDebt = 0; // 소수점 방출량 누적

  constructor() {
    const n = CONFIG.fx.spray.poolSize;
    this.origins = new Float32Array(n * 3);
    this.vels = new Float32Array(n * 3);
    this.births = new Float32Array(n).fill(-1e9); // 전부 만료 상태로 시작
    this.lives = new Float32Array(n).fill(1);
    this.sizes = new Float32Array(n);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', dynAttr(this.origins, 3));
    this.geometry.setAttribute('aVel', dynAttr(this.vels, 3));
    this.geometry.setAttribute('aBirth', dynAttr(this.births, 1));
    this.geometry.setAttribute('aLife', dynAttr(this.lives, 1));
    this.geometry.setAttribute('aSize', dynAttr(this.sizes, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: CONFIG.fx.spray.gravity },
        uExpand: { value: CONFIG.fx.spray.expand },
        uTurb: { value: CONFIG.fx.spray.turbulence },
        uOpacity: { value: CONFIG.fx.spray.opacity },
      },
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  /** rate(입자/초)만큼 방출 누적, 정수 개수가 모이면 기록 */
  emitContinuous(
    dt: number,
    origin: THREE.Vector3,
    baseVel: THREE.Vector3,
    sideDir: THREE.Vector3,
    sideAmount: number,
    rate: number,
    spreadRadius: number,
  ): void {
    this.emitDebt += rate * dt;
    const count = Math.floor(this.emitDebt);
    if (count <= 0) return;
    this.emitDebt -= count;
    this.emitBurst(origin, baseVel, sideDir, sideAmount, count, spreadRadius);
  }

  emitBurst(
    origin: THREE.Vector3,
    baseVel: THREE.Vector3,
    sideDir: THREE.Vector3,
    sideAmount: number,
    count: number,
    spreadRadius: number,
  ): void {
    const s = CONFIG.fx.spray;
    const n = s.poolSize;
    for (let i = 0; i < count; i++) {
      const j = this.cursor;
      this.cursor = (this.cursor + 1) % n;
      const j3 = j * 3;
      this.origins[j3] = origin.x + (Math.random() - 0.5) * spreadRadius * 2;
      this.origins[j3 + 1] = origin.y + Math.random() * spreadRadius;
      this.origins[j3 + 2] = origin.z + (Math.random() - 0.5) * spreadRadius * 2;
      this.vels[j3] =
        baseVel.x * s.inheritVel +
        sideDir.x * sideAmount * (0.4 + Math.random() * 0.6) +
        (Math.random() - 0.5) * 1.2;
      this.vels[j3 + 1] = baseVel.y * s.inheritVel * 0.3 + s.upVel * (0.4 + Math.random() * 0.9);
      this.vels[j3 + 2] =
        baseVel.z * s.inheritVel +
        sideDir.z * sideAmount * (0.4 + Math.random() * 0.6) +
        (Math.random() - 0.5) * 1.2;
      this.births[j] = this.time;
      this.lives[j] = s.life * (1 + (Math.random() - 0.5) * s.lifeJitter);
      this.sizes[j] = s.size * (1 + (Math.random() - 0.5) * s.sizeJitter);
    }
    for (const name of ['position', 'aVel', 'aBirth', 'aLife', 'aSize']) {
      (this.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
    this.material.uniforms.uGravity.value = CONFIG.fx.spray.gravity;
    this.material.uniforms.uExpand.value = CONFIG.fx.spray.expand;
    this.material.uniforms.uTurb.value = CONFIG.fx.spray.turbulence;
    this.material.uniforms.uOpacity.value = CONFIG.fx.spray.opacity;
  }
}

function dynAttr(arr: Float32Array, itemSize: number): THREE.BufferAttribute {
  const a = new THREE.BufferAttribute(arr, itemSize);
  a.setUsage(THREE.DynamicDrawUsage);
  return a;
}
