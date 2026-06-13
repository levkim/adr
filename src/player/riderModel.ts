import * as THREE from 'three';
import type { CharacterPreset } from '../config';

// 절차적 풀기어 라이더 (외부 에셋 없음). 헬멧·고글·재킷·팬츠·글러브·부츠·백팩 +
// 스노보드(또는 스키+폴)를 기본 도형으로 조립하고, 물리 상태로 포즈한다.
// 구조: object(컨트롤러가 yaw/경사/린/피치 처리) ▸ root
//   ├ lower (보드 정렬 프레임): 보드/스키, 두 다리(2본 IK), 부츠
//   └ upper (스탠스 회전 프레임): 골반·재킷·머리·팔·백팩
// 상·하체는 허리에서 합쳐지며 약간의 어긋남은 재킷 단으로 가려진다.

export interface RiderPoseState {
  crouch: number; // 0..1
  airborne: boolean;
  crashed: boolean;
  speed: number; // m/s
  lean: number; // 턴 린 (rad)
}

const UP = new THREE.Vector3(0, 1, 0);

// 신체 치수 (m)
const STAND_HIP_Y = 0.92;
const CROUCH_HIP_Y = 0.62;
const THIGH = 0.46;
const SHIN = 0.46;
const SHOULDER_Y = 0.5; // hips(골반) 기준 어깨 높이
const UPPER_ARM = 0.28;
const FOREARM = 0.26;

export class RiderModel {
  readonly group = new THREE.Group();
  readonly discipline: 'snowboard' | 'ski';

  private readonly lower = new THREE.Group(); // 보드 정렬 프레임
  private readonly hips = new THREE.Group(); // 스탠스 회전 프레임 (상체)
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly materials: THREE.Material[] = [];

  // 다리/팔 세그먼트 (매 프레임 IK로 재배치)
  private readonly legThigh: THREE.Mesh[] = [];
  private readonly legShin: THREE.Mesh[] = [];
  private readonly boots: THREE.Mesh[] = [];
  private readonly armUpper: THREE.Mesh[] = [];
  private readonly armFore: THREE.Mesh[] = [];
  private readonly gloves: THREE.Mesh[] = [];
  private readonly poles: THREE.Group[] = [];

  // 발 위치 (lower 프레임, 고정) / 어깨 위치 (hips 프레임, 고정)
  private readonly footPos: THREE.Vector3[] = [];
  private readonly shoulderPos: THREE.Vector3[] = [];
  private readonly hipSocket: THREE.Vector3[] = [];
  private readonly stanceYaw: number;

  // 포즈 스무딩 상태
  private grabAmt = 0;
  private crashAmt = 0;

