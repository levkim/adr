import * as THREE from 'three';

// 절차적 곰 (외부 에셋 없음). 몸통·어깨 험프·머리·네 다리. 속도에 따라 다리 달리기 + 몸통 바운스.
export class Bear {
  readonly group = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly body: THREE.Mesh;
  private phase = 0;

  constructor() {
    const fur = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x241910, roughness: 0.9 });
    const snout = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });

    // 몸통 (벌크)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 1.55), fur);
    body.position.y = 0.95;
    body.castShadow = true;
    this.body = body;
    this.group.add(body);

    // 어깨 험프 (앞 등)
    const hump = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.5), fur);
    hump.position.set(0, 1.28, 0.45);
    this.group.add(hump);

    // 목 + 머리 (앞 +z)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.5), fur);
    head.position.set(0, 1.16, 0.92);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.26), snout);
    muzzle.position.set(0, 1.08, 1.2);
    this.group.add(head, muzzle);
    for (const e of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fur);
      ear.position.set(e * 0.16, 1.4, 0.84);
      this.group.add(ear);
    }

    // 네 다리 (스윙 피벗)
    const legPos: [number, number][] = [
      [0.22, 0.5],
      [-0.22, 0.5],
      [0.22, -0.5],
      [-0.22, -0.5],
    ];
    for (const [x, z] of legPos) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.7, z);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), fur);
      upper.position.y = -0.36;
      upper.castShadow = true;
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.28), dark);
      paw.position.y = -0.7;
      leg.add(upper, paw);
      this.legs.push(leg);
      this.group.add(leg);
    }
  }

  update(dt: number, speed: number): void {
    this.phase += dt * (3 + Math.min(Math.abs(speed), 14) * 1.0);
    const amp = Math.min(Math.abs(speed) / 7, 1) * 0.65;
    this.legs[0].rotation.x = Math.sin(this.phase) * amp;
    this.legs[3].rotation.x = Math.sin(this.phase) * amp;
    this.legs[1].rotation.x = Math.sin(this.phase + Math.PI) * amp;
    this.legs[2].rotation.x = Math.sin(this.phase + Math.PI) * amp;
    this.body.position.y = 0.95 + Math.abs(Math.sin(this.phase)) * amp * 0.1;
  }
}
