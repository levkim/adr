import type { Terrain } from '../world/terrain';
import { renderHillshade, worldToMapPx } from './terrainMap';

// 주행 중 좌측 미니 지형도: 내 위치·방향, 베이스(피니시) 지점,
// 그쪽으로 가는 가이드라인 + 남은 거리. M 키로 토글.

const SIZE = 190;

export class Minimap {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly distEl: HTMLDivElement;
  private readonly bg: HTMLCanvasElement; // 캐시된 힐셰이드
  private readonly start: { x: number; z: number };
  private readonly finish: { x: number; z: number };
  private redrawTimer = 0;

  constructor(
    private readonly terrain: Terrain,
    start: { x: number; z: number },
    finish: { x: number; z: number },
  ) {
    this.start = start;
    this.finish = finish;
    this.bg = renderHillshade(terrain, SIZE);

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'left:16px',
      'top:61px',
      'z-index:6',
      'user-select:none',
      'pointer-events:none',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.cssText =
      'border-radius:8px;box-shadow:0 3px 14px rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.18)';
    const c = this.canvas.getContext('2d');
    if (!c) throw new Error('미니맵 2D 컨텍스트 실패');
    this.ctx = c;

    this.distEl = document.createElement('div');
    this.distEl.style.cssText =
      'margin-top:5px;font-size:12px;color:#eef3f8;text-shadow:0 1px 3px rgba(0,0,0,0.7);display:flex;align-items:center;gap:6px';

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.distEl);
    document.body.appendChild(this.root);
  }

  toggle(): void {
    this.root.style.display = this.root.style.display === 'none' ? 'block' : 'none';
  }

  update(dt: number, x: number, z: number, heading: number): void {
    this.redrawTimer += dt;
    if (this.redrawTimer < 0.07) return; // ~14fps 갱신으로 충분
    this.redrawTimer = 0;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.bg, 0, 0);

    const rider = worldToMapPx(this.terrain, x, z, SIZE);
    const sp = worldToMapPx(this.terrain, this.start.x, this.start.z, SIZE);
    const fp = worldToMapPx(this.terrain, this.finish.x, this.finish.z, SIZE);

    // 기준 라인 (출발→베이스, 옅게)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    line(ctx, sp.x, sp.y, fp.x, fp.y);

    // 가이드라인 (현재 위치→베이스, 밝게)
    ctx.strokeStyle = 'rgba(90,200,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    line(ctx, rider.x, rider.y, fp.x, fp.y);
    ctx.setLineDash([]);

    // 출발 마커(초록), 베이스 마커(파랑, 깃발)
    dot(ctx, sp.x, sp.y, 4, '#46c98b');
    baseFlag(ctx, fp.x, fp.y);

    // 라이더 (진행 방향 삼각형)
    drawRider(ctx, rider.x, rider.y, heading);

    // 북쪽 표시
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('N', SIZE - 12, 14);

    // 남은 거리
    const dist = Math.hypot(x - this.finish.x, z - this.finish.z);
    const txt = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    this.distEl.innerHTML = `<span style="color:#5ac8ff">▾</span> 베이스까지 <b>${txt}</b>`;
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

function baseFlag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // 깃대 + 깃발
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  line(ctx, x, y, x, y - 13);
  ctx.beginPath();
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x + 11, y - 10);
  ctx.lineTo(x, y - 7);
  ctx.closePath();
  ctx.fillStyle = '#3a9ae0';
  ctx.fill();
  dot(ctx, x, y, 3, '#3a9ae0');
}

function drawRider(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number): void {
  // 진행 방향: 월드 (sin h, cos h) → 맵 (right=+x, down=+z)
  const dx = Math.sin(heading);
  const dy = Math.cos(heading);
  const a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-4, 4.5);
  ctx.lineTo(-4, -4.5);
  ctx.closePath();
  ctx.fillStyle = '#ff5a3c';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();
}
