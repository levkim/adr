import * as THREE from 'three';
import { CONFIG } from '../config';
import type { RiderController } from '../player/controller';
import type { Terrain } from '../world/terrain';
import { TrickDetector, type TrickEvent } from './tricks';

// 런 한 판의 상태/채점/궤적 관리. FWT식 4개 항목(라인 난이도, 에어&스타일,
// 유려함, 컨트롤)을 주행 중 누적하고, 피니시 도달 시 100점 만점 카드를 산출한다.

export interface ScoreCard {
  line: number;
  air: number;
  fluidity: number;
  control: number;
  overall: number;
  timeSec: number;
  vertical: number; // 하강 표고 (m)
  topSpeed: number; // km/h
  tricks: number;
  crashes: number;
  bestAir: number; // s
  bestRotation: number; // deg
}

export type RunState = 'idle' | 'riding' | 'finished';

export interface RunFrame {
  trick: TrickEvent | null;
}

export class Run {
  state: RunState = 'idle';
  time = 0;
  readonly trajectory: THREE.Vector2[] = []; // 월드 (x, z)
  result: ScoreCard | null = null;
  lastTrick: TrickEvent | null = null;

  private readonly tricks = new TrickDetector();
  private trajTimer = 0;
  private difficulty = 0;
  private style = 0;
  private fluidity = 100;
  private control = 100;
  private topSpeed = 0;
  private trickCount = 0;
  private crashCount = 0;
  private wobbleCount = 0;
  private bestAir = 0;
  private bestRot = 0;
  private readonly startAlt: number;
  private readonly finishAlt: number;

  constructor(
    private readonly finishPos: { x: number; z: number },
    startAlt: number,
    finishAlt: number,
  ) {
    this.startAlt = startAlt;
    this.finishAlt = finishAlt;
  }

  update(dt: number, rider: RiderController, terrain: Terrain): RunFrame {
    const frame: RunFrame = { trick: null };
    if (this.state === 'finished') return frame;

    const phy = rider.physics;
    const sc = CONFIG.scoring;

    // 런 시작: 처음으로 충분히 움직이면 타이머 가동
    if (this.state === 'idle') {
      this.recordTraj(phy.position.x, phy.position.z, true);
      if (phy.speed > sc.startSpeed) this.state = 'riding';
      else return frame;
    }

    this.time += dt;
    this.topSpeed = Math.max(this.topSpeed, phy.speed);
    this.recordTraj(phy.position.x, phy.position.z, false, dt);

    // 지형 경사/하강 방향
    terrain.getNormal(phy.position.x, phy.position.z, _n);
    const slopeDeg = (Math.acos(THREE.MathUtils.clamp(_n.y, -1, 1)) * 180) / Math.PI;

    // ── 라인 난이도: 급경사 노출 시간 누적 ──
    if (phy.grounded) {
      const steep = THREE.MathUtils.clamp(
        (slopeDeg - sc.line.steepStartDeg) / (sc.line.steepFullDeg - sc.line.steepStartDeg),
        0,
        1,
      );
      this.difficulty += sc.line.exposureRate * steep * dt;
    } else {
      // 체공(클리프/에어)도 난이도에 가중
      this.difficulty += sc.line.cliffWeight * dt;
    }

    // ── 유려함: 저속/역주행 감점 ──
    if (phy.grounded && !phy.crashed) {
      if (phy.speed < sc.fluidity.goodFlowSpeed) {
        const lack = 1 - phy.speed / sc.fluidity.goodFlowSpeed;
        this.fluidity -= sc.fluidity.stallPenalty * lack * dt;
      }
      // 역주행: 하강 방향(수평 법선 성분)과 속도가 반대면 감점
      _down.set(_n.x, 0, _n.z);
      if (_down.lengthSq() > 1e-4) {
        _down.normalize();
        _vel.set(phy.velocity.x, 0, phy.velocity.z);
        if (_vel.lengthSq() > 1 && _vel.dot(_down) < 0) {
          this.fluidity -= sc.fluidity.reversePenalty * dt;
        }
      }
    }

    // ── 트릭 ──
    const trick = this.tricks.update(dt, phy);
    if (trick) {
      frame.trick = trick;
      this.lastTrick = trick;
      if (trick.landing === 'crash') {
        // 착지 실패 → 물리 낙상 트리거 (아래 crashedThisFrame 블록이 감점 처리)
        phy.triggerCrash();
      } else {
        this.trickCount++;
        this.style += trick.styleScore;
        this.bestAir = Math.max(this.bestAir, trick.airtime);
        this.bestRot = Math.max(this.bestRot, trick.rotationDeg);
        if (trick.landing === 'wobble') {
          this.control -= sc.control.wobblePenalty;
          this.wobbleCount++;
        }
      }
    }

    // ── 낙상: 컨트롤/유려함 감점 (장애물 충돌 + 착지 실패 공통) ──
    if (phy.crashedThisFrame) {
      this.control -= sc.control.crashPenalty;
      this.fluidity -= sc.fluidity.crashPenalty;
      this.crashCount++;
    }

    // ── 피니시 판정 ──
    const dist = Math.hypot(phy.position.x - this.finishPos.x, phy.position.z - this.finishPos.z);
    const alt = phy.position.y + terrain.meta.minElevation;
    if (dist < sc.finishRadius || alt <= this.finishAlt) {
      this.finish(alt);
    }
    return frame;
  }

  private recordTraj(x: number, z: number, force: boolean, dt = 0): void {
    this.trajTimer += dt;
    if (force || this.trajTimer >= CONFIG.scoring.trajSampleInterval) {
      this.trajTimer = 0;
      this.trajectory.push(new THREE.Vector2(x, z));
    }
  }

  private finish(currentAlt: number): void {
    const sc = CONFIG.scoring;
    const clamp = (v: number) => THREE.MathUtils.clamp(v, 0, 100);
    const line = clamp((this.difficulty / sc.line.refDifficulty) * 100);
    const air = clamp((this.style / sc.trick.refStyle) * 100);
    const fluidity = clamp(this.fluidity);
    const control = clamp(this.control);
    const w = sc.weights;
    const overall = clamp(line * w.line + air * w.air + fluidity * w.fluidity + control * w.control);

    this.result = {
      line: Math.round(line),
      air: Math.round(air),
      fluidity: Math.round(fluidity),
      control: Math.round(control),
      overall: Math.round(overall * 10) / 10,
      timeSec: this.time,
      vertical: Math.max(0, this.startAlt - currentAlt),
      topSpeed: this.topSpeed * 3.6,
      tricks: this.trickCount,
      crashes: this.crashCount,
      bestAir: this.bestAir,
      bestRotation: Math.round(this.bestRot / 90) * 90,
    };
    this.state = 'finished';
  }
}

const _n = new THREE.Vector3();
const _down = new THREE.Vector3();
const _vel = new THREE.Vector3();
