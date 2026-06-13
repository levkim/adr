import type { Terrain } from '../world/terrain';
import type { Run, ScoreCard } from '../scoring/run';
import { renderHillshade, worldToMapPx } from './terrainMap';

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
      'align-items:center',
      'justify-content:center',
      'gap:28px',
      'flex-wrap:wrap',
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

  show(card: ScoreCard, run: Run, terrain: Terrain): void {
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
    card$.innerHTML = `
      <div style="font-size:13px;letter-spacing:2px;opacity:0.7">저지 스코어</div>
      <div style="display:flex;align-items:baseline;gap:12px;margin:2px 0 16px">
        <div style="font-size:58px;font-weight:800;line-height:1">${card.overall.toFixed(1)}</div>
        <div style="font-size:22px;font-weight:700;color:${grade.color}">${grade.label}</div>
      </div>
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
      <button id="retry-btn" style="width:100%;margin-top:20px;padding:12px;border:0;border-radius:8px;background:#3a9ae0;color:#fff;font-size:15px;font-weight:700;cursor:pointer">다시 하기 (R)</button>
      <button id="home-btn" style="width:100%;margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#cdd6df;font-size:13px;cursor:pointer">장소·캐릭터 변경</button>
    `;

    this.root.appendChild(left);
    this.root.appendChild(card$);
    this.root.style.display = 'flex';

    (card$.querySelector('#retry-btn') as HTMLButtonElement).addEventListener('click', () =>
      this.onRetry(),
    );
    const homeBtn = card$.querySelector('#home-btn') as HTMLButtonElement;
    if (this.onHome) homeBtn.addEventListener('click', () => this.onHome!());
    else homeBtn.style.display = 'none';
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
