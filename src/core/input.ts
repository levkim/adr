// 키보드 입력 상태. 매 프레임 폴링 방식으로 읽는다.
export class Input {
  private readonly keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // 스크롤 등 브라우저 기본 동작 방지
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private pressed(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** 전진(+1)/후진(-1) 입력 */
  get throttle(): number {
    return (this.pressed('KeyW', 'ArrowUp') ? 1 : 0) - (this.pressed('KeyS', 'ArrowDown') ? 1 : 0);
  }

  /** 좌(-1)/우(+1) 조향 입력 */
  get steer(): number {
    return (this.pressed('KeyD', 'ArrowRight') ? 1 : 0) - (this.pressed('KeyA', 'ArrowLeft') ? 1 : 0);
  }
}
