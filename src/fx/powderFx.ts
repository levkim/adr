import * as THREE from 'three';
import { CONFIG } from '../config';
import { PowderSpray } from './powderSpray';
import { CameraSnow } from './cameraSnow';
import { ScreenFx } from './screenFx';
import { ProceduralAudio } from './audio';
import type { RiderController } from '../player/controller';
import type { CameraSystem } from '../camera/cameraSystem';

// 파우더 연출 오케스트레이터: 라이더 상태에서 공용 스프레이 강도를 계산해
// 월드 스프레이 / 카메라 근접 파티클 / 스크린 효과 / 사운드에 분배한다.

export class PowderFx {
  private readonly spray = new PowderSpray();
  private readonly cameraSnow = new CameraSnow();
  private readonly screen = new ScreenFx();
  private readonly audio = new ProceduralAudio();
  /** 0~1, 현재 프레임 스프레이 강도 (다른 시스템 참고용) */
  intensity = 0;
  private steerSmooth = 0;
  private landingPulse = 0;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    scene.add(this.spray.points);
    camera.add(this.cameraSnow.points);
  }

  update(dt: number, rider: RiderController, cameraSystem: CameraSystem): void {
    const s = CONFIG.fx.spray;
    const phy = rider.physics;
    const speed = phy.speed;
    const speedT = Math.min(1, speed / s.speedRef);

    // 조향 스무딩 (방출이 키 입력에 튀지 않게)
    this.steerSmooth += (Math.abs(rider.lastSteer) - this.steerSmooth) * Math.min(1, 8 * dt);
    // 착지 펄스: 잠시 강도 유지 후 감쇠
    this.landingPulse *= Math.exp(-3.5 * dt);

    // ── 공용 스프레이 강도 ──
    const grounded = phy.grounded && speed > s.minSpeed;
    this.intensity = grounded
      ? Math.min(1, speedT * (0.3 + 0.7 * this.steerSmooth) + this.landingPulse)
      : Math.min(1, this.landingPulse);

    // ── 월드 스프레이 방출 ──
    if (grounded) {
      phy.boardDir(_board);
      _side.set(_board.z, 0, -_board.x); // 우측
      // 턴 바깥쪽으로 분사 (우조향 → 좌측 분사)
      const sideAmount = -rider.lastSteer * s.sideVel * speedT;
      _origin.copy(phy.position);
      _origin.y += 0.15;
      const rate = (s.baseRate + s.turnRateGain * this.steerSmooth) * speedT;
      // 메인(보드) 이미터
      this.spray.emitContinuous(
        dt,
        _origin,
        phy.velocity,
        _side,
        sideAmount,
        rate * (1 - s.bodyEmitterRatio),
        0.45,
      );
      // 보조(몸 주변) 이미터: 스프레이가 몸을 통과하며 흩날리는 연출
      _bodyOrigin.copy(phy.position);
      _bodyOrigin.y += 0.9;
      this.spray.emitContinuous(
        dt,
        _bodyOrigin,
        phy.velocity,
        _side,
        sideAmount * 0.5,
        rate * s.bodyEmitterRatio * (0.3 + 0.7 * this.steerSmooth),
        0.7,
      );
    }
    // 착지 버스트
    if (phy.landedThisFrame && phy.lastImpact > 1.5) {
      this.landingPulse = Math.min(1, this.landingPulse + phy.lastImpact * 0.12);
      phy.boardDir(_board);
      _side.set(_board.z, 0, -_board.x);
      _origin.copy(phy.position);
      _origin.y += 0.1;
      this.spray.emitBurst(
        _origin,
        phy.velocity,
        _side,
        0,
        Math.min(600, Math.round(phy.lastImpact * s.landingBurst)),
        1.2,
      );
      this.audio.impact(phy.lastImpact);
    }

    this.spray.update(dt);
    this.cameraSnow.update(dt, speed, this.intensity, cameraSystem.modeId);
    this.screen.update(dt, speed, this.intensity, cameraSystem.modeId);
    this.audio.update(speed, phy.grounded, rider.lastSteer, this.intensity, cameraSystem.modeId);
  }
}

const _board = new THREE.Vector3();
const _side = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _bodyOrigin = new THREE.Vector3();
