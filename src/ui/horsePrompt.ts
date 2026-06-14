// 평지에서 느려졌을 때 뜨는 '말 타고 갈래?' 프롬프트(YES/NO) + 말 타는 중 '내리기' 버튼.

export class HorsePrompt {
  private readonly card: HTMLDivElement;
  private readonly dismountBtn: HTMLButtonElement;
  promptVisible = false;

  constructor(onYes: () => void, onNo: () => void, onDismount: () => void) {
    this.card = document.createElement('div');
    this.card.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:34%',
      'transform:translate(-50%,-50%)',
      'z-index:9',
      'display:none',
      'padding:18px 22px',
      'border-radius:12px',
      'background:rgba(14,18,24,0.92)',
      'border:1px solid rgba(255,255,255,0.18)',
      'box-shadow:0 8px 28px rgba(0,0,0,0.5)',
      'text-align:center',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:#eef3f8',
    ].join(';');
    this.card.innerHTML = `
      <div style="font-size:34px;margin-bottom:4px">🐴</div>
      <div style="font-size:18px;font-weight:700">말 타고 갈래?</div>
      <div style="font-size:13px;opacity:0.7;margin-bottom:14px">Ride a horse?</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="hp-yes" style="padding:10px 26px;border:0;border-radius:8px;background:#46c98b;color:#0d1520;font-size:15px;font-weight:800;cursor:pointer">YES</button>
        <button id="hp-no" style="padding:10px 26px;border:1px solid rgba(255,255,255,0.25);border-radius:8px;background:transparent;color:#cdd6df;font-size:15px;font-weight:700;cursor:pointer">NO</button>
      </div>`;
    document.body.appendChild(this.card);

    this.dismountBtn = document.createElement('button');
    this.dismountBtn.textContent = '🐴 내리기 / Dismount';
    this.dismountBtn.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:36px',
      'transform:translateX(-50%)',
      'z-index:8',
      'display:none',
      'padding:8px 16px',
      'border:1px solid rgba(255,255,255,0.25)',
      'border-radius:18px',
      'background:rgba(20,24,30,0.78)',
      'color:#eef3f8',
      'font-size:14px',
      'cursor:pointer',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');
    document.body.appendChild(this.dismountBtn);

    (this.card.querySelector('#hp-yes') as HTMLButtonElement).addEventListener('click', () => {
      this.hidePrompt();
      onYes();
    });
    (this.card.querySelector('#hp-no') as HTMLButtonElement).addEventListener('click', () => {
      this.hidePrompt();
      onNo();
    });
    this.dismountBtn.addEventListener('click', onDismount);
  }

  showPrompt(): void {
    this.card.style.display = 'block';
    this.promptVisible = true;
  }

  hidePrompt(): void {
    this.card.style.display = 'none';
    this.promptVisible = false;
  }

  setMounted(mounted: boolean): void {
    this.dismountBtn.style.display = mounted ? 'block' : 'none';
    if (mounted) this.hidePrompt();
  }
}
