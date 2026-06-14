import * as THREE from 'three';
import { CONFIG } from '../config';
import type { RiderPhysics } from '../player/physics';

// 트릭 인식: 이륙→착지 사이의 체공 시간, yaw 회전 누적, 그랩(공중 크라우치),
// 착지 정렬도로 클린/휘청/낙상을 판정한다. 물리는 건드리지 않고 이벤트만 반환.

export interface TrickEvent {
  airtime: number; // s
  rotationDeg: number; // 절대 회전각
  grabbed: boolean;
  landing: 'clean' | 'wobble' | 'crash';
  label: string; // HUD 표기용 (예: "360 그랩")
  styleScore: number; // 0~ 스타일 점수 기여
}

export class TrickDetector {
  private airborne = false;
  private airtime = 0;
  private rotation = 0; // 누적 yaw 변화 (rad, 부호 있음)
  private headingPrev = 0;
  private grabbed = false;

  reset(): void {
    this.airborne = false;
    this.airtime = 0;
    this.rotation = 0;
    this.grabbed = false;
  }

  /** 매 프레임 호출. 착지 순간에만 TrickEvent를 반환 */
  update(dt: number, phy: RiderPhysics): TrickEvent | null {
    // 이륙
    if (!phy.grounded && !this.airborne) {
      this.airborne = true;
      this.airtime = 0;
      this.rotation = 0;
      this.headingPrev = phy.heading;
      this.grabbed = false;
    }
    // 체공 중 누적
    if (this.airborne && !phy.grounded) {
      this.airtime += dt;
      let d = phy.heading - this.headingPrev;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // [-π, π]
      this.rotation += d;
      this.headingPrev = phy.heading;
      if (phy.crouching) this.grabbed = true; // 공중 크라우치 = 그랩(턱)
    }
    // 착지
    if (this.airborne && phy.grounded) {
      this.airborne = false;
      return this.finish(phy);
    }
    return null;
  }

  private finish(phy: RiderPhysics): TrickEvent | null {
    const t = CONFIG.scoring.trick;
    if (this.airtime < t.minAirtime) return null; // 잔점프는 트릭 아님

    const rotationDeg = (Math.abs(this.rotation) * 180) / Math.PI;
    const flipDeg = (Math.abs(phy.flip) * 180) / Math.PI;

    // 착지 정렬: 보드 방향 vs 수평 진행 방향(yaw) + 플립 완성도
    _board.set(Math.sin(phy.heading), 0, Math.cos(phy.heading));
    _vel.set(phy.velocity.x, 0, phy.velocity.z);
    let yawOff = 90;
    if (_vel.lengthSq() > 0.5) {
      const cos = THREE.MathUtils.clamp(_board.normalize().dot(_vel.normalize()), -1, 1);
      yawOff = (Math.acos(cos) * 180) / Math.PI;
      // 보드는 축이라 앞/뒤 구분 없음 → 180°(스위치) 착지는 정렬로 친다
      yawOff = Math.min(yawOff, 180 - yawOff);
    }
    // 플립은 한 바퀴(360°)에서 얼마나 벗어났나 — 180°(거꾸로) 착지는 낙상
    const flipFull = Math.round(phy.flip / (Math.PI * 2)) * (Math.PI * 2);
    const flipOff = (Math.abs(phy.flip - flipFull) * 180) / Math.PI;
    const offDeg = Math.max(yawOff, flipOff);

    let landing: TrickEvent['landing'];
    if (offDeg <= t.cleanAngleDeg) landing = 'clean';
    else if (offDeg <= t.wobbleAngleDeg) landing = 'wobble';
    else landing = 'crash';

    // 스타일 점수 (낙상이면 0). 플립도 회전으로 가산
    let style = 0;
    if (landing !== 'crash') {
      style = this.airtime * t.airtimeStyle + (rotationDeg + flipDeg) * t.rotationStyle;
      if (this.grabbed) style += t.grabBonus;
      if (landing === 'wobble') style *= 0.4;
    }

    return {
      airtime: this.airtime,
      rotationDeg,
      grabbed: this.grabbed,
      landing,
      label: trickLabel(rotationDeg, flipDeg, phy.flip, this.grabbed, landing),
      styleScore: style,
    };
  }
}

function trickLabel(
  yawDeg: number,
  flipDeg: number,
  flipSign: number,
  grabbed: boolean,
  landing: TrickEvent['landing'],
): string {
  if (landing === 'crash') return '낙상!';
  const parts: string[] = [];
  const spin = Math.round(yawDeg / 180) * 180;
  if (spin >= 180) parts.push(`${spin}`);
  const flips = Math.round(flipDeg / 360);
  if (flips >= 1) {
    const name = flipSign > 0 ? '프론트플립' : '백플립';
    parts.push(flips > 1 ? `${flips}x ${name}` : name);
  }
  let base = parts.length > 0 ? parts.join(' ') : '에어';
  if (grabbed) base += ' 그랩';
  if (landing === 'wobble') base += ' (휘청)';
  return base;
}

const _board = new THREE.Vector3();
const _vel = new THREE.Vector3();
