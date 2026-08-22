import { LOCATIONS } from '../world/locations';
import { LIGHT_PRESETS } from '../world/environment';
import { CONFIG, type CharacterId } from '../config';
import { tournskiLogoImg } from './brand';

// 시작 화면: 실제 산 카드(장소) + 라이더(4종) + 컨디션(광원) 선택 → 출발.
// 한국어/영어 다국어 (우상단 토글, localStorage 기억).

export type PlayMode = 'free' | 'competition';

export interface Selection {
  mode: PlayMode;
  loc: string;
  char: CharacterId;
  light: string;
}

type Lang = 'ko' | 'en';

const UI = {
  ko: {
    sub: '실제 지형 다운힐 · Real-terrain freeride',
    modeTitle: '① 모드 / Mode',
    freeMode: '🏂 자유 연습',
    compMode: '🏆 대회 참가',
    freeModeDesc: '모든 코스 자유 주행 · 제한 없음',
    compModeDesc: '고정 코스 · 시도 횟수 제한 · 최고 점수 기록',
    loc: '② 장소 / Location',
    compCourse: '② 대회 코스 (고정)',
    rider: '③ 라이더 / Rider',
    cond: '④ 컨디션 / Conditions',
    go: '드랍 인 ▸',
    goComp: '대회 참가 ▸',
    summit: '정상',
    vert: '낙차',
    kbTitle: '⌨️ 키보드',
    kb: 'A/D·←/→ 카빙 · W/S 앞·뒤 체중이동 · Shift 크라우치/그랩 · Space 점프 · C 카메라 · M 미니맵 · R 다시',
    phTitle: '📱 스마트폰',
    ph: "우하단 <b>'🕹 조이스틱'</b> 켜기 → 좌우=카빙, 상하=체중이동, <b>탭=점프</b>, <b>길게=그립</b>, 공중 상하=<b>프론트/백플립</b>, 좌상단 <b>📷 탭=시점</b>",
    dem: '지형은 공개 DEM(AWS Terrain Tiles)으로 실제 표고를 재현했습니다.',
    company: '스노우마운틴 어드벤쳐 컴퍼니 · since 2005',
  },
  en: {
    sub: 'Real-terrain freeride downhill',
    modeTitle: '① Mode',
    freeMode: '🏂 Free Practice',
    compMode: '🏆 Competition',
    freeModeDesc: 'All courses · no limits',
    compModeDesc: 'Fixed course · limited attempts · best score kept',
    loc: '② Location',
    compCourse: '② Competition course (fixed)',
    rider: '③ Rider',
    cond: '④ Conditions',
    go: 'DROP IN ▸',
    goComp: 'ENTER COMPETITION ▸',
    summit: 'Summit',
    vert: 'Vertical',
    kbTitle: '⌨️ Keyboard',
    kb: 'A/D·←/→ carve · W/S fore/aft weight · Shift crouch/grab · Space jump · C camera · M minimap · R restart',
    phTitle: '📱 Smartphone',
    ph: "Tap <b>'🕹 Joystick'</b> (bottom-right) → L/R = carve, up/down = weight, <b>tap = jump</b>, <b>hold = grip</b>, up/down in air = <b>front/back flip</b>, top-left <b>📷 tap = camera</b>",
    dem: 'Terrain reproduced from public DEM (AWS Terrain Tiles).',
    company: 'Snow Mountain Adventure Company · since 2005',
  },
} as const;

const CHAR_EN: Record<string, string> = {
  snowboarder: 'Snowboarder',
  skier: 'Skier',
};
const LIGHT_EN: Record<string, string> = {
  bluebird: 'Bluebird',
  morning: 'Morning',
  snowfall: 'Snowfall',
};
const LOC_EN: Record<string, { country: string; desc: string }> = {
  'bec-des-rosses': {
    country: 'Switzerland · Verbier',
    desc: 'FWT finals venue. Steep north face laced with cliffs and chutes.',
  },
  'hakuba-happo': {
    country: 'Japan · Hakuba, Nagano',
    desc: 'NE face of the Ushiro-Tateyama ridge. Deep Japan powder, lower tree run.',
  },
  'valdez-thompson-pass': {
    country: 'USA · Valdez, Alaska',
    desc: 'Chugach big-mountain heli line. 1.5km of uninterrupted, bench-free face.',
  },
  'jyrgalan-alatoo': {
    country: 'Kyrgyzstan · Jyrgalan',
    desc: 'Long run in eastern Tian Shan. 1.4km from 3670m alpine through larch.',
  },
  'ala-archa': {
    country: 'Kyrgyzstan · Tian Shan',
    desc: 'Glaciated big line in the Ala Archa range. 1.7km from a 4400m+ peak.',
  },
  tanigawadake: {
    country: 'Japan · Gunma, Tanigawa',
    desc: 'East face of Mt. Tanigawa. 1.2km to Tenjindaira, lower tree run.',
  },
  karakol: {
    country: 'Kyrgyzstan · Karakol',
    desc: 'Tian Shan spruce tree run. 1.1km NW face from 3479m.',
  },
  hakkaisan: {
    country: 'Japan · Niigata, Hakkaisan',
    desc: 'Hakkaisan Ropeway. 775m tree run from the 1157m top station.',
  },
  'tuyuksu-pogrebetskogo-1': {
    country: 'Kazakhstan · Almaty, Zailiysky Alatau',
    desc: 'Upper Tuyuksu Glacier. 0.8km from Peak Pogrebetskogo (4202m) into the bowl.',
  },
  'tuyuksu-shymbulak': {
    country: 'Kazakhstan · Almaty, Zailiysky Alatau',
    desc: 'Tuyuksu-to-Shymbulak commute. 0.9km descent from 3372m.',
  },
  'baikal-mamay': {
    country: 'Russia · Baikal, Mamay',
    desc: 'Mamay in the Khamar-Daban range by Lake Baikal. Siberian powder tree run, 746m drop.',
  },
  'baekdu-cheonji': {
    country: 'DPRK·China · Mt. Baekdu',
    desc: 'Alpine line from the Baekdu caldera rim down to Cheonji crater lake. 540m drop from 2734m.',
  },
  'lotte-arai': {
    country: 'Japan · Myoko, Niigata',
    desc: 'Lotte Arai in Myoko, Niigata. Deep-powder tree-run terrain, 406m drop from 1375m.',
  },
};

