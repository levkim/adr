import { CONFIG } from '../config';

// 개인정보 수집·이용 동의 (대회 참가 시). 동의 여부는 localStorage에 기억한다.
// 이메일 로그인·참가자 정보 입력 두 곳에서 공통으로 쓴다.

const KEY = 'tournski_privacy_consent';

export function consentGiven(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setConsent(v: boolean): void {
  try {
    if (v) localStorage.setItem(KEY, 'true');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** 동의 안내(접이식) + 필수 체크박스 HTML. checkboxId로 이후 이벤트 연결 */
export function consentBlockHtml(checkboxId: string): string {
  const p = CONFIG.competition.privacy;
  const checked = consentGiven() ? 'checked' : '';
  return `
    <div style="margin-top:2px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12)">
      <details style="font-size:11px;opacity:0.8">
        <summary style="cursor:pointer;list-style:none">개인정보 수집·이용 안내 (필수) ▾</summary>
        <div style="margin-top:6px;line-height:1.7">
          · 수집 항목: ${p.items}<br>
          · 이용 목적: ${p.purpose}<br>
          · 보유·이용 기간: ${p.retention}<br>
          · 처리자: ${p.controller}<br>
          · 동의를 거부할 수 있으나, 거부 시 순위 등록·경품 응모가 제한됩니다.
        </div>
      </details>
      <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="${checkboxId}" ${checked} style="width:16px;height:16px;flex:none" />
        <span>[필수] 개인정보 수집·이용에 동의합니다</span>
      </label>
    </div>`;
}
