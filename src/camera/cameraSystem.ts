import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Input } from '../core/input';
import type { RiderController } from '../player/controller';
import type { Terrain } from '../world/terrain';

// 다중 시점 카메라 시스템. C 키로 순환 전환, 모든 전환은 부드럽게 보간.
// 각 모드는 매 프레임 목표 위치/시선/FOV를 계산하고,
// 시스템이 추적 보간·전환 블렌드·지면 클리어런스·셰이크를 공통 처리한다.

export type CameraModeId = 'third' | 'first' | 'shoulder' | 'drone' | 'front';

const MODE_ORDER: CameraModeId[] = ['third', 'first', 'shoulder', 'drone', 'front'];

export const MODE_LABEL: Record<CameraModeId, string> = {
  third: '3인칭 / 3rd',
  first: '1인칭 고글 / POV',
  shoulder: '숄더 / Shoulder',
  drone: '드론 / Drone',
  front: '정면 / Front',
};

interface ModeTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
  /** 추적 보간 속도 (1/s). Infinity면 강체 부착(1인칭) */
  stiffness: number;
  /** rad, 시선축 롤 (1인칭 턴 기울임) */
  roll: number;
  /** 착지 셰이크 반영 배율 */
  shakeFactor: number;
}

export class CameraSystem {
  readonly camera: THREE.PerspectiveCamera;
  /** 1인칭 전용 기어(보드 팁/장갑) — 카메라에 부착 */
  readonly fpGear: THREE.Group;

