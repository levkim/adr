import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { CONFIG } from '../config';

// 손 제스처 조종 (MediaPipe Hand Landmarker, 옵트인).
// 전면 카메라 → 손 21관절 → 손바닥 roll(좌우 기울기)=조향, pitch(수평↔수직)=전후 체중이동,
// 주먹=크라우치. 영상은 기기 내에서만 처리(서버 전송 없음). 키보드는 항상 병행.
//
// 이 환경엔 카메라·WebGL이 없어 헤드리스 검증 불가 — 실기기에서만 동작/튜닝.

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export interface GestureControls {
  steer: number; // -1..1
  leanFore: number; // -1..1
  crouch: boolean;
  active: boolean; // 손이 인식되는 중인지
}

export class GestureController {
  enabled = false;
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private loading = false;

  // 출력(스무딩됨)
  private steer = 0;
  private leanFore = 0;
  private crouch = false;
  private active = false;

  // 중립 캘리브레이션
  private neutralRoll = 0;
  private neutralPitch = 0;
  private calibrate = false;

  private readonly preview: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;

  constructor(private readonly onControls: (c: GestureControls) => void) {
    // 우하단 웹캠 프리뷰 + 상태
    this.preview = document.createElement('div');
    this.preview.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:64px',
      'width:160px',
      'z-index:8',
      'display:none',
      'border-radius:8px',
      'overflow:hidden',
      'box-shadow:0 3px 14px rgba(0,0,0,0.45)',
      'border:1px solid rgba(255,255,255,0.2)',
      'font-family:system-ui,sans-serif',
    ].join(';');
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText =
      'background:rgba(12,16,22,0.85);color:#eef3f8;font-size:11px;padding:4px 6px;text-align:center';
    this.statusEl.textContent = '제스처 준비 중…';
    document.body.appendChild(this.preview);
  }

  /** 토글: 켜면 카메라+모델 로드, 끄면 정지 */
  async toggle(): Promise<void> {
    if (this.enabled) {
      this.stop();
      return;
    }
    if (this.loading) return;
    this.loading = true;
    this.preview.style.display = 'block';
    this.statusEl.textContent = '카메라·모델 로딩…';
    try {
      await this.init();
      this.enabled = true;
      this.requestCalibration();
      this.loop();
    } catch (err) {
      console.error('제스처 초기화 실패:', err);
      this.statusEl.textContent = '제스처 사용 불가 (카메라/모델 오류)';
      setTimeout(() => this.stop(), 2500);
    } finally {
      this.loading = false;
    }
  }

  /** 중립 자세 재캘리브레이션 예약 (다음 프레임의 포즈를 중립으로) */
  requestCalibration(): void {
    this.calibrate = true;
    this.statusEl.textContent = '손을 편하게 펴고 정면 — 중립 잡는 중';
  }

  private async init(): Promise<void> {
    if (!this.landmarker) {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        numHands: 1,
        runningMode: 'VIDEO',
      });
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 320, height: 240 },
      audio: false,
    });
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    video.style.cssText = 'width:160px;height:120px;object-fit:cover;transform:scaleX(-1)';
    this.preview.insertBefore(video, this.statusEl);
    this.video = video;
    await video.play();
  }

  private stop(): void {
    this.enabled = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.remove();
      this.video = null;
    }
    this.preview.style.display = 'none';
    this.steer = this.leanFore = 0;
    this.crouch = this.active = false;
    this.onControls({ steer: 0, leanFore: 0, crouch: false, active: false });
  }

  private loop = (): void => {
    if (!this.enabled || !this.landmarker || !this.video) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.video.currentTime === this.lastVideoTime) return; // 새 프레임만
    this.lastVideoTime = this.video.currentTime;

    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(this.video, performance.now());
    } catch {
      return;
    }
    this.process(result);
  };

  private process(result: HandLandmarkerResult): void {
    const g = CONFIG.gesture;
    const lm = result.landmarks?.[0];
    const world = result.worldLandmarks?.[0];
    if (!lm || !world) {
      this.active = false;
      // 손 사라지면 부드럽게 중립으로
      this.steer += (0 - this.steer) * 0.2;
      this.leanFore += (0 - this.leanFore) * 0.2;
      this.crouch = false;
      this.emit();
      return;
    }
    this.active = true;

    // 손 좌우 여부 (체이럴리티) — 손바닥 법선 방향 일관화
    const handed = result.handednesses?.[0]?.[0]?.categoryName ?? 'Right';
    const sign = handed === 'Left' ? -1 : 1;

    // 손바닥 가로 벡터 (검지MCP - 새끼MCP), 이미지 평면 roll
    const across = sub(world[5], world[17]);
    const rawRoll = Math.atan2(across.y, across.x); // 손을 휠처럼 기울이면 변함

    // 손바닥 법선 (수평↔수직 판정): cross(검지-손목, 새끼-손목)
    const n = norm(cross(sub(world[5], world[0]), sub(world[17], world[0])));
    // 손바닥이 카메라를 향하면(수직) n.z 큼, 아래로 누우면(수평) n.y 큼
    const rawPitch = n.y * sign;

    if (this.calibrate) {
      this.neutralRoll = rawRoll;
      this.neutralPitch = rawPitch;
      this.calibrate = false;
      this.statusEl.textContent = '제스처 ON · N키로 재보정';
    }

    let steer = (rawRoll - this.neutralRoll) * sign * g.steerGain;
    let lean = (rawPitch - this.neutralPitch) * g.leanGain;
    if (g.invertSteer) steer = -steer;
    if (g.invertLean) lean = -lean;
    steer = dz(clamp(steer, -1, 1), g.deadzone);
    lean = dz(clamp(lean, -1, 1), g.deadzone);

    // 주먹 판정 → 크라우치
    const scale = len(sub(lm[9], lm[0])) || 1e-3;
    const fistScore =
      ([8, 12, 16, 20] as const).reduce((s, i) => s + len(sub(lm[i], lm[0])) / scale, 0) / 4;
    this.crouch = fistScore < g.fistCrouch;

    // 스무딩 (프레임레이트 독립적이지 않지만 검출 cadence가 일정해 충분)
    const a = Math.min(1, g.smoothing * 0.033);
    this.steer += (steer - this.steer) * a;
    this.leanFore += (lean - this.leanFore) * a;
    this.emit();
  }

  private emit(): void {
    this.onControls({
      steer: this.steer,
      leanFore: this.leanFore,
      crouch: this.crouch,
      active: this.active,
    });
  }
}

// ── 작은 벡터 헬퍼 (MediaPipe landmark = {x,y,z}) ──
interface V {
  x: number;
  y: number;
  z: number;
}
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V, b: V): V => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const len = (a: V): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: V): V => {
  const l = len(a) || 1e-6;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const dz = (v: number, d: number): number =>
  Math.abs(v) < d ? 0 : (Math.sign(v) * (Math.abs(v) - d)) / (1 - d);
