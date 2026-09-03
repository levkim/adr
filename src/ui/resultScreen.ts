import { CONFIG } from '../config';
import type { Terrain } from '../world/terrain';
import type { Run, ScoreCard } from '../scoring/run';
import type { CompetitionSession } from '../scoring/competition';
import { renderHillshade, worldToMapPx } from './terrainMap';
import { renderShareCard, shareOrDownloadCard } from './shareCard';
import { LeaderboardScreen } from './leaderboardScreen';
import { isEnabled as leaderboardEnabled } from '../net/leaderboard';
import { consentBlockHtml, consentGiven, setConsent } from './consent';

// 대회 모드 결과 컨텍스트 (자유 연습이면 undefined)
export interface CompContext {
  session: CompetitionSession;
  isBest: boolean;
  attemptNo: number;
}

// 결과 화면: 항목별 저지 점수 + 라인 궤적을 산 위(탑다운 힐셰이드)에 표시 + 다시 하기.
// 캔버스 2D + HTML 오버레이로 구성.

const MAP_SIZE = 340; // px, 미니맵 해상도

export class ResultScreen {
  private readonly root: HTMLDivElement;
  private readonly mapCanvas: HTMLCanvasElement;

  constructor(
    private readonly onRetry: () => void,
    private readonly onHome?: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:20',
      'display:none',
      'align-items:flex-start', // 내용이 화면보다 길면 위에서부터 스크롤 (모바일)
      'justify-content:center',
      'gap:28px',
      'flex-wrap:wrap',
      'overflow-y:auto',
      '-webkit-overflow-scrolling:touch',
      'padding:24px 16px',
      'box-sizing:border-box',
      'background:rgba(10,14,20,0.72)',
      'backdrop-filter:blur(3px)',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:#eef3f8',
    ].join(';');

    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = MAP_SIZE;
    this.mapCanvas.height = MAP_SIZE;
    this.mapCanvas.style.cssText =
      'border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.5);background:#1a1f26';

