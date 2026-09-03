import { CONFIG } from '../config';
import type { ScoreCard, RunLog } from '../scoring/run';
import * as lb from '../net/leaderboard';
import { consentBlockHtml, setConsent } from './consent';

// 대회 랭킹보드 화면 (모달). 이메일 OTP 로그인 → 점수 제출 → 순위 표시.
// 내 순위는 항상 상단 고정. 상위 topLimit 노출, 그 밖이면 내 주변 순위만.
// 실시간 아님 — 열 때/새로고침 버튼으로 갱신.

interface SubmitPayload {
  locationId: string;
  courseName: string;
  nickname: string;
  name?: string; // 경품 연락용(비공개)
  phone?: string; // 경품 연락용(비공개)
  card: ScoreCard;
  log: RunLog;
}

const overlayCss = [
  'position:fixed',
  'inset:0',
  'z-index:50',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'padding:16px',
  'box-sizing:border-box',
  'background:rgba(8,12,18,0.86)',
  'backdrop-filter:blur(4px)',
  'font-family:system-ui,-apple-system,sans-serif',
  'color:#eef3f8',
].join(';');

const panelCss = [
  'width:100%',
  'max-width:440px',
  'max-height:90vh',
  'overflow-y:auto',
  'background:rgba(18,22,28,0.98)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:14px',
  'padding:22px 22px',
].join(';');

