// 키보드 입력 상태. 매 프레임 폴링 방식으로 읽고, 단발 키는 justPressed로 소비한다.
// 스마트폰 기울기 조종(TiltController)이 setTilt로 아날로그 값을 주입하면 키보드와 합쳐진다
// (키 입력이 있으면 키보드 우선, 없으면 기울기 값). 점프는 queueJump로 단발 주입.
export class Input {
  private readonly keys = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private tilt = { steer: 0, leanFore: 0, crouch: false };
  private jumpQueued = false;

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

  /** 기울기 컨트롤러가 매 프레임 아날로그 값 주입 */
  setTilt(t: { steer: number; leanFore: number; crouch: boolean }): void {
    this.tilt = t;
  }

  /** 외부(터치 등) 점프 단발 주입 */
  queueJump(): void {
    this.jumpQueued = true;
  }

  private down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** 좌(-1)/우(+1) 조향 입력 (키보드 우선, 없으면 기울기) */
  get steer(): number {
    const kb = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    return kb !== 0 ? kb : this.tilt.steer;
  }

  /** 전후 체중이동: 앞쏠림(+1, W/↑) / 뒤쏠림(-1, S/↓). 속도 키가 아니다 */
  get leanFore(): number {
    const kb = (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0);
    return kb !== 0 ? kb : this.tilt.leanFore;
  }

  /** 크라우치(턱) — Shift 또는 기울기(터치 홀드) */
  get crouch(): boolean {
    return this.down('ShiftLeft', 'ShiftRight') || this.tilt.crouch;
  }

  /** 점프 (이번 프레임에 눌림) — Space 또는 터치 탭 */
  get jumpPressed(): boolean {
    if (this.jumpQueued) {
      this.jumpQueued = false;
      return true;
    }
    return this.justPressed('Space');
  }

  /** 이번 프레임에 눌렸는지 (단발). 프레임 끝에 endFrame 호출 필요 */
  justPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
