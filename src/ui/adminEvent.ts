import { LOCATIONS } from '../world/locations';

// 중앙 공지 시스템: public/announcements.json 을 런타임에 읽어 와(커밋→모든 방문자 자동 반영)
// 장소별 + 전체(global) 공지를 표시한다. 아웃링크가 있으면 배너 클릭 시 새 탭으로 연결.
// 관리자(?admin=1)는 패널에서 공지를 편집해 announcements.json 내용을 생성·복사 → 리포에 커밋.

interface Entry {
  text: string;
  url: string;
}
interface Announcements {
  global: Entry;
  locations: Record<string, Entry>;
}

const EMPTY: Entry = { text: '', url: '' };

export class AdminEvent {
  private readonly banner: HTMLDivElement;
  private data: Announcements = { global: { ...EMPTY }, locations: {} };
  private locId = '';
  private refreshPanel: (() => void) | null = null;

  constructor() {
    this.banner = document.createElement('div');
    this.banner.style.cssText = [
      'position:fixed',
      'top:46px', // 좌상단 시점(📷) 버튼 바로 아래
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

    void this.fetchData();
    if (new URLSearchParams(window.location.search).get('admin') === '1') this.buildAdminPanel();
  }

  /** 현재 장소 설정 → 해당 공지로 배너 갱신 */
  setLocation(locId: string): void {
    this.locId = locId;
    this.render();
  }

  private async fetchData(): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}announcements.json?t=${Date.now()}`);
      if (!res.ok) return;
      const j = (await res.json()) as Partial<Announcements>;
      this.data = {
        global: { ...EMPTY, ...(j.global ?? {}) },
        locations: j.locations ?? {},
      };
      this.render();
      this.refreshPanel?.();
    } catch {
      /* 공지 파일 없거나 네트워크 오류 → 배너 없음 */
    }
  }

  /** 장소별 공지 우선, 없으면 전체 공지 */
  private entryFor(): Entry {
    const loc = this.data.locations[this.locId];
    if (loc && loc.text.trim()) return loc;
    if (this.data.global.text.trim()) return this.data.global;
    return EMPTY;
  }

  private render(): void {
    const e = this.entryFor();
    if (!e.text.trim()) {
      this.banner.style.display = 'none';
      return;
    }
    this.banner.textContent = `📣 ${e.text}${e.url ? '  ↗' : ''}`;
    this.banner.style.display = 'block';
    this.banner.style.cursor = e.url ? 'pointer' : 'default';
    this.banner.style.pointerEvents = e.url ? 'auto' : 'none';
    this.banner.onclick = e.url ? () => window.open(e.url, '_blank', 'noopener') : null;
  }

  // ── 관리자 패널 ─────────────────────────────────────────
  private buildAdminPanel(): void {
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

    const locOptions = ['<option value="__global">전체 (Global)</option>']
      .concat(Object.values(LOCATIONS).map((l) => `<option value="${l.id}">${l.name}</option>`))
      .join('');

    panel.innerHTML = `
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">🛠 관리자 / Admin — 장소별 이벤트 공지 (per-location)</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <select id="ae-loc" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1a1f27;color:#fff;font-size:13px">${locOptions}</select>
        <input id="ae-text" placeholder="공지 텍스트 / Event text" style="flex:2;min-width:180px;padding:8px;border-radius:6px;border:1px solid #444;background:#1a1f27;color:#fff;font-size:13px" />
        <input id="ae-url" placeholder="아웃링크 / Outlink (https://…)" style="flex:2;min-width:180px;padding:8px;border-radius:6px;border:1px solid #444;background:#1a1f27;color:#fff;font-size:13px" />
        <button id="ae-preview" style="padding:8px 12px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;background:transparent;color:#cdd6df;cursor:pointer">미리보기 Preview</button>
        <button id="ae-copy" style="padding:8px 14px;border:0;border-radius:6px;background:#46c98b;color:#0d1520;font-weight:800;cursor:pointer">JSON 복사 Copy</button>
        <button id="ae-close" style="padding:8px 12px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;background:transparent;color:#cdd6df;cursor:pointer">✕</button>
      </div>
      <div id="ae-msg" style="font-size:12px;opacity:0.75;margin-top:6px">장소를 고르고 공지를 입력 → <b>JSON 복사</b> → 리포의 <b>public/announcements.json</b>에 붙여 커밋하면 모든 방문자에게 반영됩니다.</div>`;
    document.body.appendChild(panel);

    const locEl = panel.querySelector('#ae-loc') as HTMLSelectElement;
    const textEl = panel.querySelector('#ae-text') as HTMLInputElement;
    const urlEl = panel.querySelector('#ae-url') as HTMLInputElement;
    const msgEl = panel.querySelector('#ae-msg') as HTMLDivElement;

    const entryOf = (sel: string): Entry =>
      sel === '__global' ? this.data.global : (this.data.locations[sel] ?? { ...EMPTY });
    const loadFields = (): void => {
      const e = entryOf(locEl.value);
      textEl.value = e.text;
      urlEl.value = e.url;
    };
    const applyToData = (): void => {
      const e: Entry = { text: textEl.value.trim(), url: urlEl.value.trim() };
      if (locEl.value === '__global') this.data.global = e;
      else this.data.locations[locEl.value] = e;
    };

    loadFields();
    this.refreshPanel = loadFields; // fetch 완료 후 현재 선택 다시 로드
    locEl.addEventListener('change', loadFields);

    (panel.querySelector('#ae-preview') as HTMLButtonElement).addEventListener('click', () => {
      applyToData();
      this.render();
      msgEl.textContent = '✓ 미리보기 적용(이 화면만). 모두에게 반영하려면 JSON 복사 후 커밋하세요.';
    });
    (panel.querySelector('#ae-copy') as HTMLButtonElement).addEventListener('click', () => {
      applyToData();
      const out: Announcements = { global: this.data.global, locations: {} };
      for (const id of Object.keys(LOCATIONS)) {
        out.locations[id] = this.data.locations[id] ?? { ...EMPTY };
      }
      const json = JSON.stringify(out, null, 2);
      void navigator.clipboard?.writeText(json).then(
        () => (msgEl.textContent = '✓ JSON 복사됨 → public/announcements.json 에 붙여넣고 커밋하세요.'),
        () => (msgEl.textContent = json),
      );
    });
    (panel.querySelector('#ae-close') as HTMLButtonElement).addEventListener('click', () => {
      this.refreshPanel = null;
      panel.remove();
    });
  }
}