  private modeIndex = 0;
  private cycleRequested = false; // 외부(시점 버튼 탭) 순환 요청
  private shakeEnergy = 0;
  private time = 0;
  private bobPhase = 0;
  // 추적 상태 (보간 누적값)
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private fov = CONFIG.camera.fov;
  private roll = 0;
  // 전환 블렌드
  private transitionT = 1; // 1이면 전환 없음
  private readonly fromPos = new THREE.Vector3();
  private readonly fromLook = new THREE.Vector3();
  private fromFov = CONFIG.camera.fov;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, 0.1, CONFIG.camera.far);
    this.fpGear = buildFpGear();
    this.fpGear.visible = false;
    this.camera.add(this.fpGear);
  }

  get modeId(): CameraModeId {
    return MODE_ORDER[this.modeIndex];
  }

  /** 외부(시점 버튼 탭)에서 다음 카메라로 순환 */
  cycle(): void {
    this.cycleRequested = true;
  }

  snapTo(rider: RiderController, terrain: Terrain): void {
    this.computeTarget(rider, terrain, 0, _target);
    this.pos.copy(_target.position);
    this.look.copy(_target.lookAt);
    this.fov = _target.fov;
    this.roll = 0;
    this.shakeEnergy = 0;
    this.transitionT = 1;
    this.apply();
  }

  update(dt: number, input: Input, rider: RiderController, terrain: Terrain): void {
    const c = CONFIG.camera;
    this.time += dt;

    // 모드 순환 (C 키 또는 시점 버튼 탭)
    if (input.justPressed('KeyC') || this.cycleRequested) {
      this.cycleRequested = false;
      this.fromPos.copy(this.pos);
      this.fromLook.copy(this.look);
      this.fromFov = this.fov;
      this.modeIndex = (this.modeIndex + 1) % MODE_ORDER.length;
      this.transitionT = 0;
    }
    this.fpGear.visible = this.modeId === 'first';

    // 착지 셰이크 에너지
    if (rider.physics.landedThisFrame) {
      this.shakeEnergy = Math.min(
        1,
        this.shakeEnergy + rider.physics.lastImpact * c.shakeImpactScale,
      );
    }
    this.shakeEnergy *= Math.exp(-c.shakeDecay * dt);

    // 활성 모드 목표 계산
    this.computeTarget(rider, terrain, dt, _target);

    if (this.transitionT < 1) {
      // 전환 블렌드: 스냅샷 → 라이브 목표 (smoothstep)
      this.transitionT = Math.min(1, this.transitionT + dt / c.transitionTime);
      const s = this.transitionT * this.transitionT * (3 - 2 * this.transitionT);
      this.pos.lerpVectors(this.fromPos, _target.position, s);
      this.look.lerpVectors(this.fromLook, _target.lookAt, s);
      this.fov = this.fromFov + (_target.fov - this.fromFov) * s;
      this.roll = _target.roll * s;
    } else if (_target.stiffness === Infinity) {
      // 강체 부착 (1인칭)
      this.pos.copy(_target.position);
      this.look.copy(_target.lookAt);
      const ft = 1 - Math.exp(-c.fovLerp * 3 * dt);
      this.fov += (_target.fov - this.fov) * ft;
      this.roll = _target.roll;
    } else {
      const t = 1 - Math.exp(-_target.stiffness * dt);
      this.pos.lerp(_target.position, t);
      this.look.lerp(_target.lookAt, t);
      const ft = 1 - Math.exp(-c.fovLerp * dt);
      this.fov += (_target.fov - this.fov) * ft;
      this.roll = _target.roll;
    }

    // 지면 클리어런스
    const minY = terrain.getHeight(this.pos.x, this.pos.z) + c.terrainClearance;
    if (this.pos.y < minY) this.pos.y = minY;

    this.apply(_target.shakeFactor);
  }

  /** 보간 상태를 실제 카메라에 반영 (+셰이크/롤) */
  private apply(shakeFactor = 1): void {
    const c = CONFIG.camera;
    this.camera.position.copy(this.pos);
    if (this.shakeEnergy > 1e-3 && shakeFactor > 0) {
      const amp = this.shakeEnergy * c.shakeMaxAmp * shakeFactor;
      this.camera.position.x += Math.sin(this.time * 37) * amp;
      this.camera.position.y += Math.sin(this.time * 53 + 1.3) * amp * 0.7;
      this.camera.position.z += Math.sin(this.time * 41 + 2.1) * amp;
    }
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
    if (this.roll !== 0) this.camera.rotateZ(this.roll);
    if (Math.abs(this.camera.fov - this.fov) > 1e-3) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  // ── 모드별 목표 계산 ────────────────────────────────────
  private computeTarget(
    rider: RiderController,
    terrain: Terrain,
    dt: number,
    out: ModeTarget,
  ): void {
    const c = CONFIG.camera;
    const phy = rider.physics;
    const speed = phy.speed;
    const heading = phy.heading;
    _fwd.set(Math.sin(heading), 0, Math.cos(heading));

    switch (this.modeId) {
      case 'third': {
        const m = c.third;
        const dist = m.distance + speed * m.distanceSpeedGain + (phy.grounded ? 0 : m.airPullback);
        out.position.copy(phy.position).addScaledVector(_fwd, -dist);
        out.position.y = phy.position.y + m.height;
        out.lookAt.copy(phy.position);
        out.lookAt.y += m.lookAtHeight;
        out.fov = c.fov + Math.min(speed * m.fovSpeedGain, m.fovMaxBoost);
        out.stiffness = m.followLerp;
        out.roll = 0;
        out.shakeFactor = 1;
        break;
      }
      case 'first': {
        const m = c.first;
        const k = m.motionIntensity;
        // 시점: 머리 위치 (크라우치 시 하강)
        const head = m.headHeight - m.crouchDrop * rider.crouchAmount;
        out.position.copy(phy.position);
        out.position.y += head;
        // 주행 바운스 (접지·속도 비례, 강도 설정 반영)
        if (phy.grounded && speed > 1) {
          this.bobPhase += dt * Math.PI * 2 * m.bobFreq * (speed / 10);
          const bobScale = Math.min(speed / 10, 1) * k;
          out.position.y += Math.sin(this.bobPhase) * m.bobAmp * bobScale;
        }
        // 시선: 보드 방향 + 속도 방향 블렌드 (멀미 줄이고 라인이 보이게)
        _lookDir.copy(_fwd);
        if (speed > 2) {
          _velDir.copy(phy.velocity).normalize();
          _lookDir.lerp(_velDir, m.lookAhead * Math.min(speed / 10, 1)).normalize();
        }
        out.lookAt.copy(out.position).addScaledVector(_lookDir, 10);
        out.fov = c.fov + m.fovBoost + Math.min(speed * m.fovSpeedGain, m.fovMaxBoost);
        out.stiffness = Infinity;
        // 턴 롤 (조향 중 기울임)
        out.roll = -this.steerSmooth(rider, dt) * m.rollMax * k;
        out.shakeFactor = m.shakeFactor * k;
        break;
      }
      case 'shoulder': {
        const m = c.shoulder;
        _side.set(_fwd.z, 0, -_fwd.x); // 우측
        out.position
          .copy(phy.position)
          .addScaledVector(_fwd, -m.back)
          .addScaledVector(_side, m.side);
        out.position.y = phy.position.y + m.up;
        out.lookAt.copy(phy.position).addScaledVector(_fwd, 4);
        out.lookAt.y = phy.position.y + m.lookAtHeight;
        out.fov = c.fov + m.fovBoost + Math.min(speed * m.fovSpeedGain, m.fovMaxBoost);
        out.stiffness = m.followLerp;
        out.roll = 0;
        out.shakeFactor = 1;
        break;
      }
      case 'drone': {
        const m = c.drone;
        _side.set(_fwd.z, 0, -_fwd.x);
        out.position
          .copy(phy.position)
          .addScaledVector(_fwd, m.ahead)
          .addScaledVector(_side, m.side);
        out.position.y = phy.position.y + m.height;
        out.lookAt.copy(phy.position);
        out.lookAt.y += 1;
        out.fov = m.fov;
        out.stiffness = m.followLerp;
        out.roll = 0;
        out.shakeFactor = 0; // 드론은 흔들리지 않는다
        break;
      }
      case 'front': {
        // 정면 뷰: 라이더 진행 방향 앞에서 라이더를 마주본다 (얼굴이 다가옴)
        const m = c.front;
        const dist = m.distance + speed * m.distanceSpeedGain;
        out.position.copy(phy.position).addScaledVector(_fwd, dist);
        out.position.y = phy.position.y + m.height;
        out.lookAt.copy(phy.position);
        out.lookAt.y += m.lookAtHeight;
        out.fov = c.fov + Math.min(speed * m.fovSpeedGain, m.fovMaxBoost);
        out.stiffness = m.followLerp;
        out.roll = 0;
        out.shakeFactor = 0.6;
        break;
      }
    }
    // 목표 지점도 지면 위로
    const minY = terrain.getHeight(out.position.x, out.position.z) + c.terrainClearance;
    if (out.position.y < minY) out.position.y = minY;
  }

  // 조향 입력의 시각적 스무딩 (1인칭 롤용)
  private steerValue = 0;
  private steerSmooth(rider: RiderController, dt: number): number {
    const target = rider.lastSteer;
    this.steerValue += (target - this.steerValue) * (1 - Math.exp(-6 * dt));
    return this.steerValue;
  }
}

/** 1인칭 시야 하단 기어: 보드 팁 + 장갑 */
function buildFpGear(): THREE.Group {
  const g = new THREE.Group();
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.4 });
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.6, 4, 10), boardMat);
  tip.rotation.x = Math.PI / 2 - 0.12;
  tip.scale.set(1, 1, 0.28);
  tip.position.set(0, -0.5, -1.05);
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1f2733, roughness: 0.85 });
  const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), gloveMat);
  gloveL.scale.set(1, 0.8, 1.25);
  gloveL.position.set(-0.32, -0.38, -0.6);
  const gloveR = gloveL.clone();
  gloveR.position.x = 0.32;
  g.add(tip, gloveL, gloveR);
  return g;
}

const _target: ModeTarget = {
  position: new THREE.Vector3(),
  lookAt: new THREE.Vector3(),
  fov: CONFIG.camera.fov,
  stiffness: 4,
  roll: 0,
  shakeFactor: 1,
};
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _velDir = new THREE.Vector3();
