// lil-gui 항목 옆 '?' 도움말 배지 + 설명 툴팁.
// 데스크톱은 호버, 스마트폰은 탭으로 표시(다른 곳을 탭하면 닫힘).

interface NamedController {
  $name: HTMLElement;
}

let tipEl: HTMLDivElement | null = null;
let pinned = false; // 탭으로 고정 표시 중인지

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
    'z-index:100000', // lil-gui 패널보다 항상 앞
    'display:none',
    'box-shadow:0 4px 14px rgba(0,0,0,0.4)',
  ].join(';');
  document.body.appendChild(tipEl);
  // 빈 곳을 탭/클릭하면 고정 툴팁 닫기
  document.addEventListener('pointerdown', () => {
    if (pinned) {
      pinned = false;
      hide();
    }
  });
  return tipEl;
}

function show(badge: HTMLElement, text: string): void {
  const tip = ensureTip();
  tip.textContent = text;
  tip.style.display = 'block';
  const r = badge.getBoundingClientRect();
  // 패널이 우측에 있으므로 툴팁은 배지 왼쪽에
  tip.style.right = `${window.innerWidth - r.left + 8}px`;
  tip.style.top = `${Math.max(8, r.top - 6)}px`;
  tip.style.left = 'auto';
}

function hide(): void {
  if (tipEl && !pinned) tipEl.style.display = 'none';
}

/** GUI 컨트롤러 이름 옆에 ? 배지를 붙이고 호버/탭 설명을 단다 */
export function help<T extends NamedController>(ctrl: T, text: string): T {
  const badge = document.createElement('span');
  badge.textContent = '?';
  badge.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:15px',
    'height:15px',
    'margin-left:6px',
    'border:1px solid currentColor',
    'border-radius:50%',
    'font-size:10px',
    'opacity:0.6',
    'cursor:help',
    'vertical-align:middle',
    'flex:none',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  // 데스크톱 호버
  badge.addEventListener('mouseenter', () => {
    if (!pinned) show(badge, text);
  });
  badge.addEventListener('mouseleave', () => {
    if (!pinned) hide();
  });
  // 스마트폰/클릭: 탭하면 고정 표시 (다른 곳 탭하면 닫힘)
  badge.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (pinned && tipEl?.textContent === text && tipEl.style.display === 'block') {
      pinned = false;
      hide();
    } else {
      pinned = true;
      show(badge, text);
    }
  });
  ctrl.$name.appendChild(badge);
  return ctrl;
}
