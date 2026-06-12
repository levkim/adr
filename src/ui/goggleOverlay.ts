// 1인칭 고글 뷰 오버레이: 프레임 비네팅 (HTML/CSS).
// 스플래터/김서림 등 동적 렌즈 효과는 6단계(파우더 연출)에서 확장.
export class GoggleOverlay {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'goggle-overlay';
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:5',
      'display:none',
      // 고글 렌즈 비네팅 + 프레임
      'background:radial-gradient(ellipse 72% 58% at 50% 48%, transparent 62%, rgba(12,16,22,0.55) 86%, rgba(8,10,14,0.97) 100%)',
      'box-shadow:inset 0 0 120px rgba(10,14,20,0.55)',
    ].join(';');
    document.body.appendChild(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? 'block' : 'none';
  }
}
