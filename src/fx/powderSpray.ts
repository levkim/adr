import * as THREE from 'three';
import { CONFIG } from '../config';

// 월드 파우더 스프레이: 고정 풀 GPU 파티클.
// CPU는 방출 시 링버퍼에 초기값만 기록, 이동/페이드는 전부 버텍스 셰이더에서.

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uGravity;
  uniform float uExpand;
  attribute vec3 aVel;
  attribute float aBirth;
  attribute float aLife;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    float age = uTime - aBirth;
    float t = age / aLife;
    if (t < 0.0 || t > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    vec3 pos = position + aVel * age;
    pos.y -= 0.5 * uGravity * age * age;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 + uExpand * t) * 320.0 / max(-mv.z, 0.5);
    vAlpha = (1.0 - t) * (1.0 - t);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.1, length(d)) * vAlpha * uOpacity;
    if (a < 0.012) discard;
    gl_FragColor = vec4(0.95, 0.97, 1.0, a);
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
    this.material.uniforms.uOpacity.value = CONFIG.fx.spray.opacity;
  }
}

function dynAttr(arr: Float32Array, itemSize: number): THREE.BufferAttribute {
  const a = new THREE.BufferAttribute(arr, itemSize);
  a.setUsage(THREE.DynamicDrawUsage);
  return a;
}
