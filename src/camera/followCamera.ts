import * as THREE from 'three';
import { CONFIG } from '../config';
import type { RiderController } from '../player/controller';
import type { Terrain } from '../world/terrain';

// 3인칭 추적 카메라: 속도에 따른 거리/FOV 변화, 체공 풀백, 착지 셰이크.
// 모드 전환(1인칭/숄더/드론)은 5단계에서 확장.
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private shakeEnergy = 0;
  private time = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, 0.1, CONFIG.camera.far);
  }

  /** 시작 시 보간 없이 즉시 위치시킨다 */
  snapTo(rider: RiderController, terrain: Terrain): void {
    this.computeDesired(rider, terrain, _desired);
    this.camera.position.copy(_desired);
    this.shakeEnergy = 0;
    this.camera.fov = CONFIG.camera.fov;
    this.camera.updateProjectionMatrix();
    this.lookAtRider(rider);
  }

  update(dt: number, rider: RiderController, terrain: Terrain): void {
    const c = CONFIG.camera;
    const phy = rider.physics;
    this.time += dt;

    // 착지 충격 → 셰이크 에너지 주입, 지수 감쇠
    if (phy.landedThisFrame) {
      this.shakeEnergy = Math.min(1, this.shakeEnergy + phy.lastImpact * c.shakeImpactScale);
    }
    this.shakeEnergy *= Math.exp(-c.shakeDecay * dt);

    // 위치 추적 (지수 보간)
    this.computeDesired(rider, terrain, _desired);
    const t = 1 - Math.exp(-c.followLerp * dt);
    this.camera.position.lerp(_desired, t);

    // 보간 후에도 지면 아래로는 내려가지 않게
    const minY =
      terrain.getHeight(this.camera.position.x, this.camera.position.z) + c.terrainClearance;
    if (this.camera.position.y < minY) this.camera.position.y = minY;

    // 속도 연동 FOV
    const targetFov = c.fov + Math.min(phy.speed * c.fovSpeedGain, c.fovMaxBoost);
    const fovT = 1 - Math.exp(-c.fovLerp * dt);
    const newFov = this.camera.fov + (targetFov - this.camera.fov) * fovT;
    if (Math.abs(newFov - this.camera.fov) > 1e-3) {
      this.camera.fov = newFov;
      this.camera.updateProjectionMatrix();
    }

    // 셰이크: 감쇠 사인 합성 오프셋
    if (this.shakeEnergy > 1e-3) {
      const amp = this.shakeEnergy * c.shakeMaxAmp;
      this.camera.position.x += Math.sin(this.time * 37) * amp;
      this.camera.position.y += Math.sin(this.time * 53 + 1.3) * amp * 0.7;
      this.camera.position.z += Math.sin(this.time * 41 + 2.1) * amp;
    }

    this.lookAtRider(rider);
  }

  private computeDesired(rider: RiderController, terrain: Terrain, out: THREE.Vector3): void {
    const c = CONFIG.camera;
    const phy = rider.physics;
    // 속도·체공에 따른 동적 거리
    const dist =
      c.distance + phy.speed * c.distanceSpeedGain + (phy.grounded ? 0 : c.airPullback);
    _back.set(Math.sin(phy.heading), 0, Math.cos(phy.heading)).multiplyScalar(-dist);
    out.copy(rider.object.position).add(_back);
    out.y = rider.object.position.y + c.height;
    // 목표 지점 자체도 지면 위로
    const minY = terrain.getHeight(out.x, out.z) + c.terrainClearance;
    if (out.y < minY) out.y = minY;
  }

  private lookAtRider(rider: RiderController): void {
    _lookAt.copy(rider.object.position);
    _lookAt.y += CONFIG.camera.lookAtHeight;
    this.camera.lookAt(_lookAt);
  }
}

const _desired = new THREE.Vector3();
const _back = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
