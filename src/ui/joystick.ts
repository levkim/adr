// 화면 터치 조이스틱 (옵트인). 좌우=조향, 위/아래=전후 체중이동(공중에선 앞/뒤 플립).
// 짧게 탭=점프, 길게 누르기=그립(크라우치). 포인터 이벤트라 데스크톱 마우스로도 동작.
// Input.setTilt(아날로그)·queueJump로 주입. 키보드/기울기와 동일 채널이라 상호 배타로 쓴다.

const R = 64; // 베이스 반경(px)
const KNOB = 30;
const TAP_RADIUS = 18; // 이보다 적게 움직이고 짧게 떼면 탭
const TAP_MS = 220;
const LONG_MS = 280; // 이보다 오래 누르고 있으면 그립

export class Joystick {
  enabled = false;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private active = false;
  private pointerId = -1;
  private startT = 0;
  private cx = 0;
  private cy = 0;
  private dragged = false;
  private crouch = false;
  private longTimer = 0;

  constructor(
    private readonly input: { setTilt: (t: TiltLike) => void; queueJump: () => void },
  ) {
    this.base = document.createElement('div');
    this.base.style.cssText = [
      'position:fixed',
      'left:28px',
      'bottom:90px',
      `width:${R * 2}px`,
      `height:${R * 2}px`,
      'z-index:8',
      'display:none',
      'border-radius:50%',
      'background:rgba(20,24,30,0.35)',
      'border:2px solid rgba(255,255,255,0.25)',
      'touch-action:none',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');
    this.knob = document.createElement('div');
    this.knob.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      `width:${KNOB * 2}px`,
      `height:${KNOB * 2}px`,
      'margin-left:' + -KNOB + 'px',
      'margin-top:' + -KNOB + 'px',
      'border-radius:50%',
      'background:rgba(90,176,230,0.85)',
      'border:2px solid rgba(255,255,255,0.7)',
      'transition:transform 0.05s',
    ].join(';');
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);

    this.base.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.base.style.display = this.enabled ? 'block' : 'none';
    if (!this.enabled) this.reset();
    return this.enabled;
  }

  private reset(): void {
    this.active = false;
    this.dragged = false;
    this.crouch = false;
    window.clearTimeout(this.longTimer);
    this.knob.style.transform = 'translate(0,0)';
    this.input.setTilt({ steer: 0, leanFore: 0, crouch: false });
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || this.active) return;
    this.active = true;
    this.pointerId = e.pointerId;
    const r = this.base.getBoundingClientRect();
    this.cx = r.left + R;
    this.cy = r.top + R;
    this.startT = performance.now();
    this.dragged = false;
    this.crouch = false;
    // 길게 누르기 → 그립
    this.longTimer = window.setTimeout(() => {
      if (this.active && !this.dragged) {
        this.crouch = true;
        this.emit(0, 0);
      }
    }, LONG_MS);
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.cx;
    let dy = e.clientY - this.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > TAP_RADIUS) {
      this.dragged = true;
      this.crouch = false;
      window.clearTimeout(this.longTimer);
    }
    // 반경 R로 클램프
    if (dist > R) {
      dx = (dx / dist) * R;
      dy = (dy / dist) * R;
    }
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    this.emit(dx / R, -dy / R); // 위로 밀면 +(앞쏠림/프론트)
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    window.clearTimeout(this.longTimer);
    const dur = performance.now() - this.startT;
    if (!this.dragged && dur < TAP_MS) this.input.queueJump(); // 짧은 탭=점프
    this.active = false;
    this.crouch = false;
    this.knob.style.transform = 'translate(0,0)';
    this.input.setTilt({ steer: 0, leanFore: 0, crouch: false });
  };

  private emit(steer: number, leanFore: number): void {
    this.input.setTilt({
      steer: clamp(steer, -1, 1),
      leanFore: clamp(leanFore, -1, 1),
      crouch: this.crouch,
    });
  }
}

interface TiltLike {
  steer: number;
  leanFore: number;
  crouch: boolean;
}
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
