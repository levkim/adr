// 키보드 입력 상태. 매 프레임 폴링 방식으로 읽고, 단발 키는 justPressed로 소비한다.
export class Input {
  private readonly keys = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressedThisFrame.add(e.code);
      this.keys.add(e.code);
      // 스크롤 등 브라우저 기본 동작 방지
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** 좌(-1)/우(+1) 조향 입력 */
  get steer(): number {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  /** 푸시/스케이팅 (저속 가속) */
  get push(): boolean {
    return this.down('KeyW', 'ArrowUp');
  }

  /** 브레이크 (스피드 체크) */
  get brake(): boolean {
    return this.down('KeyS', 'ArrowDown');
  }

  /** 이번 프레임에 눌렸는지 (단발). 프레임 끝에 endFrame 호출 필요 */
  justPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
