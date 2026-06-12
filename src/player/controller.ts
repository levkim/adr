import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Input } from '../core/input';
import type { Terrain } from '../world/terrain';
import { RiderPhysics } from './physics';

// 캡슐 라이더: 물리 상태를 시각화하고 사면에 맞춰 기울인다.
export class RiderController {
  readonly object = new THREE.Group();
  readonly physics = new RiderPhysics();
  /** 0=서있음, 1=완전 크라우치 (시각 보간값, 카메라도 참조) */
  crouchAmount = 0;
  /** 최근 조향 입력 (-1~1, 1인칭 헤드 롤용) */
  lastSteer = 0;
  /** rad, 현재 턴 린 각 (+ = 우측으로 기울임) */
  lean = 0;
  private readonly body: THREE.Mesh;

  constructor() {
    const c = CONFIG.rider;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(c.radius, c.height - c.radius * 2, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xd9472b, roughness: 0.7 }),
    );
    body.position.y = c.height / 2;
    body.castShadow = true;
    this.body = body;

    // 진행 방향 표시용 노즈 마커
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5 }),
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.35, c.radius + 0.25);
    nose.castShadow = true;

    this.object.add(body, nose);
  }

  /** 드랍 인 지점에 배치 */
  spawnAt(x: number, z: number, heading: number, terrain: Terrain): void {
    this.physics.reset(x, terrain.getHeight(x, z), z, heading);
    this.object.position.copy(this.physics.position);
    this.object.quaternion.setFromAxisAngle(_up, heading);
  }

  update(dt: number, input: Input, terrain: Terrain): void {
    this.lastSteer = input.steer;
    this.physics.update(dt, input, terrain);
    this.object.position.copy(this.physics.position);

    // 크라우치 자세 (캡슐 눌림) — 푸시 중 저속에서는 생략
    const wantCrouch =
      this.physics.crouching && (this.physics.speed > CONFIG.physics.pushMaxSpeed || !this.physics.grounded);
    const target = wantCrouch ? 1 : 0;
    const ct = 1 - Math.exp(-CONFIG.rider.crouchVisualLerp * dt);
    this.crouchAmount += (target - this.crouchAmount) * ct;
    const squash = 1 - 0.35 * this.crouchAmount;
    this.body.scale.set(1, squash, 1);
    this.body.position.y = (CONFIG.rider.height / 2) * squash;

    // ── 자세 ──
    // 몸은 기본 수직(중력 정렬). 사면 법선은 slopeAlign 비율만 블렌드 (무릎 흡수)
    const r = CONFIG.rider;
    if (this.physics.grounded) {
      _bodyUp.copy(_up).lerp(this.physics.groundNormal, r.slopeAlign).normalize();
    } else {
      _bodyUp.copy(_up);
    }
    _align.setFromUnitVectors(_up, _bodyUp);
    _yaw.setFromAxisAngle(_up, this.physics.heading);
    _target.multiplyQuaternions(_align, _yaw);
    // 턴 린: 원심가속도 v·ω 와 중력의 균형 각도만큼 턴 안쪽으로 기울임
    const leanTarget = this.physics.grounded
      ? THREE.MathUtils.clamp(
          Math.atan2(-this.physics.yawRate * this.physics.speed, CONFIG.physics.gravity),
          -r.leanMax,
          r.leanMax,
        )
      : 0;
    this.lean += (leanTarget - this.lean) * (1 - Math.exp(-r.leanResponse * dt));
    _roll.setFromAxisAngle(_fwdAxis, this.lean);
    _target.multiply(_roll);
    this.object.quaternion.slerp(_target, 1 - Math.exp(-10 * dt));
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _fwdAxis = new THREE.Vector3(0, 0, 1);
const _bodyUp = new THREE.Vector3();
const _align = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _target = new THREE.Quaternion();
