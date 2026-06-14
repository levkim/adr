import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// public/models/{id}.glb 라이더 모델 로드 (장비 포함, 정적 메시).
// 바운딩박스로 스케일을 키(targetHeight)에 정규화하고, 발 바닥을 y=0, xz 중심을 원점에 맞춘다.
// 파일이 없거나 로드 실패하면 null → 호출측이 절차적 모델로 폴백.

const loader = new GLTFLoader();

export async function loadRiderGLB(url: string, targetHeight = 1.8): Promise<THREE.Group | null> {
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch {
    return null; // 404 등 → 폴백
  }
  const model = gltf.scene;

  // 키 정규화
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const height = size.y || 1;
  model.scale.setScalar(targetHeight / height);

  // 발 바닥을 y=0, 좌우/전후 중심을 원점에
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = false;
    }
  });

  const group = new THREE.Group();
  group.add(model);
  return group;
}
