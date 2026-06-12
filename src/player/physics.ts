import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Input } from '../core/input';
import type { Terrain } from '../world/terrain';
import type { Props } from '../world/props';

// heightmap 기반 경량 활강 물리.
// 접지: 중력의 사면 접선 성분으로 가속, 속도는 표면 평면에 구속.
// 보드 방향(heading)과 속도의 횡차이는 에지 그립으로 감쇠 → 카빙.
// 지면이 빠르게 꺼지면(롤오버/클리프) 공중 탄도 → 높이 샘플링으로 착지.

export class RiderPhysics {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly groundNormal = new THREE.Vector3(0, 1, 0);
  heading = 0; // rad, +Z 기준 보드 yaw
  /** rad/s, 이번 프레임에 실제 적용된 yaw 회전율 (자세 린 계산용) */
  yawRate = 0;
  grounded = true;
  crouching = false;
  /** -1(뒤쏠림)~+1(앞쏠림), 전후 체중이동 (스무딩된 값) */
  leanFore = 0;
  /** 이번 프레임에 착지했는지 (카메라 셰이크 등 소비용) */
  landedThisFrame = false;
  /** 마지막 착지의 지면 수직 충격 속도 (m/s) */
  lastImpact = 0;
  /** 낙상 상태 */
  crashed = false;
  /** 이번 프레임에 낙상 발생 (연출 소비용) */
  crashedThisFrame = false;
  private crashTimer = 0;
  private invulnTimer = 0;

  get speed(): number {
    return this.velocity.length();
  }

  reset(x: number, y: number, z: number, heading: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.groundNormal.set(0, 1, 0);
    this.heading = heading;
    this.grounded = true;
    this.crouching = false;
    this.leanFore = 0;
    this.landedThisFrame = false;
    this.lastImpact = 0;
    this.crashed = false;
    this.crashedThisFrame = false;
    this.crashTimer = 0;
    this.invulnTimer = 0;
  }

  /** 장애물 충돌 등으로 낙상 */
  triggerCrash(): void {
    if (this.crashed || this.invulnTimer > 0) return;
    this.crashed = true;
    this.crashedThisFrame = true;
    this.crashTimer = CONFIG.crash.duration;
    // 충돌 자체로 속도 큰 폭 손실
    this.velocity.multiplyScalar(0.35);
  }

  /** 보드 진행 방향(사면 접선) 단위 벡터 */
  boardDir(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (this.grounded) {
      // 사면 평면에 투영
      out.addScaledVector(this.groundNormal, -out.dot(this.groundNormal)).normalize();
    }
    return out;
  }

  update(dt: number, input: Input, terrain: Terrain, props?: Props): void {
    const p = CONFIG.physics;
    const r = CONFIG.rider;

    this.landedThisFrame = false;
    this.crashedThisFrame = false;
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // 낙상 중: 입력 무시, 강한 마찰로 미끄러지다 일어난다
    if (this.crashed) {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0 && this.speed < CONFIG.crash.minSpeed) {
        this.crashed = false;
        this.invulnTimer = CONFIG.crash.invulnTime;
        this.velocity.set(0, 0, 0);
      }
    }
    const noInput = this.crashed;
    this.crouching = !noInput && input.crouch;
    // 전후 체중이동 스무딩 (W=앞쏠림 +1, S=뒤쏠림 -1)
    const leanInput = noInput ? 0 : input.leanFore;
    this.leanFore += (leanInput - this.leanFore) * (1 - Math.exp(-r.foreLeanResponse * dt));

    // ── 조향: 속도가 붙을수록 회전 반경 증가, 저속에서는 점차 약화 ──
    const speed = this.speed;
    let turnFactor = 1 / (1 + Math.max(speed - r.turnSpeedRef, 0) / r.turnSpeedRef);
    const lowSpeedRamp =
      r.standstillTurnFactor +
      (1 - r.standstillTurnFactor) * Math.min(1, speed / r.minTurnSpeed);
    turnFactor *= lowSpeedRamp;
    if (this.crouching && this.grounded) turnFactor *= p.crouchTurnFactor;
    const headingBefore = this.heading;
    this.heading -= (noInput ? 0 : input.steer) * r.turnRate * turnFactor * dt;

