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

    // 사면 정렬(접지) 또는 수평(공중) + yaw, 부드럽게 보간
    const targetUp = this.physics.grounded ? this.physics.groundNormal : _up;
    _align.setFromUnitVectors(_up, targetUp);
    _yaw.setFromAxisAngle(_up, this.physics.heading);
    _target.multiplyQuaternions(_align, _yaw);
    this.object.quaternion.slerp(_target, 1 - Math.exp(-10 * dt));
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _align = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();
const _target = new THREE.Quaternion();
