import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Input } from '../core/input';

// 평지 셋업 단계의 캡슐 라이더. heading 방향으로 가감속/조향만 한다.
// 활강 물리(경사 슬라이딩)는 3단계에서 지형 높이 샘플링과 함께 들어온다.
export class RiderController {
  readonly object = new THREE.Group();
  heading = 0; // rad, +Z 기준 yaw
  speed = 0; // m/s, 부호는 전/후진

  constructor() {
    const c = CONFIG.rider;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(c.radius, c.height - c.radius * 2, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xd9472b, roughness: 0.7 }),
    );
    body.position.y = c.height / 2;
    body.castShadow = true;

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

  /** heading 방향 단위 벡터 (rotation.y = heading 과 일치) */
  forwardDir(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  update(dt: number, input: Input): void {
    const c = CONFIG.rider;

    // 조향: 속도가 붙을수록 회전 반경이 커지도록 감쇠
    const speedFactor = 1 / (1 + Math.max(Math.abs(this.speed) - c.turnSpeedRef, 0) / c.turnSpeedRef);
    this.heading -= input.steer * c.turnRate * speedFactor * dt;

    // 가감속
    if (input.throttle > 0) {
      this.speed += c.accel * dt;
    } else if (input.throttle < 0) {
      this.speed -= c.brakeDecel * dt;
    } else {
      // 무입력 시 0을 향해 자연 감속
      const decel = c.friction * dt;
      this.speed = Math.abs(this.speed) <= decel ? 0 : this.speed - Math.sign(this.speed) * decel;
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -c.maxReverseSpeed, c.maxSpeed);

    // 이동 (평지: y는 0 고정)
    const dir = this.forwardDir(_dir);
    this.object.position.addScaledVector(dir, this.speed * dt);
    this.object.rotation.y = this.heading;

    // 평지 경계 밖으로 못 나가게 클램프
    const limit = CONFIG.world.groundSize / 2 - 2;
    this.object.position.x = THREE.MathUtils.clamp(this.object.position.x, -limit, limit);
    this.object.position.z = THREE.MathUtils.clamp(this.object.position.z, -limit, limit);
  }
}

// 루프 내 객체 생성 금지 — update에서 재사용하는 임시 벡터
const _dir = new THREE.Vector3();