export class LeaderboardScreen {
  private readonly root: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = overlayCss;
  }

  private open(): void {
    if (!this.root.parentElement) document.body.appendChild(this.root);
  }
  private closeResolve: (() => void) | null = null;
  private posterUrl = ''; // 대회 페이지 상단 포스터 (있을 때만)
  private showPromo = false; // 대회 랜딩(딥링크)에서만 '입상 치트키' 노출

  private close(): void {
    this.root.remove();
    const r = this.closeResolve;
    this.closeResolve = null;
    r?.();
  }

  /** 점수 제출 후 랭킹 표시 (필요 시 로그인 먼저) */
  async submitAndShow(p: SubmitPayload): Promise<void> {
    this.open();
    try {
      if (!lb.isLoggedIn()) await this.renderLogin();
      this.renderStatus('점수 제출 중…');
      const result = await lb.submitScore({
        locationId: p.locationId,
        nickname: p.nickname,
        name: p.name,
        phone: p.phone,
        card: p.card,
        log: p.log,
        clientVersion: 'web',
      });
      await this.renderBoard(p.locationId, p.courseName, result);
    } catch (err) {
      this.renderError(err, () => void this.submitAndShow(p));
    }
  }

  /** 랭킹만 보기 (닫기 누를 때까지 대기). limit=상위 인원수, poster=상단 포스터 경로 */
  show(locationId: string, courseName: string, limit?: number, poster?: string): Promise<void> {
    this.posterUrl = poster ?? '';
    this.showPromo = true;
    return new Promise((resolve) => {
      this.closeResolve = resolve;
      this.open();
      this.renderBoard(locationId, courseName, undefined, limit).catch((err) =>
        this.renderError(err, () =>
          void this.renderBoard(locationId, courseName, undefined, limit),
        ),
      );
    });
  }

  // ── 로그인 (이메일 OTP) ──
  private renderLogin(): Promise<void> {
    return new Promise((resolve, reject) => {
      const saved = lb.currentEmail() ?? '';
      this.root.innerHTML = `
        <div style="${panelCss}">
          <div style="font-size:20px;font-weight:800;margin-bottom:6px">🏆 대회 랭킹 등록</div>
          <div style="font-size:13px;opacity:0.75;margin-bottom:16px;line-height:1.5">경품 응모·순위 등록을 위해 이메일 인증이 필요합니다.</div>
          <input id="lb-email" type="email" placeholder="이메일 / Email" value="${saved}" style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#1a1f27;color:#fff;font-size:15px;margin-bottom:10px" />
          ${consentBlockHtml('lb-consent')}
          <button id="lb-send" style="width:100%;margin-top:10px;padding:12px;border:0;border-radius:8px;background:#2f8fe0;color:#fff;font-size:15px;font-weight:700;cursor:pointer">인증코드 받기</button>
          <div id="lb-code-wrap" style="display:none;margin-top:12px">
            <input id="lb-code" inputmode="numeric" placeholder="이메일로 받은 코드" style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#1a1f27;color:#fff;font-size:15px;margin-bottom:8px" />
            <button id="lb-verify" style="width:100%;padding:12px;border:0;border-radius:8px;background:#46c98b;color:#07130d;font-size:15px;font-weight:800;cursor:pointer">확인하고 등록</button>
          </div>
          <div id="lb-msg" style="font-size:12px;opacity:0.8;margin-top:10px;min-height:16px"></div>
          <button id="lb-cancel" style="width:100%;margin-top:10px;padding:9px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#cdd6df;font-size:13px;cursor:pointer">취소</button>
        </div>`;
      const $ = (id: string) => this.root.querySelector(id) as HTMLElement;
      const emailEl = $('#lb-email') as HTMLInputElement;
      const codeWrap = $('#lb-code-wrap');
      const msg = $('#lb-msg');
      const consentEl = $('#lb-consent') as HTMLInputElement;
      consentEl.addEventListener('change', () => setConsent(consentEl.checked));

      ($('#lb-send') as HTMLButtonElement).addEventListener('click', async () => {
        const email = emailEl.value.trim();
        if (!email || !email.includes('@')) {
          msg.textContent = '올바른 이메일을 입력하세요';
          return;
        }
        if (!consentEl.checked) {
          msg.textContent = '개인정보 수집·이용에 동의해 주세요';
          return;
        }
        msg.textContent = '전송 중…';
        try {
          await lb.sendOtp(email);
          codeWrap.style.display = 'block';
          msg.textContent = '이메일로 받은 인증코드를 입력하세요';
        } catch (e) {
          msg.textContent = e instanceof Error ? e.message : '전송 실패';
        }
      });
      ($('#lb-verify') as HTMLButtonElement).addEventListener('click', async () => {
        const email = emailEl.value.trim();
        const code = ($('#lb-code') as HTMLInputElement).value.trim();
        msg.textContent = '확인 중…';
        try {
          await lb.verifyOtp(email, code);
          resolve();
        } catch (e) {
          msg.textContent = e instanceof Error ? e.message : '인증 실패';
        }
      });
      ($('#lb-cancel') as HTMLButtonElement).addEventListener('click', () => {
        this.close();
        reject(new Error('cancelled'));
      });
    });
  }

  // ── 랭킹 보드 ──
  private async renderBoard(
    locationId: string,
    courseName: string,
    myResult?: lb.SubmitResult,
    limit?: number,
  ): Promise<void> {
    this.renderStatus('랭킹 불러오는 중…');
    const [top, mine] = await Promise.all([
      lb.getTop(locationId, limit),
      lb.isLoggedIn() ? lb.getMyRank(locationId).catch(() => []) : Promise.resolve([]),
    ]);
    const myRow = mine.find((r) => r.is_me);
    const total = top.length; // 대략치. 정확 총원은 myResult.total 우선
    const totalN = myResult?.total ?? total;

    // 내 순위 고정 배너
    let pinned: string;
    if (myRow) {
      pinned = `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:10px;background:rgba(224,165,47,0.16);border:1px solid rgba(224,165,47,0.5);margin-bottom:12px">
        <span style="font-weight:800">내 순위 · ${totalN}명 중 <span style="color:#f5c542">${myRow.rank}위</span></span>
        <span style="font-weight:800;font-size:18px">${myRow.overall.toFixed(1)}</span></div>`;
    } else if (lb.isLoggedIn()) {
      pinned = `<div style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.06);margin-bottom:12px;font-size:13px;opacity:0.8">아직 등록된 기록이 없습니다</div>`;
    } else {
      pinned = `<div style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.06);margin-bottom:12px;font-size:13px;opacity:0.85">로그인하면 내 순위가 표시됩니다</div>`;
    }

    const rowHtml = (r: lb.LeaderRow): string => {
      const me = r.is_me;
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;${me ? 'background:rgba(47,143,224,0.20);border:1px solid rgba(47,143,224,0.5)' : ''}">
        <span style="width:42px;font-weight:800;color:${me ? '#7fc4ff' : '#cdd6df'}">${medal || r.rank}</span>
        <span style="flex:1;min-width:0">
          <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.nickname)}${r.name_masked ? ` <span style="opacity:0.6;font-weight:400">(${escapeHtml(r.name_masked)})</span>` : ''}</span>
          <span style="display:block;font-size:11px;opacity:0.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.email_masked ?? '')}</span>
        </span>
        <span style="font-weight:800">${r.overall.toFixed(1)}</span></div>`;
    };

    let list = top.map(rowHtml).join('');
    // 내가 topLimit 밖이면 구분선 + 주변 순위
    if (myRow && myRow.rank > top.length && mine.length) {
      list += `<div style="text-align:center;opacity:0.5;padding:6px">⋯</div>` + mine.map(rowHtml).join('');
    }

    const poster = this.posterUrl
      ? `<img src="${import.meta.env.BASE_URL}${this.posterUrl}" alt="대회 포스터" style="width:100%;border-radius:10px;margin-bottom:14px;display:block" onerror="this.style.display='none'" />`
      : '';
    this.root.innerHTML = `
      <div style="${panelCss}">
        ${poster}
        <div style="font-size:20px;font-weight:800">🏆 ${CONFIG.shareCard.competitionName}</div>
        <div style="font-size:13px;opacity:0.7;margin-bottom:14px">${escapeHtml(courseName)} · ${totalN}명 참가</div>
        ${
          this.showPromo
            ? `<div style="margin-bottom:14px;padding:12px 14px;border-radius:10px;background:rgba(224,165,47,0.12);border:1px solid rgba(224,165,47,0.4);font-size:13px;line-height:1.7">
                <div style="font-weight:800;margin-bottom:6px">🎯 입상 치트키</div>
                <div>· 본인 결과 <b>SNS 공유 시 +3점</b> — 태그 필수: 인스타 <a href="https://instagram.com/tournski_official" target="_blank" rel="noopener" style="color:#7fc4ff;text-decoration:none">@tournski_official</a> / 페이스북 <a href="https://facebook.com/tournski" target="_blank" rel="noopener" style="color:#7fc4ff;text-decoration:none">@tournski</a></div>
                <div>· <a href="https://www.tournski.com" target="_blank" rel="noopener" style="color:#7fc4ff;text-decoration:none">투어앤스키(www.tournski.com)</a> <b>회원가입 시 +3점</b></div>
              </div>`
            : ''
        }
        ${myResult ? `<div style="font-size:13px;color:${myResult.improved ? '#46c98b' : '#9fb0bf'};margin-bottom:10px">${myResult.improved ? '🎉 최고 기록 갱신!' : '이번 기록은 최고점보다 낮습니다'}${myResult.flagged ? ' · ⚠︎ 검토 대상' : ''}</div>` : ''}
        ${pinned}
        <div style="display:flex;flex-direction:column;gap:4px">${list || '<div style="opacity:0.6;padding:20px;text-align:center">아직 기록이 없습니다</div>'}</div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button id="lb-refresh" style="flex:1;padding:11px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#cdd6df;font-size:14px;cursor:pointer">↻ 새로고침</button>
          <button id="lb-close" style="flex:1;padding:11px;border:0;border-radius:8px;background:${this.showPromo ? '#e0a52f' : '#2f8fe0'};color:${this.showPromo ? '#1a1204' : '#fff'};font-size:14px;font-weight:800;cursor:pointer">${this.showPromo ? '대회 참가 GO ▸' : '닫기'}</button>
        </div>
      </div>`;
    (this.root.querySelector('#lb-refresh') as HTMLButtonElement).addEventListener('click', () =>
      this.renderBoard(locationId, courseName, myResult, limit),
    );
    (this.root.querySelector('#lb-close') as HTMLButtonElement).addEventListener('click', () =>
      this.close(),
    );
  }

  private renderStatus(text: string): void {
    this.root.innerHTML = `<div style="${panelCss};text-align:center">
      <div style="font-size:15px;opacity:0.85;padding:30px 0">${text}</div></div>`;
  }
  private renderError(err: unknown, retry: () => void): void {
    const m = err instanceof Error ? err.message : '오류';
    if (m === 'cancelled') return;
    this.root.innerHTML = `<div style="${panelCss};text-align:center">
      <div style="font-size:15px;color:#e88;padding:20px 0">${escapeHtml(m)}</div>
      <div style="display:flex;gap:8px">
        <button id="lb-retry" style="flex:1;padding:11px;border:0;border-radius:8px;background:#2f8fe0;color:#fff;font-weight:700;cursor:pointer">다시 시도</button>
        <button id="lb-x" style="flex:1;padding:11px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#cdd6df;cursor:pointer">닫기</button>
      </div></div>`;
    (this.root.querySelector('#lb-retry') as HTMLButtonElement).addEventListener('click', retry);
    (this.root.querySelector('#lb-x') as HTMLButtonElement).addEventListener('click', () =>
      this.close(),
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