  constructor(preset: CharacterPreset) {
    this.discipline = preset.discipline;
    this.stanceYaw = this.discipline === 'snowboard' ? -1.0 : 0;

    this.group.add(this.lower, this.hips);
    this.hips.rotation.y = this.stanceYaw;
    this.hips.add(this.torso);
    this.torso.add(this.head);

    const mat = (color: THREE.ColorRepresentation, rough = 0.8, metal = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      this.materials.push(m);
      return m;
    };
    const jacketMat = mat(preset.jacket, 0.72);
    const pantsMat = mat(preset.pants, 0.82);
    const helmetMat = mat('#f3f4f6', 0.45);
    const goggleMat = mat(preset.goggle, 0.18, 0.6);
    const gloveMat = mat('#a9763f', 0.85);
    const bootMat = mat('#202329', 0.7);
    const skinMat = mat('#c89a78', 0.75);
    const packMat = mat('#15171c', 0.85);
    const boardMat = mat(preset.board, 0.55);
    const darkMat = mat('#2a2d33', 0.6);

    this.buildLower(pantsMat, bootMat, boardMat, darkMat);
    this.buildUpper(jacketMat, helmetMat, goggleMat, gloveMat, skinMat, packMat, darkMat);

    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  // ── 하체: 보드/스키, 다리(IK 세그먼트), 부츠 ──
  private buildLower(
    pants: THREE.Material,
    boot: THREE.Material,
    board: THREE.Material,
    dark: THREE.Material,
  ): void {
    if (this.discipline === 'snowboard') {
      // 발: 보드 길이방향(z)으로 앞/뒤 스탠스
      this.footPos.push(new THREE.Vector3(0, 0.08, 0.26), new THREE.Vector3(0, 0.08, -0.26));
      this.hipSocket.push(new THREE.Vector3(0, STAND_HIP_Y, 0.07), new THREE.Vector3(0, STAND_HIP_Y, -0.07));
      // 보드 (우드톱 디렉셔널 파우더)
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.03, 1.55), board);
      deck.position.set(0, 0.05, 0.0);
      // 노즈 살짝 들림
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.03, 0.22), board);
      nose.position.set(0, 0.085, 0.84);
      nose.rotation.x = -0.32;
      this.lower.add(deck, nose);
      // 바인딩 (하이백)
      for (const f of this.footPos) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.30), dark);
        base.position.set(f.x, 0.07, f.z);
        const high = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 0.04), dark);
        high.position.set(f.x, 0.15, f.z - 0.13);
        this.lower.add(base, high);
      }
    } else {
      // 스키: 발 좌우 평행
      this.footPos.push(new THREE.Vector3(-0.13, 0.1, 0.04), new THREE.Vector3(0.13, 0.1, 0.04));
      this.hipSocket.push(new THREE.Vector3(-0.11, STAND_HIP_Y, 0), new THREE.Vector3(0.11, STAND_HIP_Y, 0));
      for (const f of this.footPos) {
        const ski = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 1.75), board);
        ski.position.set(f.x, 0.03, 0.2);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.22), board);
        tip.position.set(f.x, 0.075, 1.05);
        tip.rotation.x = -0.5;
        this.lower.add(ski, tip);
      }
    }

    // 다리 세그먼트 + 부츠 (위치는 pose에서 IK로 갱신)
    for (let i = 0; i < 2; i++) {
      const thigh = new THREE.Mesh(unitBox(), pants);
      const shin = new THREE.Mesh(unitBox(), pants);
      const bootGeo =
        this.discipline === 'ski'
          ? new THREE.BoxGeometry(0.13, 0.2, 0.3)
          : new THREE.BoxGeometry(0.13, 0.16, 0.32);
      const bootMesh = new THREE.Mesh(bootGeo, boot);
      this.legThigh.push(thigh);
      this.legShin.push(shin);
      this.boots.push(bootMesh);
      this.lower.add(thigh, shin, bootMesh);
    }
  }

  // ── 상체: 골반·재킷·머리·팔·백팩 ──
  private buildUpper(
    jacket: THREE.Material,
    helmet: THREE.Material,
    goggle: THREE.Material,
    glove: THREE.Material,
    skin: THREE.Material,
    pack: THREE.Material,
    dark: THREE.Material,
  ): void {
    // 골반
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.24), jacket);
    pelvis.position.y = STAND_HIP_Y;
    this.hips.add(pelvis);

    // 토르소(재킷) — 골반 위에서 약간 테이퍼
    this.torso.position.y = STAND_HIP_Y + 0.1;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.27), jacket);
    chest.position.y = 0.22;
    // 하이 칼라
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 12), jacket);
    collar.position.y = 0.46;
    // 후드 (목 뒤 볼륨)
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), jacket);
    hood.position.set(0, 0.46, -0.1);
    hood.scale.set(1, 0.8, 0.7);
    this.torso.add(chest, collar, hood);

    // 백팩 (블랙, 등쪽)
    const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.46, 0.16), pack);
    packBody.position.set(0, 0.2, -0.21);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.04), dark);
    strapL.position.set(-0.13, 0.22, 0.12);
    const strapR = strapL.clone();
    strapR.position.x = 0.13;
    this.torso.add(packBody, strapL, strapR);

    // 머리 — 목 + 헬멧 + 고글
    this.head.position.y = 0.56;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skin);
    neck.position.y = 0.0;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skin);
    face.position.y = 0.12;
    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 14), helmet);
    helmetShell.position.y = 0.135;
    helmetShell.scale.set(1, 1.02, 1.05);
    // 헬멧 하단 절반(귀 덮개)
    const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.137, 0.137, 0.1, 16), helmet);
    helmetBrim.position.y = 0.1;
    // 고글
    const goggleBand = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 20), dark);
    goggleBand.position.y = 0.14;
    goggleBand.rotation.y = Math.PI / 2;
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), goggle);
    lens.position.set(0, 0.14, 0.07);
    lens.scale.z = 0.6;
    // tournski 헬멧 로고 (자체 브랜드)
    const logo = makeLogoPlane();
    if (logo) {
      logo.position.set(0, 0.17, 0.125);
      this.head.add(logo);
    }
    this.head.add(neck, face, helmetShell, helmetBrim, goggleBand, lens);

    // 어깨 위치 (hips 프레임)
    this.shoulderPos.push(
      new THREE.Vector3(-0.22, STAND_HIP_Y + SHOULDER_Y, 0),
      new THREE.Vector3(0.22, STAND_HIP_Y + SHOULDER_Y, 0),
    );
    for (let i = 0; i < 2; i++) {
      const up = new THREE.Mesh(unitBox(), jacket);
      const fore = new THREE.Mesh(unitBox(), jacket);
      const glo = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.11), glove);
      this.armUpper.push(up);
      this.armFore.push(fore);
      this.gloves.push(glo);
      this.hips.add(up, fore, glo);
      // 스키: 폴
      if (this.discipline === 'ski') {
        const pole = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 1.05, 8), dark);
        shaft.position.y = -0.52;
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10), dark);
        basket.position.y = -0.95;
        pole.add(shaft, basket);
        this.poles.push(pole);
        this.hips.add(pole);
      }
    }
  }

  /** 매 프레임 포즈 갱신 */
  pose(dt: number, s: RiderPoseState): void {
    const grabTarget = this.discipline === 'snowboard' && s.airborne && s.crouch > 0.5 ? 1 : 0;
    this.grabAmt += (grabTarget - this.grabAmt) * (1 - Math.exp(-10 * dt));
    this.crashAmt += ((s.crashed ? 1 : 0) - this.crashAmt) * (1 - Math.exp(-8 * dt));

    // 허리 높이: 크라우치로 하강
    const hipY = THREE.MathUtils.lerp(STAND_HIP_Y, CROUCH_HIP_Y, s.crouch);
    // 상체(골반/토르소)도 같이 내려가고 살짝 숙임
    this.hips.position.y = hipY - STAND_HIP_Y;
    this.torso.rotation.x = 0.12 + 0.35 * s.crouch + 0.2 * this.crashAmt;

    // ── 다리 2본 IK ──
    for (let i = 0; i < 2; i++) {
      _hip.copy(this.hipSocket[i]);
      _hip.y += this.hips.position.y; // 크라우치로 내려간 만큼
      _foot.copy(this.footPos[i]);
      // 무릎은 앞(+z)으로 굽힘
      _bend.set(0, 0, 1);
      solveTwoBone(_hip, _foot, THIGH, SHIN, _bend, _knee);
      placeSegment(this.legThigh[i], _hip, _knee, 0.13);
      placeSegment(this.legShin[i], _knee, _foot, 0.115);
      this.boots[i].position.copy(_foot);
      this.boots[i].position.y -= 0.02;
    }

    // ── 팔 2본 IK ──
    for (let i = 0; i < 2; i++) {
      _sh.copy(this.shoulderPos[i]);
      _sh.y += this.hips.position.y;
      // 손 목표
      const side = i === 0 ? -1 : 1;
      _hand.copy(_sh);
      if (this.discipline === 'ski') {
        // 폴을 짚는 자세: 손 앞·아래·바깥
        _hand.x += side * 0.18;
        _hand.y -= 0.34;
        _hand.z += 0.28;
      } else if (this.grabAmt > 0.01 && i === 0) {
        // 그랩: 리드 핸드가 보드(앞발) 쪽으로
        _grabTarget.set(0.0, hipY * 0.2, 0.3);
        _hand.lerp(_grabTarget, this.grabAmt);
      } else {
        // 균형: 팔 살짝 벌림 + 턴 린 반영
        _hand.x += side * 0.26;
        _hand.y -= 0.28;
        _hand.z += 0.12 - s.lean * side * 0.1;
      }
      // 낙상: 팔 벌어짐
      if (this.crashAmt > 0.01) {
        _hand.x += side * 0.2 * this.crashAmt;
        _hand.y += 0.1 * this.crashAmt;
      }
      _bend.set(side * 0.3, -1, -0.2).normalize();
      solveTwoBone(_sh, _hand, UPPER_ARM, FOREARM, _bend, _elbow);
      placeSegment(this.armUpper[i], _sh, _elbow, 0.085);
      placeSegment(this.armFore[i], _elbow, _hand, 0.075);
      this.gloves[i].position.copy(_hand);
      // 스키 폴: 손에서 아래로
      if (this.discipline === 'ski' && this.poles[i]) {
        this.poles[i].position.copy(_hand);
        this.poles[i].rotation.set(-0.3, 0, side * 0.15);
      }
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const mat of this.materials) mat.dispose();
  }
}

