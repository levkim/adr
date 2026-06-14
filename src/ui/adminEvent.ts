// 관리자 이벤트 공지. ?admin=1 로 관리자 패널을 열어 공지 텍스트 + 아웃링크를 설정한다.
// 정적 호스팅(백엔드 없음)이라 저장은 localStorage + 공유 링크(?event=&eventUrl=)로 한다.
// 게임 화면 상단에 공지 배너가 뜨고, 아웃링크가 있으면 클릭 시 새 탭으로 연결된다.

const LS_KEY = 'tournski_event';

interface EventCfg {
  text: string;
  url: string;
}

export class AdminEvent {
  private readonly banner: HTMLDivElement;

  constructor() {
    const params = new URLSearchParams(window.location.search);
    let cfg = this.load();
    // URL 파라미터가 있으면 우선 적용 + 저장 (공유 링크로 전파)
    const pText = params.get('event');
    if (pText !== null) {
      cfg = { text: pText, url: params.get('eventUrl') ?? '' };
      this.save(cfg);
    }

    this.banner = document.createElement('div');
    this.banner.style.cssText = [
      'position:fixed',
      'top:46px', // 좌상단 시점(📷 3인칭) 버튼 바로 아래
      'left:16px',
      'max-width:72vw',
      'z-index:9',
      'display:none',
      'padding:6px 12px',
      'border-radius:12px',
      'background:rgba(47,111,176,0.92)',
      'color:#fff',
      'font-size:13px',
      'line-height:1.4',
      'font-family:system-ui,-apple-system,sans-serif',
      'box-shadow:0 2px 10px rgba(0,0,0,0.4)',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');
    document.body.appendChild(this.banner);
    this.renderBanner(cfg);

    if (params.get('admin') === '1') this.buildAdminPanel(cfg);
  }

  private renderBanner(cfg: EventCfg): void {
    if (!cfg.text.trim()) {
      this.banner.style.display = 'none';
      return;
    }
    this.banner.textContent = `📣 ${cfg.text}${cfg.url ? '  ↗' : ''}`;
    this.banner.style.display = 'block';
    this.banner.style.cursor = cfg.url ? 'pointer' : 'default';
    this.banner.style.pointerEvents = cfg.url ? 'auto' : 'none';
    this.banner.onclick = cfg.url
      ? () => window.open(cfg.url, '_blank', 'noopener')
      : null;
  }

  private buildAdminPanel(cfg: EventCfg): void {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:40',
      'padding:14px 16px',
      'background:rgba(12,16,22,0.96)',
      'border-bottom:1px solid rgba(255,255,255,0.18)',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:#eef3f8',
    ].join(';');
    panel.innerHTML = `
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">🛠 관리자 / Admin — 이벤트 공지 (Event banner)</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <input id="ae-text" placeholder="공지 텍스트 / Event text" style="flex:2;min-width:200px;padding:8px;border-radius:6px;border:1px solid #444;background:#1a1f27;color:#fff;font-size:13px" />
        <input id="ae-url" placeholder="아웃링크 URL / Outlink (https://…)" style="flex:2;min-width:200px;padding:8px;border-radius:6px;border:1px solid #444;background:#1a1f27;color:#fff;font-size:13px" />
        <button id="ae-apply" style="padding:8px 14px;border:0;border-radius:6px;background:#46c98b;color:#0d1520;font-weight:800;cursor:pointer">적용 Apply</button>
        <button id="ae-share" style="padding:8px 14px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;background:transparent;color:#cdd6df;cursor:pointer">공유링크 복사 Copy link</button>
        <button id="ae-clear" style="padding:8px 14px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;background:transparent;color:#cdd6df;cursor:pointer">지우기 Clear</button>
        <button id="ae-close" style="padding:8px 12px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;background:transparent;color:#cdd6df;cursor:pointer">✕</button>
      </div>
      <div id="ae-msg" style="font-size:12px;opacity:0.7;margin-top:6px">?admin=1 로 진입한 관리자 화면입니다. 적용=이 기기에 저장 / 공유링크=모두에게 보이는 URL 생성.</div>`;
    document.body.appendChild(panel);

    const textEl = panel.querySelector('#ae-text') as HTMLInputElement;
    const urlEl = panel.querySelector('#ae-url') as HTMLInputElement;
    const msgEl = panel.querySelector('#ae-msg') as HTMLDivElement;
    textEl.value = cfg.text;
    urlEl.value = cfg.url;

    const current = (): EventCfg => ({ text: textEl.value.trim(), url: urlEl.value.trim() });

    (panel.querySelector('#ae-apply') as HTMLButtonElement).addEventListener('click', () => {
      const c = current();
      this.save(c);
      this.renderBanner(c);
      msgEl.textContent = '✓ 적용됨 (이 기기에 저장). 모두에게 보이려면 공유링크를 복사해 배포하세요.';
    });
    (panel.querySelector('#ae-share') as HTMLButtonElement).addEventListener('click', () => {
      const c = current();
      const u = new URL(window.location.href);
      u.searchParams.set('event', c.text);
      if (c.url) u.searchParams.set('eventUrl', c.url);
      else u.searchParams.delete('eventUrl');
      u.searchParams.delete('admin');
      const link = u.toString();
      void navigator.clipboard?.writeText(link).then(
        () => (msgEl.textContent = '✓ 공유 링크 복사됨: ' + link),
        () => (msgEl.textContent = '공유 링크: ' + link),
      );
    });
    (panel.querySelector('#ae-clear') as HTMLButtonElement).addEventListener('click', () => {
      textEl.value = '';
      urlEl.value = '';
      this.save({ text: '', url: '' });
      this.renderBanner({ text: '', url: '' });
      msgEl.textContent = '공지 지움.';
    });
    (panel.querySelector('#ae-close') as HTMLButtonElement).addEventListener('click', () => {
      panel.remove();
    });
  }

  private load(): EventCfg {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as EventCfg;
    } catch {
      /* localStorage 사용 불가 */
    }
    return { text: '', url: '' };
  }

  private save(cfg: EventCfg): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    } catch {
      /* 무시 */
    }
  }
}
