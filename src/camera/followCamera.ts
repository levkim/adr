import * as THREE from 'three';
import { CONFIG } from '../config';
import type { RiderController } from '../player/controller';

// 3인칭 추적 카메라 (기본형). 모드 전환/동적 FOV는 5단계에서 확장.
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, 0.1, 2000);
  }

  /** 시작 시 보간 없이 즉시 위치시킨다 */
  snapTo(rider: RiderController): void {
    this.computeDesired(rider, _desired);
    this.camera.position.copy(_desired);
    this.lookAtRider(rider);
  }

  update(dt: number, rider: RiderController): void {
    this.computeDesired(rider, _desired);
    // 프레임레이트 독립적인 지수 보간
    const t = 1 - Math.exp(-CONFIG.camera.followLerp * dt);
    this.camera.position.lerp(_desired, t);
    this.lookAtRider(rider);
  }

  private computeDesired(rider: RiderController, out: THREE.Vector3): void {
    const c = CONFIG.camera;
    rider.forwardDir(_back).multiplyScalar(-c.distance);
    out.copy(rider.object.position).add(_back);
    out.y = rider.object.position.y + c.height;
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
