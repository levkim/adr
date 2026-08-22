import type { CompetitionSession } from '../scoring/competition';
import { LOCATIONS } from '../world/locations';

// 대회 규칙 안내 모달: 대회 시작 전 1회 노출. 규칙 + 현재 시도 현황/최고 점수 + 시작/초기화.
// 자유 연습에는 나타나지 않는다.

type Lang = 'ko' | 'en';

function detectLang(): Lang {
  try {
    const s = localStorage.getItem('tournski_lang');
    if (s === 'ko' || s === 'en') return s;
  } catch {
    /* ignore */
  }
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export class CompetitionRules {
  /** 규칙 안내를 띄우고 '시작'을 누르면 resolve */
  show(session: CompetitionSession): Promise<void> {
    const lang = detectLang();
    return new Promise((resolve) => {
      const root = document.createElement('div');
      root.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:40',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:20px',
        'box-sizing:border-box',
        'background:rgba(8,12,18,0.82)',
        'backdrop-filter:blur(4px)',
        'font-family:system-ui,-apple-system,sans-serif',
        'color:#eef3f8',
      ].join(';');

      const loc = LOCATIONS[session.locationId];
      const courseName = loc ? (lang === 'en' ? loc.nameEn : loc.name) : session.locationId;

      const render = (): void => {
        const best = session.bestCard;
        const bestStr = best ? `${best.overall.toFixed(1)}` : (lang === 'en' ? 'none' : '없음');
        const t =
          lang === 'en'
            ? {
                title: '🏆 Competition',
                course: 'Course',
                rules: [
                  `Fixed course — <b>${courseName}</b>.`,
                  `Up to <b>${session.maxAttempts} attempts</b>. Only your <b>best single score</b> is kept.`,
                  'Scored on line difficulty · air & style · fluidity · control (crashes lose points).',
                ],
                status: `Attempts ${session.used}/${session.maxAttempts} · Best ${bestStr}`,
                start: 'START ▸',
                reset: 'Reset record',
                done: 'All attempts used — Reset to try again.',
              }
            : {
                title: '🏆 대회 참가',
                course: '코스',
                rules: [
                  `코스 고정 — <b>${courseName}</b>.`,
                  `최대 <b>${session.maxAttempts}회</b> 도전. 그중 <b>최고 점수 1개</b>만 기록됩니다.`,
                  '채점: 라인 난이도 · 에어 & 스타일 · 유려함 · 컨트롤 (낙상 시 감점).',
                ],
                status: `시도 ${session.used}/${session.maxAttempts} · 최고 ${bestStr}`,
                start: '시작 ▸',
                reset: '기록 초기화',
                done: '시도를 모두 사용했습니다 — 초기화 후 다시 도전할 수 있어요.',
              };

        const exhausted = !session.canAttempt();
        root.innerHTML = `
          <div style="max-width:440px;width:100%;background:rgba(18,22,28,0.96);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:26px 28px">
            <div style="font-size:22px;font-weight:800;margin-bottom:16px">${t.title}</div>
            <ul style="margin:0 0 18px;padding-left:18px;line-height:1.7;font-size:14px;opacity:0.92">
              ${t.rules.map((r) => `<li>${r}</li>`).join('')}
            </ul>
            <div style="font-size:13px;opacity:0.85;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.06);margin-bottom:${exhausted ? '10' : '20'}px">${t.status}</div>
            ${exhausted ? `<div style="font-size:13px;color:#e0a52f;margin-bottom:16px">${t.done}</div>` : ''}
            <button id="cr-start" ${exhausted ? 'disabled' : ''} style="width:100%;padding:14px;border:0;border-radius:9px;background:${exhausted ? 'rgba(255,255,255,0.12)' : '#e0a52f'};color:${exhausted ? '#8a939c' : '#1a1204'};font-size:16px;font-weight:800;cursor:${exhausted ? 'default' : 'pointer'}">${t.start}</button>
            <button id="cr-reset" style="width:100%;margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,0.2);border-radius:9px;background:transparent;color:#cdd6df;font-size:13px;cursor:pointer">${t.reset}</button>
          </div>`;

        const startBtn = root.querySelector('#cr-start') as HTMLButtonElement;
        if (!exhausted) {
          startBtn.addEventListener('click', () => {
            root.remove();
            resolve();
          });
        }
        (root.querySelector('#cr-reset') as HTMLButtonElement).addEventListener('click', () => {
          session.reset();
          render();
        });
      };

      render();
      document.body.appendChild(root);
    });
  }
}
