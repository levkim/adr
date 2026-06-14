import * as THREE from 'three';
import { CONFIG, type CharacterId } from '../config';
import type { Input } from '../core/input';
import type { Terrain } from '../world/terrain';
import type { Props } from '../world/props';
import { RiderPhysics } from './physics';
import { RiderModel } from './riderModel';
import { Horse, HORSE_BACK_Y } from './horse';

// 라이더: 물리 상태를 절차적 풀기어 모델로 시각화한다.
// object가 yaw/경사정렬/턴 린/전후 피치/낙상을 처리하고, 모델이 사지를 포즈한다.
// 평지 탈출용 '말 타기' 모드를 가진다(중력 무시·최대 60km/h 주행).
export class RiderController {
  readonly object = new THREE.Group();
  readonly physics = new RiderPhysics();
  /** 0=서있음, 1=완전 크라우치 (시각 보간값, 카메라도 참조) */
  crouchAmount = 0;
  /** 최근 조향 입력 (-1~1, 1인칭 헤드 롤용) */
  lastSteer = 0;
  /** rad, 현재 턴 린 각 (+ = 우측으로 기울임) */
  lean = 0;
  /** 말 타기 상태 */
  mounted = false;
  private horseSpeed = 0;
  private readonly horse = new Horse();
  private crashTip = 0; // 0~1, 낙상 쓰러짐 보간
  private readonly baseQuat = new THREE.Quaternion(); // 스무딩된 베이스 방향(플립 제외)
  private model: RiderModel;

  constructor(characterId: CharacterId = CONFIG.rider.character) {
    this.model = new RiderModel(CONFIG.characters[characterId]);
    this.object.add(this.model.group);
    this.horse.group.visible = false;
    this.object.add(this.horse.group);
  }