    document.body.appendChild(this.root);
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  show(card: ScoreCard, run: Run, terrain: Terrain, comp?: CompContext): void {
    this.renderMap(run, terrain);
    this.root.innerHTML = '';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px';
    const mapTitle = document.createElement('div');
    mapTitle.textContent = `${terrain.meta.name} · 라인 궤적`;
    mapTitle.style.cssText = 'font-size:14px;opacity:0.85';
    left.appendChild(mapTitle);
    left.appendChild(this.mapCanvas);

    const card$ = document.createElement('div');
    card$.style.cssText =
      'min-width:320px;max-width:380px;background:rgba(18,22,28,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:24px 26px';

    const grade = gradeOf(card.overall);
    const canRetry = !comp || comp.session.canAttempt();
    const retryLabel = !comp
      ? '다시 하기 (R)'
      : canRetry
        ? `다음 시도 (R) · 남은 ${comp.session.attemptsLeft()}회`
        : '대회 종료 · 시도 소진';
    const compBlock = comp
      ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;background:rgba(224,165,47,0.14);border:1px solid rgba(224,165,47,0.4);margin-bottom:14px;font-size:13px">
          <span>🏆 시도 <b>${comp.attemptNo}/${comp.session.maxAttempts}</b></span>
          <span>최고 <b style="color:#f5c542">${(comp.session.bestCard?.overall ?? card.overall).toFixed(1)}</b></span>
          ${comp.isBest ? '<span style="color:#46c98b;font-weight:700">🎉 신기록</span>' : ''}
        </div>`
      : '';
    card$.innerHTML = `
      <div style="font-size:13px;letter-spacing:2px;opacity:0.7">저지 스코어</div>
      <div style="display:flex;align-items:baseline;gap:12px;margin:2px 0 16px">
        <div style="font-size:58px;font-weight:800;line-height:1">${card.overall.toFixed(1)}</div>
        <div style="font-size:22px;font-weight:700;color:${grade.color}">${grade.label}</div>
      </div>
      ${compBlock}
      ${bar('라인 난이도', card.line, '#e0773a')}
      ${bar('에어 & 스타일', card.air, '#3a9ae0')}
      ${bar('유려함', card.fluidity, '#46c98b')}
      ${bar('컨트롤', card.control, '#d65a7a')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-top:18px;font-size:13px;opacity:0.9">
        <div>시간</div><div style="text-align:right">${card.timeSec.toFixed(1)}s</div>
        <div>하강 표고</div><div style="text-align:right">${Math.round(card.vertical)} m</div>
        <div>최고 속도</div><div style="text-align:right">${Math.round(card.topSpeed)} km/h</div>
        <div>트릭</div><div style="text-align:right">${card.tricks}회 (최고 ${card.bestRotation}°·${card.bestAir.toFixed(1)}s)</div>
        <div>낙상</div><div style="text-align:right">${card.crashes}회</div>
      </div>
      <button id="retry-btn" ${canRetry ? '' : 'disabled'} style="width:100%;margin-top:20px;padding:12px;border:0;border-radius:8px;background:${canRetry ? '#3a9ae0' : 'rgba(255,255,255,0.12)'};color:${canRetry ? '#fff' : '#8a939c'};font-size:15px;font-weight:700;cursor:${canRetry ? 'pointer' : 'default'}">${retryLabel}</button>
      <button id="home-btn" style="width:100%;margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#cdd6df;font-size:13px;cursor:pointer">장소·캐릭터 변경</button>
      ${
        comp
          ? `<div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.12);padding-top:14px;display:flex;flex-direction:column;gap:8px">
              <div style="font-size:11px;opacity:0.55;line-height:1.4">연락처는 경품 안내용이며 비공개입니다. 공개 랭킹엔 이름이 <b>성·끝 글자만</b>(예: 홍*동) 표시됩니다.</div>
              <input id="sc-name" maxlength="30" placeholder="이름 / Name" style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#1a1f27;color:#fff;font-size:14px" />
              <input id="sc-phone" maxlength="20" inputmode="tel" placeholder="핸드폰번호 / Phone" style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#1a1f27;color:#fff;font-size:14px" />
              <input id="sc-email" maxlength="60" placeholder="이메일(선택) / Email" style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#1a1f27;color:#fff;font-size:14px" />
              ${leaderboardEnabled() ? consentBlockHtml('sc-consent') : ''}
              <button id="sc-share" style="width:100%;padding:12px;border:0;border-radius:8px;background:#e0a52f;color:#1a1204;font-size:15px;font-weight:800;cursor:pointer">📸 결과 카드 공유</button>
              ${
                leaderboardEnabled()
                  ? '<button id="sc-rank" style="width:100%;padding:12px;border:0;border-radius:8px;background:#2f8fe0;color:#fff;font-size:15px;font-weight:800;cursor:pointer">🏆 랭킹 등록·보기</button>'
                  : ''
              }
              <div id="sc-msg" style="font-size:12px;opacity:0.7;text-align:center;min-height:16px"></div>
              <div style="margin-top:6px;padding:11px 13px;border-radius:9px;background:rgba(224,165,47,0.12);border:1px solid rgba(224,165,47,0.4);font-size:12px;line-height:1.7;text-align:left">
                <div style="font-weight:800;margin-bottom:5px">🎯 입상 치트키</div>
                <div>· 본인 결과 <b>SNS 공유 시 +3점</b> — 태그 필수: 인스타 <a href="https://instagram.com/tournski_official" target="_blank" rel="noopener" style="color:#7fc4ff;text-decoration:none">@tournski_official</a> / 페이스북 <a href="https://facebook.com/tournski" target="_blank" rel="noopener" style="color:#7fc4ff;text-decoration:none">@tournski</a></div>
                <div>· <a href="https://www.tournski.com" target="_blank" rel="noopener" style="color:#7fc4ff;text-decoration:none">투어앤스키(www.tournski.com)</a> <b>회원가입 시 +3점</b></div>
              </div>
            </div>`
          : ''
      }
    `;

    this.root.appendChild(left);
    this.root.appendChild(card$);
    this.root.style.display = 'flex';

    if (canRetry) {
      (card$.querySelector('#retry-btn') as HTMLButtonElement).addEventListener('click', () =>
        this.onRetry(),
      );
    }
    const homeBtn = card$.querySelector('#home-btn') as HTMLButtonElement;
    if (this.onHome) homeBtn.addEventListener('click', () => this.onHome!());
    else homeBtn.style.display = 'none';

    if (comp) this.wireShare(card$, card, run, terrain);
  }

  /** 대회 결과 카드 공유 버튼 + 닉네임/이메일 입력 (localStorage 유지) */
  private wireShare(card$: HTMLElement, card: ScoreCard, run: Run, terrain: Terrain): void {
    const name = card$.querySelector('#sc-name') as HTMLInputElement;
    const phone = card$.querySelector('#sc-phone') as HTMLInputElement;
    const email = card$.querySelector('#sc-email') as HTMLInputElement;
    const shareBtn = card$.querySelector('#sc-share') as HTMLButtonElement;
    const msg = card$.querySelector('#sc-msg') as HTMLDivElement;
    const get = (k: string): string => {
      try {
        return localStorage.getItem(k) ?? '';
      } catch {
        return '';
      }
    };
    const set = (k: string, v: string): void => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    };
    name.value = get('tournski_name');
    phone.value = get('tournski_phone');
    email.value = get('tournski_email');
    name.addEventListener('input', () => set('tournski_name', name.value.trim()));
    phone.addEventListener('input', () => set('tournski_phone', phone.value.trim()));
    email.addEventListener('input', () => set('tournski_email', email.value.trim()));

    shareBtn.addEventListener('click', async () => {
      shareBtn.disabled = true;
      const label = shareBtn.textContent;
      shareBtn.textContent = '카드 생성 중…';
      msg.textContent = '';
      try {
        const canvas = await renderShareCard({
          card,
          run,
          terrain,
          resortName: terrain.meta.name,
          nickname: name.value.trim() || 'RIDER',
          email: email.value.trim() || undefined,
          // 랭킹 백엔드가 붙기 전 → rank/total 미전달 시 카드에 '랭킹 집계 예정' 표시
        });
        const score = card.overall.toFixed(1);
        const how = await shareOrDownloadCard(
          canvas,
          `tournski-${terrain.meta.id}-${score}.png`,
          `${CONFIG.shareCard.competitionName} · ${terrain.meta.name} — ${score}점!`,
        );
        msg.textContent = how === 'shared' ? '공유했습니다 ✓' : 'PNG로 저장했습니다 ✓';
      } catch {
        msg.textContent = '카드 생성 실패 — 다시 시도해 주세요';
      } finally {
        shareBtn.disabled = false;
        shareBtn.textContent = label;
      }
    });

    // 개인정보 동의 체크박스 (백엔드 enabled 시 존재)
    const consentEl = card$.querySelector('#sc-consent') as HTMLInputElement | null;
    consentEl?.addEventListener('change', () => setConsent(consentEl.checked));

    // 랭킹 등록·보기 (백엔드 enabled 시에만 버튼 존재)
    const rankBtn = card$.querySelector('#sc-rank') as HTMLButtonElement | null;
    if (rankBtn) {
      rankBtn.addEventListener('click', () => {
        if (!name.value.trim()) {
          msg.textContent = '경품 안내를 위해 이름을 입력해 주세요';
          name.focus();
          return;
        }
        if (!phone.value.trim()) {
          msg.textContent = '경품 안내를 위해 핸드폰번호를 입력해 주세요';
          phone.focus();
          return;
        }
        if (consentEl && !consentEl.checked && !consentGiven()) {
          msg.textContent = '개인정보 수집·이용에 동의해 주세요';
          consentEl.focus();
          return;
        }
        void new LeaderboardScreen().submitAndShow({
          locationId: terrain.meta.id,
          courseName: terrain.meta.name,
          nickname: maskName(name.value.trim()), // 공개 랭킹 표시명 = 마스킹 이름(홍**)
          name: name.value.trim(),
          phone: phone.value.trim(),
          card,
          log: run.runLog(),
        });
      });
    }
  }

  /** 탑다운 힐셰이드 + 궤적 */
  private renderMap(run: Run, terrain: Terrain): void {
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;
    const S = MAP_SIZE;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(renderHillshade(terrain, S), 0, 0);

    // 궤적
    const toPx = (x: number, z: number) => worldToMapPx(terrain, x, z, S);
    const traj = run.trajectory;
    if (traj.length > 1) {
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,90,60,0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      const p0 = toPx(traj[0].x, traj[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < traj.length; i++) {
        const p = toPx(traj[i].x, traj[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 시작/끝 마커
      marker(ctx, p0.x, p0.y, '#46c98b'); // 드랍 인
      const pn = toPx(traj[traj.length - 1].x, traj[traj.length - 1].y);
      marker(ctx, pn.x, pn.y, '#3a9ae0'); // 피니시
    }
  }
}

// 공개 랭킹용 이름 마스킹: 성 + 끝 글자만 노출, 가운데는 * (예: 홍길동 → 홍*동, 남궁민수 → 남**수).
function maskName(name: string): string {
  const n = name.trim();
  if (!n) return 'RIDER';
  if (n.length <= 2) return n; // 1~2글자는 성+끝자 = 전체
  return n[0] + '*'.repeat(n.length - 2) + n[n.length - 1];
}

function bar(label: string, value: number, color: string): string {
  return `
    <div style="margin:7px 0">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
        <span style="opacity:0.85">${label}</span><span style="font-weight:700">${Math.round(value)}</span>
      </div>
      <div style="height:7px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${value}%;background:${color}"></div>
      </div>
    </div>`;
}

function marker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

function gradeOf(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'PODIUM', color: '#f5c542' };
  if (score >= 70) return { label: 'SOLID', color: '#46c98b' };
  if (score >= 50) return { label: 'OK', color: '#3a9ae0' };
  return { label: 'SKETCHY', color: '#d65a7a' };
}
