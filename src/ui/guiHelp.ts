// lil-gui 항목 옆 '?' 도움말 배지 + 롤오버 툴팁.
// 네이티브 title의 지연 없이 즉시 표시되도록 커스텀 툴팁 사용.

interface NamedController {
  $name: HTMLElement;
}

let tipEl: HTMLDivElement | null = null;

function ensureTip(): HTMLDivElement {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.style.cssText = [
    'position:fixed',
    'max-width:240px',
    'padding:8px 10px',
    'background:rgba(20,24,30,0.96)',
    'color:#e8eef5',
    'font-size:12px',
    'line-height:1.5',
    'border:1px solid rgba(255,255,255,0.15)',
    'border-radius:6px',
    'pointer-events:none',
    'z-index:1000',
    'display:none',
    'box-shadow:0 4px 14px rgba(0,0,0,0.4)',
  ].join(';');
  document.body.appendChild(tipEl);
  return tipEl;
}

/** GUI 컨트롤러 이름 옆에 ? 배지를 붙이고 롤오버 설명을 단다 */
export function help<T extends NamedController>(ctrl: T, text: string): T {
  const badge = document.createElement('span');
  badge.textContent = '?';
  badge.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:13px',
    'height:13px',
    'margin-left:6px',
    'border:1px solid currentColor',
    'border-radius:50%',
    'font-size:9px',
    'opacity:0.55',
    'cursor:help',
    'vertical-align:middle',
    'flex:none',
  ].join(';');
  badge.addEventListener('mouseenter', () => {
    const tip = ensureTip();
    tip.textContent = text;
    tip.style.display = 'block';
    const r = badge.getBoundingClientRect();
    // 패널이 우측에 있으므로 툴팁은 배지 왼쪽에
    tip.style.right = `${window.innerWidth - r.left + 8}px`;
    tip.style.top = `${Math.max(8, r.top - 6)}px`;
    tip.style.left = 'auto';
  });
  badge.addEventListener('mouseleave', () => {
    if (tipEl) tipEl.style.display = 'none';
  });
  ctrl.$name.appendChild(badge);
  return ctrl;
}
