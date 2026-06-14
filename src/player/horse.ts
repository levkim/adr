import * as THREE from 'three';

// 절차적 말 모델 (외부 에셋 없음). 평지 탈출용 탈것.
// 몸통·목·머리·네 다리·꼬리 + 안장. 속도에 따라 다리 스윙·몸통 바운스.

export const HORSE_BACK_Y = 1.32; // 라이더가 앉는 등 높이

export class Horse {
  readonly group = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly body: THREE.Mesh;
  private phase = 0;

  constructor() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a281a, roughness: 0.8 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x20140c, roughness: 0.7 });
    const saddleMat = new THREE.MeshStandardMaterial({ color: 0x222730, roughness: 0.6 });

    // 몸통
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 1.5), bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    this.body = body;
    this.group.add(body);

    // 목 + 머리 (앞쪽 +z)
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 0.34), bodyMat);
    neck.position.set(0, 1.32, 0.78);
    neck.rotation.x = -0.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.5), bodyMat);
    head.position.set(0, 1.62, 1.02);
    head.rotation.x = 0.25;
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.36), darkMat);
    mane.position.set(0, 1.38, 0.7);
    mane.rotation.x = -0.5;
    for (const e of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), bodyMat);
      ear.position.set(e * 0.08, 1.78, 0.92);
      this.group.add(ear);
    }
    this.group.add(neck, head, mane);

    // 꼬리 (뒤 -z)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.12), darkMat);
    tail.position.set(0, 1.0, -0.82);
    tail.rotation.x = 0.5;
    this.group.add(tail);

    // 안장
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.5), saddleMat);
    saddle.position.set(0, 1.4, -0.1);
    this.group.add(saddle);

    // 네 다리 (스윙용 그룹 피벗)
    const legPos: [number, number][] = [
      [0.2, 0.55], // 앞 우
      [-0.2, 0.55], // 앞 좌
      [0.2, -0.55], // 뒤 우
      [-0.2, -0.55], // 뒤 좌
    ];
    for (const [x, z] of legPos) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.85, z); // 어깨/엉덩이 피벗
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.85, 0.13), bodyMat);
      upper.position.y = -0.42;
      upper.castShadow = true;
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.18), hoofMat);
      hoof.position.y = -0.82;
      leg.add(upper, hoof);
      this.legs.push(leg);
      this.group.add(leg);
    }
  }

  /** @param speed m/s */
  update(dt: number, speed: number): void {
    this.phase += dt * (3 + Math.min(Math.abs(speed), 16) * 0.9);
    const amp = Math.min(Math.abs(speed) / 8, 1) * 0.7;
    // 대각선 다리쌍 교차 스윙 (갤럽 느낌)
    this.legs[0].rotation.x = Math.sin(this.phase) * amp;
    this.legs[3].rotation.x = Math.sin(this.phase) * amp;
    this.legs[1].rotation.x = Math.sin(this.phase + Math.PI) * amp;
    this.legs[2].rotation.x = Math.sin(this.phase + Math.PI) * amp;
    // 몸통 바운스
    this.body.position.y = 1.05 + Math.abs(Math.sin(this.phase)) * amp * 0.08;
  }
}
