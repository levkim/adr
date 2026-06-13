import { CONFIG } from '../config';

// 스마트폰 기울기(자이로) 조종 (옵트인). DeviceOrientation으로 폰을 좌우/앞뒤로 기울여
// 조향·전후 체중이동을 조절하고, 화면 탭=점프 / 길게 누르기=크라우치.
// iOS 13+는 사용자 제스처에서 권한 요청 필요. HTTPS 필요(GitHub Pages 충족).
// 키보드는 항상 병행. 데스크톱(센서 없음)에서는 사용 불가 안내.
//
// 이 환경엔 자이로 센서가 없어 헤드리스 검증 불가 — 실기기에서만 동작/튜닝.

export interface TiltControls {
  steer: number;
  leanFore: number;
  crouch: boolean;
}

const TAP_MS = 220; // 이보다 짧은 터치는 탭(점프), 길면 홀드(크라우치)

export class TiltController {
  enabled = false;
  private rawBeta = 0; // 앞뒤(deg)
  private rawGamma = 0; // 좌우(deg)
  private neutralBeta = 0;
  private neutralGamma = 0;
  private calibratePending = false;
  private steer = 0;
  private leanFore = 0;
  private crouch = false;
  private raf = 0;
  private lastT = 0;
  private touchStart = 0;

  private readonly statusEl: HTMLDivElement;

  constructor(
    private readonly input: { setTilt: (t: TiltControls) => void; queueJump: () => void },
  ) {
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:64px',
      'transform:translateX(-50%)',
      'z-index:8',
      'display:none',
      'padding:6px 12px',
      'border-radius:16px',
      'background:rgba(20,24,30,0.78)',
      'color:#eef3f8',
      'font-size:12px',
      'font-family:system-ui,sans-serif',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(this.statusEl);
  }

  static get supported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  /** 버튼/키에서 호출 (iOS 권한은 사용자 제스처 필요) */
  async toggle(): Promise<void> {
    if (this.enabled) {
      this.stop();
      return;
    }
    if (!TiltController.supported) {
      this.flash('이 기기는 기울기 센서를 지원하지 않습니다 (PC는 키보드)');
      return;
    }
    // iOS 권한
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          this.flash('기울기 센서 권한이 거부되었습니다');
          return;
        }
      } catch {
        this.flash('기울기 센서 권한 요청 실패');
        return;
      }
    }
    window.addEventListener('deviceorientation', this.onOrient);
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.enabled = true;
    this.calibratePending = true;
    this.statusEl.style.display = 'block';
    this.statusEl.textContent = '📱 폰을 편한 각도로 — 중립 잡는 중';
    this.lastT = performance.now();
    this.loop();
  }

  requestCalibration(): void {
    this.calibratePending = true;
    this.statusEl.textContent = '📱 중립 잡는 중…';
  }

  private stop(): void {
    this.enabled = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('deviceorientation', this.onOrient);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchend', this.onTouchEnd);
    this.statusEl.style.display = 'none';
    this.steer = this.leanFore = 0;
    this.crouch = false;
    this.input.setTilt({ steer: 0, leanFore: 0, crouch: false });
  }

  private onOrient = (e: DeviceOrientationEvent): void => {
    this.rawBeta = e.beta ?? 0;
    this.rawGamma = e.gamma ?? 0;
  };

  private onTouchStart = (): void => {
    this.touchStart = performance.now();
    this.crouch = true; // 누르는 동안 크라우치 (짧은 탭이면 점프로 전환)
  };

  private onTouchEnd = (): void => {
    this.crouch = false;
    if (performance.now() - this.touchStart < TAP_MS) this.input.queueJump();
  };

  private loop = (): void => {
    if (!this.enabled) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastT) / 1000, 0.1);
    this.lastT = now;

    if (this.calibratePending) {
      this.neutralBeta = this.rawBeta;
      this.neutralGamma = this.rawGamma;
      this.calibratePending = false;
      this.statusEl.textContent = '📱 기울기 ON · 탭=점프, 길게=크라우치 · N 재보정';
    }

    const t = CONFIG.tilt;
    let s = (this.rawGamma - this.neutralGamma) * t.steerGain;
    let l = -(this.rawBeta - this.neutralBeta) * t.leanGain; // 앞으로 숙임 → 앞쏠림(+)
    if (t.swapAxes) {
      const tmp = s;
      s = -(this.rawBeta - this.neutralBeta) * t.steerGain;
      l = tmp;
    }
    if (t.invertSteer) s = -s;
    if (t.invertLean) l = -l;
    s = dz(clamp(s, -1, 1), t.deadzone);
    l = dz(clamp(l, -1, 1), t.deadzone);

    const a = 1 - Math.exp(-t.smoothing * dt);
    this.steer += (s - this.steer) * a;
    this.leanFore += (l - this.leanFore) * a;
    this.input.setTilt({ steer: this.steer, leanFore: this.leanFore, crouch: this.crouch });
  };

  private flash(msg: string): void {
    this.statusEl.style.display = 'block';
    this.statusEl.textContent = msg;
    setTimeout(() => {
      if (!this.enabled) this.statusEl.style.display = 'none';
    }, 2600);
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const dz = (v: number, d: number): number =>
  Math.abs(v) < d ? 0 : (Math.sign(v) * (Math.abs(v) - d)) / (1 - d);
