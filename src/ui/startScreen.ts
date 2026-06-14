import { LOCATIONS } from '../world/locations';
import { LIGHT_PRESETS } from '../world/environment';
import { CONFIG, type CharacterId } from '../config';
import { tournskiLogoImg } from './brand';

// 시작 화면: 실제 산 카드(장소) + 라이더(4종) + 컨디션(광원) 선택 → 출발.
// 시드 대신 "장소 선택"이 시작 메뉴라는 컨셉을 구현.

export interface Selection {
  loc: string;
  char: CharacterId;
  light: string;
}

export class StartScreen {
  private readonly root: HTMLDivElement;
  private sel: Selection = {
    loc: Object.keys(LOCATIONS)[0],
    char: CONFIG.rider.character,
    light: 'bluebird',
  };

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:30',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'overflow-y:auto',
      'padding:36px 20px',
      'box-sizing:border-box',
      'background:linear-gradient(160deg,#0d1520 0%,#16222f 55%,#1c2c3a 100%)',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:#eef3f8',
    ].join(';');
  }

  /** 오버레이를 띄우고 출발 시 선택을 resolve */
  choose(): Promise<Selection> {
    return new Promise((resolve) => {
      this.render(resolve);
      document.body.appendChild(this.root);
    });
  }

  private render(resolve: (s: Selection) => void): void {
    this.root.innerHTML = `
      <div style="max-width:1000px;width:100%">
        <div style="font-size:13px;letter-spacing:4px;opacity:0.6;margin-bottom:4px">FREERIDE POWDER · 실제 지형 다운힐</div>
        <h1 style="font-size:38px;margin:0 0 26px;font-weight:800">프리라이드 파우더</h1>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">① 장소</div>
        <div id="ss-locs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:26px"></div>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">② 라이더</div>
        <div id="ss-chars" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:26px"></div>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">③ 컨디션</div>
        <div id="ss-lights" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:30px"></div>

        <button id="ss-go" style="width:100%;max-width:360px;padding:15px;border:0;border-radius:10px;background:#2f8fe0;color:#fff;font-size:17px;font-weight:800;cursor:pointer">드랍 인 ▸</button>
        <div style="font-size:12px;opacity:0.6;margin-top:14px;line-height:1.7">
          <b style="opacity:0.85">⌨️ 키보드</b> &nbsp; A/D·←/→ 카빙 · W/S 앞·뒤 체중이동 · Shift 크라우치/그랩 · Space 점프 · C 카메라 · M 미니맵 · R 다시<br>
          <b style="opacity:0.85">📱 스마트폰</b> &nbsp; 우하단 <b>'🕹 조이스틱'</b> 버튼으로 켜기 → 좌우=카빙, 상하=체중이동,
          <b>탭=점프</b>, <b>길게=그립</b>, 공중에서 상하로 <b>프론트/백플립</b>, 좌상단 <b>📷 탭=시점 전환</b><br>
          <span style="opacity:0.5">지형은 공개 DEM(AWS Terrain Tiles)으로 실제 표고를 재현했습니다.</span>
        </div>
        <div id="ss-brand" style="margin-top:26px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.12);display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0.92"></div>
      </div>`;

    this.renderLocs();
    this.renderChars();
    this.renderLights();

    // 제작자 정보: tournski 로고 + 회사 소개
    const brand = this.root.querySelector('#ss-brand') as HTMLElement;
    const logo = tournskiLogoImg(40);
    const link = document.createElement('a');
    link.href = 'https://www.tournski.com';
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.cssText = 'pointer-events:auto;text-decoration:none';
    link.appendChild(logo);
    const caption = document.createElement('div');
    caption.style.cssText = 'font-size:12px;color:#cdd6df;text-align:center;line-height:1.6';
    caption.innerHTML =
      '<a href="https://www.tournski.com" target="_blank" rel="noopener" style="color:#5fb0e6;text-decoration:none;pointer-events:auto">www.tournski.com</a><br>스노우마운틴 어드벤쳐 컴퍼니 · since 2005';
    brand.appendChild(link);
    brand.appendChild(caption);

    (this.root.querySelector('#ss-go') as HTMLButtonElement).addEventListener('click', () => {
      this.root.remove();
      resolve(this.sel);
    });
  }

  private renderLocs(): void {
    const host = this.root.querySelector('#ss-locs') as HTMLElement;
    host.innerHTML = '';
    for (const loc of Object.values(LOCATIONS)) {
      const card = document.createElement('div');
      card.dataset.id = loc.id;
      card.style.cssText = cardStyle(loc.id === this.sel.loc);
      card.innerHTML = `
        <div style="font-size:17px;font-weight:700;margin-bottom:2px">${loc.name}</div>
        <div style="font-size:12px;opacity:0.6;margin-bottom:8px">${loc.country}</div>
        <div style="display:flex;gap:14px;font-size:12px;margin-bottom:8px">
          <span>정상 <b>${loc.summit}m</b></span><span>낙차 <b>${loc.vertical}m</b></span>
        </div>
        <div style="font-size:12px;opacity:0.72;line-height:1.5">${loc.desc}</div>`;
      card.addEventListener('click', () => {
        this.sel.loc = loc.id;
        this.renderLocs();
      });
      host.appendChild(card);
    }
  }

  private renderChars(): void {
    const host = this.root.querySelector('#ss-chars') as HTMLElement;
    host.innerHTML = '';
    for (const [id, p] of Object.entries(CONFIG.characters)) {
      const chip = document.createElement('button');
      const on = id === this.sel.char;
      chip.style.cssText = chipStyle(on);
      chip.innerHTML = `<span style="width:13px;height:13px;border-radius:50%;background:${p.jacket};display:inline-block;border:1px solid rgba(255,255,255,0.4)"></span>${p.name}`;
      chip.addEventListener('click', () => {
        this.sel.char = id as CharacterId;
        this.renderChars();
      });
      host.appendChild(chip);
    }
  }

  private renderLights(): void {
    const host = this.root.querySelector('#ss-lights') as HTMLElement;
    host.innerHTML = '';
    for (const p of Object.values(LIGHT_PRESETS)) {
      const chip = document.createElement('button');
      chip.style.cssText = chipStyle(p.id === this.sel.light);
      chip.textContent = p.name;
      chip.addEventListener('click', () => {
        this.sel.light = p.id;
        this.renderLights();
      });
      host.appendChild(chip);
    }
  }
}

function cardStyle(on: boolean): string {
  return [
    'padding:14px 16px',
    'border-radius:11px',
    'cursor:pointer',
    'transition:all 0.15s',
    `background:${on ? 'rgba(47,143,224,0.18)' : 'rgba(255,255,255,0.05)'}`,
    `border:2px solid ${on ? '#2f8fe0' : 'rgba(255,255,255,0.1)'}`,
  ].join(';');
}

function chipStyle(on: boolean): string {
  return [
    'display:inline-flex',
    'align-items:center',
    'gap:8px',
    'padding:9px 15px',
    'border-radius:20px',
    'cursor:pointer',
    'font-size:14px',
    'color:#eef3f8',
    `background:${on ? 'rgba(47,143,224,0.22)' : 'rgba(255,255,255,0.06)'}`,
    `border:2px solid ${on ? '#2f8fe0' : 'rgba(255,255,255,0.12)'}`,
  ].join(';');
}
