// HTML 오버레이 HUD: 속도 + 고도(실표고).
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly altitudeEl: HTMLElement;
  private lastSpeed = -1;
  private lastAltitude = -1;

  constructor() {
    this.speedEl = mustGet('hud-speed');
    this.altitudeEl = mustGet('hud-altitude');
  }

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
