import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterId } from '../config';

// public/models/{id}.glb 라이더 모델 로드 (장비 포함, 정적 메시).
// 업로드된 모델은 Z-up(키가 Z축) 이라 Y-up + 정면 +Z 로 회전 보정한 뒤,
// 키(targetHeight)로 스케일 정규화하고 발 바닥을 y=0, xz 중심을 원점에 맞춘다.
// 파일이 없으면 null → 절차적 폴백. 방향이 틀어지면 ORIENT 값만 조정하면 된다.

const loader = new GLTFLoader();

// 캐릭터별 회전 보정(도). Z-up→Y-up은 rotX=-90 공통, 정면 정렬은 rotY로,
// pitch는 기본 전방 기울기(+면 앞쏠림).
const ORIENT: Record<CharacterId, { rotX: number; rotY: number; pitch: number }> = {
  snowboarder: { rotX: -90, rotY: -90, pitch: 0 }, // 보드 X축 → 진행 Z축
  skier: { rotX: -90, rotY: 0, pitch: 5 }, // 스키 Y축 → 진행 Z축(정면), 앞으로 5° 기울임
};

const _v = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0);
const _Y = new THREE.Vector3(0, 1, 0);

export async function loadRiderGLB(
  url: string,
  id: CharacterId,
  targetHeight = 1.8,
): Promise<THREE.Group | null> {
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch {
    return null; // 404 등 → 폴백
  }
  const model = gltf.scene;
  const o = ORIENT[id] ?? { rotX: -90, rotY: 0, pitch: 0 };
  // 월드축 기준: 업보정(X) → 요(Y) → 전방 기울기(X). 순서 명확
  const qx = new THREE.Quaternion().setFromAxisAngle(_X, THREE.MathUtils.degToRad(o.rotX));
  const qy = new THREE.Quaternion().setFromAxisAngle(_Y, THREE.MathUtils.degToRad(o.rotY));
  const qp = new THREE.Quaternion().setFromAxisAngle(_X, THREE.MathUtils.degToRad(o.pitch));
  model.quaternion.copy(qp).multiply(qy).multiply(qx);

  const outer = new THREE.Group();
  outer.add(model);

  // 회전 반영 후 바운딩박스로 키 정규화
  outer.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(outer);
  const height = box.getSize(_v).y || 1;
  model.scale.multiplyScalar(targetHeight / height);

  // 발 바닥을 y=0, 좌우/전후 중심을 원점에
  outer.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(outer);
  const center = box.getCenter(_v);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  model.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = false;
    }
  });

  return outer;
}