  /** 말에 올라탄다 (현재 속도 계승) */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.horse.group.visible = true;
    this.model.group.position.set(0, HORSE_BACK_Y, -0.05);
    this.horseSpeed = Math.max(0, this.physics.speed);
    this.physics.grounded = true;
  }

  /** 말에서 내린다 (속도 계승해 스키 물리로 복귀) */
  dismount(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.horse.group.visible = false;
    this.model.group.position.set(0, 0, 0);
    this.physics.grounded = true;
  }

  /** 캐릭터 교체 (모델 재생성) */
  setCharacter(characterId: CharacterId): void {
    this.object.remove(this.model.group);
    this.model.dispose();
    this.model = new RiderModel(CONFIG.characters[characterId]);
    this.object.add(this.model.group);
  }

  /** 드랍 인 지점에 배치 */
  spawnAt(x: number, z: number, heading: number, terrain: Terrain): void {
    this.dismount();
    this.physics.reset(x, terrain.getHeight(x, z), z, heading);
    this.object.position.copy(this.physics.position);
    this.object.quaternion.setFromAxisAngle(_up, heading);
    this.baseQuat.copy(this.object.quaternion);
    this.crouchAmount = 0;
    this.lean = 0;
    this.crashTip = 0;
  }

  update(dt: number, input: Input, terrain: Terrain, props?: Props): void {
    if (this.mounted) {
      this.horseUpdate(dt, input, terrain);
      return;
    }
    this.lastSteer = this.physics.crashed ? 0 : input.steer;
    this.physics.update(dt, input, terrain, props);
    this.object.position.copy(this.physics.position);

    // 크라우치 보간값 (모델 포즈 + 카메라 헤드 드롭에서 참조)
    const target = this.physics.crouching ? 1 : 0;
    const ct = 1 - Math.exp(-CONFIG.rider.crouchVisualLerp * dt);
    this.crouchAmount += (target - this.crouchAmount) * ct;

    // ── 몸체 방향 ──
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
    // 낙상: 옆으로 쓰러진 자세
    const crashTarget = this.physics.crashed ? 1 : 0;
    this.crashTip += (crashTarget - this.crashTip) * (1 - Math.exp(-8 * dt));
    if (this.crashTip > 0.01) {
      _crashQ.setFromAxisAngle(_fwdAxis, this.crashTip * 1.45);
      _target.multiply(_crashQ);
    }
    // 베이스 방향(yaw/경사/린/낙상)은 스무딩
    this.baseQuat.slerp(_target, 1 - Math.exp(-10 * dt));
    // 전후 피치(접지=체중이동) / 공중 플립은 직접 적용 — 플립은 다중 회전이라
    // 슬러프하면 최단경로로 감겨 공중제비가 안 보인다
    const pitchAngle = this.physics.grounded
      ? this.physics.leanFore * r.forePitchMax
      : this.physics.flip;
    _pitch.setFromAxisAngle(_rightAxis, pitchAngle);
    this.object.quaternion.multiplyQuaternions(this.baseQuat, _pitch);

    // ── 사지 포즈 ──
    this.model.pose(dt, {
      crouch: this.crouchAmount,
      airborne: !this.physics.grounded,
      crashed: this.physics.crashed,
      speed: this.physics.speed,
      lean: this.lean,
    });
  }

  /** 말 타기 주행: 중력 무시, 조이스틱/키보드로 조향·가감속(최대 60km/h), 지면 추종 */
  private horseUpdate(dt: number, input: Input, terrain: Terrain): void {
    const h = CONFIG.horse;
    const phy = this.physics;
    this.lastSteer = input.steer;

    phy.heading -= input.steer * h.turnRate * dt;
    // 전진(leanFore+)=가속, 후진(-)=브레이크/후진, 무입력=감속
    if (input.leanFore > 0.1) this.horseSpeed += h.accel * dt;
    else if (input.leanFore < -0.1) this.horseSpeed -= h.brake * dt;
    else {
      const d = h.friction * dt;
      this.horseSpeed = this.horseSpeed > 0 ? Math.max(0, this.horseSpeed - d) : this.horseSpeed;
    }
    this.horseSpeed = THREE.MathUtils.clamp(this.horseSpeed, -h.reverseMax, h.maxSpeed);

    // 이동 + 지형 추종
    _fwdAxisH.set(Math.sin(phy.heading), 0, Math.cos(phy.heading));
    phy.position.addScaledVector(_fwdAxisH, this.horseSpeed * dt);
    const margin = CONFIG.world.edgeMargin;
    phy.position.x = THREE.MathUtils.clamp(
      phy.position.x,
      -terrain.widthMeters / 2 + margin,
      terrain.widthMeters / 2 - margin,
    );
    phy.position.z = THREE.MathUtils.clamp(
      phy.position.z,
      -terrain.depthMeters / 2 + margin,
      terrain.depthMeters / 2 - margin,
    );
    phy.position.y = terrain.getHeight(phy.position.x, phy.position.z);
    // 다운스트림(카메라·미니맵·HUD·채점)이 읽도록 물리 상태 동기화
    phy.velocity.copy(_fwdAxisH).multiplyScalar(this.horseSpeed);
    phy.grounded = true;
    this.object.position.copy(phy.position);

    // 자세: 수직 + 사면 일부 정렬 + yaw
    terrain.getNormal(phy.position.x, phy.position.z, phy.groundNormal);
    _bodyUp.copy(_up).lerp(phy.groundNormal, CONFIG.rider.slopeAlign).normalize();
    _align.setFromUnitVectors(_up, _bodyUp);
    _yaw.setFromAxisAngle(_up, phy.heading);
    _target.multiplyQuaternions(_align, _yaw);
    this.object.quaternion.slerp(_target, 1 - Math.exp(-10 * dt));

    this.horse.update(dt, this.horseSpeed);
    this.model.pose(dt, { crouch: 0, airborne: false, crashed: false, speed: this.horseSpeed, lean: 0 });
  }
}

const _fwdAxisH = new THREE.Vector3();

const _up = new THREE.Vector3(0, 1, 0);
const _fwdAxis = new THREE.Vector3(0, 0, 1);
const _rightAxis = new THREE.Vector3(1, 0, 0);
const _pitch = new THREE.Quaternion();
const _crashQ = new THREE.Quaternion();
const _bodyUp = new THREE.Vector3();
const _align = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _target = new THREE.Quaternion();
