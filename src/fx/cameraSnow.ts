import * as THREE from 'three';
import { CONFIG } from '../config';
import type { CameraModeId } from '../camera/cameraSystem';

// 카메라 부착 근접 파티클: 카메라 전방 원뿔 영역에서 눈입자가
// 시야를 향해 스쳐 지나간다. 모드별 파티클 예산을 drawRange로 분리.

const VERT = /* glsl */ `
  uniform float uTravel;  // 누적 스트리밍 거리 (속도 적분)
  uniform float uTime;
  uniform float uDepth;
  uniform float uSpread;
  uniform float uSize;
  attribute vec3 aSeed; // 0..1
  varying float vAlpha;
  void main() {
    // 원뿔 내 깊이: 시간이 가면 카메라 쪽(-z → 0)으로 흘러와 랩어라운드
    float z = uDepth - mod(aSeed.z * uDepth + uTravel + uTime * 0.6, uDepth);
    float sway = sin(uTime * 1.9 + aSeed.x * 43.0) * 0.12;
    vec3 pos = vec3(
      (aSeed.x - 0.5) * uSpread * (z + 1.5) + sway,
      (aSeed.y - 0.5) * uSpread * (z + 1.5),
      -z - 0.25
    );
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * 340.0 / max(z + 0.3, 0.3);
    // 가장자리(랩 직전/직후) 페이드
    vAlpha = smoothstep(0.05, 0.6, z) * smoothstep(uDepth, uDepth * 0.75, z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(d)) * vAlpha * uOpacity;
    if (a < 0.015) discard;
    gl_FragColor = vec4(0.97, 0.98, 1.0, a);
  }
`;

export class CameraSnow {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;
  private travel = 0;

  constructor() {
    const c = CONFIG.fx.cameraSnow;
    const seeds = new Float32Array(c.poolSize * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    this.geometry = new THREE.BufferGeometry();
    // position은 셰이더에서 계산하지만 three가 요구하므로 시드를 겸용
    this.geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTravel: { value: 0 },
        uTime: { value: 0 },
        uDepth: { value: c.coneDepth },
        uSpread: { value: c.coneSpread },
        uSize: { value: c.size },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false, // 카메라 최근접 레이어
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  update(dt: number, speed: number, sprayIntensity: number, mode: CameraModeId): void {
    const c = CONFIG.fx.cameraSnow;
    const u = this.material.uniforms;
    u.uTime.value += dt;
    this.travel += dt * speed * c.windFactor;
    u.uTravel.value = this.travel;
    u.uDepth.value = c.coneDepth;
    u.uSpread.value = c.coneSpread;
    u.uSize.value = c.size;
    // 밀도: 기본 분위기 + 속도/스프레이 비례, 화면 효과 마스터 반영
    const density = Math.min(1, c.ambientDensity + sprayIntensity * 0.9 + speed / 60);
    u.uOpacity.value = c.opacity * density * CONFIG.fx.screenIntensity;
    // 모드별 예산
    this.geometry.setDrawRange(0, Math.min(c.budgets[mode], c.poolSize));
  }
}