    if (this.grounded) {
      const n = this.groundNormal;

      // 중력의 사면 접선 성분: g_t = g - n(g·n)
      _gravity.set(0, -p.gravity, 0);
      _gravity.addScaledVector(n, p.gravity * n.y); // g - n(g·n), g·n = -G·n.y
      this.velocity.addScaledVector(_gravity, dt);

      // 에지 그립: 보드 횡방향 속도 성분을 지수 감쇠 → 속도가 보드 방향으로 휜다.
      // 깊은 파우더에서는 눈이 무너져 그립이 약해진다 (부유감)
      const snow = CONFIG.snow;
      const board = this.boardDir(_board);
      const along = this.velocity.dot(board);
      _lateral.copy(this.velocity).addScaledVector(board, -along);
      const gripEff = p.edgeGrip * (1 - Math.min(0.7, snow.depth * snow.floatGripLoss));
      const gripDecay = Math.exp(-gripEff * dt);
      this.velocity.copy(_lateral.multiplyScalar(gripDecay)).addScaledVector(board, along);

      // 베이스 활주 마찰 (수직항력 비례). 낙상 중에는 몸이 끌리며 강하게 감속
      let mu = this.crashed ? CONFIG.crash.friction : p.snowFriction;
      if (this.crouching) mu *= p.crouchFrictionFactor;
      const frictionDecel = mu * p.gravity * n.y * dt;
      const v = this.velocity.length();
      if (v > 0) {
        this.velocity.multiplyScalar(Math.max(0, v - frictionDecel) / v);
      }

      // 파우더 플로우 저항: 깊이에 비례, 전후 체중이동·플레이닝으로 조절.
      // 앞쏠림(+1) → 노즈가 떠서 저항 0.2배, 뒤쏠림(-1) → 테일이 박혀 1.8배(브레이크).
      // 속도가 planeSpeed에 가까워지면 보드가 떠올라 저항이 minPlaning까지 감소
      const v1 = this.velocity.length();
      const plow = 1 - snow.foreLeanReduce * this.leanFore;
      const planing = Math.max(snow.minPlaning, 1 - v1 / snow.planeSpeed);
      const powderDecel = snow.powderDrag * snow.depth * plow * planing * dt;
      if (v1 > 0) {
        this.velocity.multiplyScalar(Math.max(0, v1 - powderDecel) / v1);
      }

      // 공기저항 (k·v², 체중 반비례 — 무거울수록 덜 감속)
      const k =
        p.airDrag * (p.massRef / CONFIG.rider.mass) * (this.crouching ? p.crouchDragFactor : 1);
      const v2 = this.velocity.length();
      if (v2 > 0) {
        this.velocity.multiplyScalar(Math.max(0, v2 - k * v2 * v2 * dt) / v2);
      }

      // 점프: 사면 법선 방향 — 체공은 경사·속도에서 자연 발생
      if (input.jumpPressed && !noInput) {
        this.velocity.addScaledVector(n, p.jumpSpeed);
        this.grounded = false;
      }

      // 무조향 시 보드를 진행 방향으로 서서히 정렬
      const v3 = this.velocity.length();
      if (!noInput && input.steer === 0 && v3 > 1) {
        const travelYaw = Math.atan2(this.velocity.x, this.velocity.z);
        let d = travelYaw - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d)); // [-π, π]
        this.heading += d * Math.min(1, p.headingAlign * dt);
      }
    } else {
      // 공중: 중력 + 공기저항 (체중 반비례, 크라우치 시 드래그 감소)
      this.velocity.y -= p.gravity * dt;
      const k =
        p.airDrag * (p.massRef / CONFIG.rider.mass) * (this.crouching ? p.crouchDragFactor : 1);
      const av = this.velocity.length();
      if (av > 0) {
        this.velocity.multiplyScalar(Math.max(0, av - k * av * av * dt) / av);
      }
    }

    this.yawRate = dt > 0 ? (this.heading - headingBefore) / dt : 0;

    // ── 적분 ──
    this.position.addScaledVector(this.velocity, dt);

    // 지형 가장자리 클램프
    const margin = CONFIG.world.edgeMargin;
    const limitX = terrain.widthMeters / 2 - margin;
    const limitZ = terrain.depthMeters / 2 - margin;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limitX, limitX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limitZ, limitZ);

    // ── 장애물 충돌 (나무 줄기/바위) → 낙상 ──
    if (props && !this.crashed && this.invulnTimer <= 0) {
      const hit = props.query(
        this.position.x,
        this.position.z,
        this.position.y,
        CONFIG.rider.radius,
      );
      if (hit) {
        this.triggerCrash();
        // 장애물 밖으로 밀어내 끼임 방지
        _pushOut.set(this.position.x - hit.x, 0, this.position.z - hit.z);
        const d = _pushOut.length();
        if (d > 1e-4) {
          this.position.addScaledVector(
            _pushOut.divideScalar(d),
            hit.r + CONFIG.rider.radius - d + 0.05,
          );
        }
      }
    }

    // ── 지면 판정 (높이 샘플링 충돌) ──
    const groundY = terrain.getHeight(this.position.x, this.position.z);
    if (this.grounded) {
      const gap = this.position.y - groundY;
      // 지면 추종 한계: 이동 스텝에 비례 (프레임레이트 무관).
      // 지면이 진행 방향 대비 atan(stickRatio)보다 급하게 꺼지면 공중으로
      const stick = Math.max(p.stickMin, speed * dt * p.stickRatio);
      if (gap > stick) {
        // 클리프 — 지면이 한 스텝 만에 꺼졌다
        this.grounded = false;
      } else {
        // 롤오버 런치 판정 (원심 조건): 표면이 진행 중 볼록하게 꺾이는
        // 각속도 ω에 대해 v·ω > g·n.y 면 중력이 표면을 따라잡지 못한다
        _prevNormal.copy(this.groundNormal);
        terrain.getNormal(this.position.x, this.position.z, this.groundNormal);
        const v = this.velocity.length();
        const cosA = THREE.MathUtils.clamp(_prevNormal.dot(this.groundNormal), -1, 1);
        const omega = Math.acos(cosA) / dt;
        _normalDelta.copy(this.groundNormal).sub(_prevNormal);
        const convex = v > 0 && _normalDelta.dot(this.velocity) > 0;
        if (convex && v * omega > p.gravity * this.groundNormal.y * p.launchFactor) {
          this.grounded = false;
        } else {
          // 지면 추종 (오르막 단차는 uphillSnap까지 흡수)
          this.position.y = gap < -p.uphillSnap ? this.position.y + p.uphillSnap : groundY;
          const into = this.velocity.dot(this.groundNormal);
          if (into < 0) this.velocity.addScaledVector(this.groundNormal, -into);
        }
      }
    } else if (this.position.y <= groundY) {
      // 착지: 지면 수직 충격을 기록하고 속도를 표면 평면에 구속
      this.position.y = groundY;
      this.grounded = true;
      this.landedThisFrame = true;
      terrain.getNormal(this.position.x, this.position.z, this.groundNormal);
      const into = this.velocity.dot(this.groundNormal);
      if (into < 0) {
        // 파우더 쿠션: 깊을수록 착지 충격 흡수
        const absorb = Math.min(0.8, CONFIG.snow.depth * CONFIG.snow.landingAbsorb);
        this.lastImpact = -into * (1 - absorb);
        this.velocity.addScaledVector(this.groundNormal, -into);
      } else {
        this.lastImpact = 0;
      }
    }
  }
}

// 루프 내 객체 생성 금지 — 재사용 임시 벡터
const _gravity = new THREE.Vector3();
const _board = new THREE.Vector3();
const _lateral = new THREE.Vector3();
const _prevNormal = new THREE.Vector3();
const _normalDelta = new THREE.Vector3();
const _pushOut = new THREE.Vector3();