export class StartScreen {
  private readonly root: HTMLDivElement;
  private lang: Lang;
  private resolve: ((s: Selection) => void) | null = null;
  private sel: Selection = {
    mode: 'free',
    loc: Object.keys(LOCATIONS)[0],
    char: CONFIG.rider.character,
    light: 'bluebird',
  };

  constructor() {
    this.lang = this.initialLang();
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

  choose(): Promise<Selection> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.render();
      document.body.appendChild(this.root);
    });
  }

  private initialLang(): Lang {
    try {
      const saved = localStorage.getItem('tournski_lang');
      if (saved === 'ko' || saved === 'en') return saved;
    } catch {
      /* ignore */
    }
    return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }

  private setLang(lang: Lang): void {
    this.lang = lang;
    try {
      localStorage.setItem('tournski_lang', lang);
    } catch {
      /* ignore */
    }
    this.render();
  }

  private render(): void {
    const t = UI[this.lang];
    this.root.innerHTML = `
      <div style="max-width:1000px;width:100%">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div style="font-size:13px;letter-spacing:3px;opacity:0.6;margin-bottom:4px">${t.sub}</div>
            <h1 style="font-size:34px;margin:0 0 26px;font-weight:800;line-height:1.1">Freeride World<br>Powder Hunter</h1>
          </div>
          <div id="ss-lang" style="display:flex;gap:6px;flex:none"></div>
        </div>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">${t.modeTitle}</div>
        <div id="ss-modes" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:26px"></div>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">${this.sel.mode === 'competition' ? t.compCourse : t.loc}</div>
        <div id="ss-locs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:26px"></div>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">${t.rider}</div>
        <div id="ss-chars" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:26px"></div>

        <div style="font-size:14px;opacity:0.7;margin-bottom:10px">${t.cond}</div>
        <div id="ss-lights" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:30px"></div>

        <button id="ss-go" style="width:100%;max-width:360px;padding:15px;border:0;border-radius:10px;background:${this.sel.mode === 'competition' ? '#e0a52f' : '#2f8fe0'};color:#fff;font-size:17px;font-weight:800;cursor:pointer">${this.sel.mode === 'competition' ? t.goComp : t.go}</button>
        <div style="font-size:12px;opacity:0.6;margin-top:14px;line-height:1.7">
          <b style="opacity:0.85">${t.kbTitle}</b> &nbsp; ${t.kb}<br>
          <b style="opacity:0.85">${t.phTitle}</b> &nbsp; ${t.ph}<br>
          <span style="opacity:0.5">${t.dem}</span>
        </div>
        <div id="ss-brand" style="margin-top:26px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.12);display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0.92"></div>
      </div>`;

    this.renderLang();
    this.renderModes();
    this.renderLocs();
    this.renderChars();
    this.renderLights();
    this.renderBrand();

    (this.root.querySelector('#ss-go') as HTMLButtonElement).addEventListener('click', () => {
      this.root.remove();
      this.resolve?.(this.sel);
    });
  }

  private renderLang(): void {
    const host = this.root.querySelector('#ss-lang') as HTMLElement;
    host.innerHTML = '';
    for (const [code, label] of [
      ['ko', '한국어'],
      ['en', 'English'],
    ] as const) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = chipStyle(this.lang === code) + ';padding:6px 12px;font-size:13px';
      b.addEventListener('click', () => this.setLang(code));
      host.appendChild(b);
    }
  }

  private renderModes(): void {
    const t = UI[this.lang];
    const host = this.root.querySelector('#ss-modes') as HTMLElement;
    host.innerHTML = '';
    const modes: { id: PlayMode; label: string; desc: string }[] = [
      { id: 'free', label: t.freeMode, desc: t.freeModeDesc },
      { id: 'competition', label: t.compMode, desc: t.compModeDesc },
    ];
    for (const m of modes) {
      const card = document.createElement('div');
      card.style.cssText = modeCardStyle(this.sel.mode === m.id, m.id === 'competition');
      card.innerHTML = `
        <div style="font-size:16px;font-weight:800;margin-bottom:4px">${m.label}</div>
        <div style="font-size:12px;opacity:0.7;line-height:1.4">${m.desc}</div>`;
      card.addEventListener('click', () => {
        if (this.sel.mode === m.id) return;
        this.sel.mode = m.id;
        // 대회 모드는 고정 코스로 강제
        if (m.id === 'competition') this.sel.loc = CONFIG.competition.locationId;
        this.render();
      });
      host.appendChild(card);
    }
  }

  private renderLocs(): void {
    const t = UI[this.lang];
    const host = this.root.querySelector('#ss-locs') as HTMLElement;
    host.innerHTML = '';
    const comp = this.sel.mode === 'competition';
    const locs = comp
      ? [LOCATIONS[CONFIG.competition.locationId]].filter(Boolean)
      : Object.values(LOCATIONS);
    for (const loc of locs) {
      const en = LOC_EN[loc.id];
      const name = this.lang === 'en' ? loc.nameEn : loc.name;
      const country = this.lang === 'en' && en ? en.country : loc.country;
      const desc = this.lang === 'en' && en ? en.desc : loc.desc;
      const card = document.createElement('div');
      // 대회 모드: 고정 코스 → 항상 선택 상태, 클릭 불가
      card.style.cssText = comp
        ? cardStyle(true) + ';cursor:default'
        : cardStyle(loc.id === this.sel.loc);
      card.innerHTML = `
        <div style="font-size:17px;font-weight:700;margin-bottom:2px">${name}</div>
        <div style="font-size:12px;opacity:0.6;margin-bottom:8px">${country}</div>
        <div style="display:flex;gap:14px;font-size:12px;margin-bottom:8px">
          <span>${t.summit} <b>${loc.summit}m</b></span><span>${t.vert} <b>${loc.vertical}m</b></span>
        </div>
        <div style="font-size:12px;opacity:0.72;line-height:1.5">${desc}</div>`;
      if (!comp) {
        card.addEventListener('click', () => {
          this.sel.loc = loc.id;
          this.renderLocs();
        });
      }
      host.appendChild(card);
    }
  }

  private renderChars(): void {
    const host = this.root.querySelector('#ss-chars') as HTMLElement;
    host.innerHTML = '';
    for (const [id, p] of Object.entries(CONFIG.characters)) {
      const chip = document.createElement('button');
      chip.style.cssText = chipStyle(id === this.sel.char);
      const label = this.lang === 'en' ? (CHAR_EN[id] ?? p.name) : p.name;
      chip.innerHTML = `<span style="width:13px;height:13px;border-radius:50%;background:${p.jacket};display:inline-block;border:1px solid rgba(255,255,255,0.4)"></span>${label}`;
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
      chip.textContent = this.lang === 'en' ? (LIGHT_EN[p.id] ?? p.name) : p.name;
      chip.addEventListener('click', () => {
        this.sel.light = p.id;
        this.renderLights();
      });
      host.appendChild(chip);
    }
  }

  private renderBrand(): void {
    const brand = this.root.querySelector('#ss-brand') as HTMLElement;
    const link = document.createElement('a');
    link.href = 'https://www.tournski.com';
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.cssText = 'pointer-events:auto;text-decoration:none';
    link.appendChild(tournskiLogoImg(40));
    const caption = document.createElement('div');
    caption.style.cssText = 'font-size:12px;color:#cdd6df;text-align:center;line-height:1.6';
    caption.innerHTML = `<a href="https://www.tournski.com" target="_blank" rel="noopener" style="color:#5fb0e6;text-decoration:none;pointer-events:auto">www.tournski.com</a><br>${UI[this.lang].company}`;
    brand.appendChild(link);
    brand.appendChild(caption);
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

function modeCardStyle(on: boolean, comp: boolean): string {
  const accent = comp ? '#e0a52f' : '#2f8fe0';
  return [
    'flex:1',
    'min-width:200px',
    'padding:16px 18px',
    'border-radius:12px',
    'cursor:pointer',
    'transition:all 0.15s',
    `background:${on ? (comp ? 'rgba(224,165,47,0.16)' : 'rgba(47,143,224,0.16)') : 'rgba(255,255,255,0.05)'}`,
    `border:2px solid ${on ? accent : 'rgba(255,255,255,0.1)'}`,
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
