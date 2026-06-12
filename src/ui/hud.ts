// HTML 오버레이 HUD. 셋업 단계에서는 속도만 표시한다.
export class Hud {
  private readonly speedEl: HTMLElement;
  private lastShown = -1;

  constructor() {
    const el = document.getElementById('hud-speed');
    if (!el) throw new Error('#hud-speed 엘리먼트가 없습니다');
    this.speedEl = el;
  }

  /** @param speed m/s */
  update(speed: number): void {
    const kmh = Math.round(Math.abs(speed) * 3.6);
    if (kmh !== this.lastShown) {
      this.lastShown = kmh;
      this.speedEl.textContent = `${kmh} km/h`;
    }
  }
}