// ── 헬퍼 ──

function unitBox(): THREE.BoxGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}

/** 단위 박스를 from→to 사이에 배치 (높이축 +y를 방향에 맞춤) */
function placeSegment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, thick: number): void {
  _seg.copy(to).sub(from);
  const len = _seg.length();
  mesh.position.copy(from).addScaledVector(_seg, 0.5);
  if (len > 1e-5) mesh.quaternion.setFromUnitVectors(UP, _seg.divideScalar(len));
  mesh.scale.set(thick, len, thick);
}

/** 2본 IK: from→to를 길이 l1,l2로 잇는 무릎/팔꿈치 위치 K (bendDir 쪽으로 굽힘) */
function solveTwoBone(
  from: THREE.Vector3,
  to: THREE.Vector3,
  l1: number,
  l2: number,
  bendDir: THREE.Vector3,
  out: THREE.Vector3,
): void {
  _axis.copy(to).sub(from);
  let L = _axis.length();
  L = THREE.MathUtils.clamp(L, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _dir.copy(_axis).normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
  const along = l1 * cosA;
  const perpLen = l1 * Math.sqrt(1 - cosA * cosA);
  // bendDir에서 축 성분 제거 → 수직 방향
  _perp.copy(bendDir).addScaledVector(_dir, -bendDir.dot(_dir));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 0, 1).addScaledVector(_dir, -_dir.z);
  _perp.normalize();
  out.copy(from).addScaledVector(_dir, along).addScaledVector(_perp, perpLen);
}

/** tournski 헬멧 로고 (캔버스 텍스처) */
function makeLogoPlane(): THREE.Mesh | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 256, 96);
  ctx.fillStyle = '#1f6fc4';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('tournski', 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(0.18, 0.067);
  const matrl = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  return new THREE.Mesh(geo, matrl);
}

// 재사용 임시 벡터 (루프 내 할당 금지)
const _hip = new THREE.Vector3();
const _foot = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _sh = new THREE.Vector3();
const _hand = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _bend = new THREE.Vector3();
const _grabTarget = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
