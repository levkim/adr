// HTML 오버레이 HUD: 속도 + 고도(실표고) + 카메라 모드.
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly altitudeEl: HTMLElement;
  private readonly cameraEl: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private lastSpeed = -1;
  private lastAltitude = -1;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private fpsTimer = 0;

  constructor() {
    this.speedEl = mustGet('hud-speed');
    this.altitudeEl = mustGet('hud-altitude');
    this.cameraEl = mustGet('hud-camera');
    this.fpsEl = mustGet('hud-fps');
  }

  setCameraMode(label: string): void {
    this.cameraEl.textContent = `📷 ${label} (C·탭)`;
  }

  /** FPS 미터 (성능 목표 60fps 검증용). 0.25초마다 평균 표시 */
  tickFps(dt: number): void {
    if (dt <= 0) return;
    this.fpsAccum += 1 / dt;
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.25) {
      const fps = Math.round(this.fpsAccum / this.fpsFrames);
      this.fpsEl.textContent = `${fps} fps`;
      this.fpsEl.style.color = fps >= 55 ? '#7fdca0' : fps >= 35 ? '#e6d27a' : '#e69090';
      this.fpsAccum = this.fpsFrames = this.fpsTimer = 0;
    }
  }

  /** 중앙 팝업 (낙상/트릭 등) */
  showPopup(text: string, ms = 1600): void {
    let el = document.getElementById('hud-popup');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-popup';
      el.style.cssText = [
        'position:fixed',
        'top:30%',
        'left:50%',
        'transform:translate(-50%,-50%)',
        'font-size:42px',
        'font-weight:800',
        'color:#fff',
        'text-shadow:0 2px 10px rgba(0,0,0,0.55)',
        'pointer-events:none',
        'z-index:7',
        'transition:opacity 0.4s',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    window.clearTimeout(this.popupTimer);
    this.popupTimer = window.setTimeout(() => {
      el.style.opacity = '0';
    }, ms);
  }

  private popupTimer = 0;

  /**
   * @param speed m/s
   * @param altitude 실표고 m
   */
  update(speed: number, altitude: number): void {
    const kmh = Math.round(speed * 3.6);
    if (kmh !== this.lastSpeed) {
      this.lastSpeed = kmh;
      this.speedEl.textContent = `${kmh} km/h`;
    }
    const alt = Math.round(altitude);
    if (alt !== this.lastAltitude) {
      this.lastAltitude = alt;
      this.altitudeEl.textContent = `${alt} m`;
    }
  }
}

function mustGet(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 엘리먼트가 없습니다`);
  return el;
}
