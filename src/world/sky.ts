import * as THREE from 'three';

// 그라데이션 하늘 돔 (천정→지평선). BackSide 큰 구, 안개 영향 없음.
// 지평선 색을 안개색과 맞추면 지형이 하늘로 자연스럽게 녹아드는 대기 원근이 된다.
// 카메라를 따라다녀 항상 시야를 채운다.

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 col;
    if (h > 0.0) col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
    else col = mix(uHorizon, uBottom, clamp(-h * 2.0, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(0x4a86c8) },
        uHorizon: { value: new THREE.Color(0x9ec3e6) },
        uBottom: { value: new THREE.Color(0xb8c4d0) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(12000, 32, 16), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1; // 가장 먼저(배경)
  }

  setColors(top: number, horizon: number, bottom: number): void {
    (this.mat.uniforms.uTop.value as THREE.Color).set(top);
    (this.mat.uniforms.uHorizon.value as THREE.Color).set(horizon);
    (this.mat.uniforms.uBottom.value as THREE.Color).set(bottom);
  }

  /** 카메라를 따라다녀 항상 시야를 채운다 */
  follow(camPos: THREE.Vector3): void {
    this.mesh.position.copy(camPos);
  }
}
