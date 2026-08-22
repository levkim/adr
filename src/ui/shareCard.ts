import { CONFIG } from '../config';
import type { ScoreCard, Run } from '../scoring/run';
import type { Terrain } from '../world/terrain';
import { renderHillshade, worldToMapPx } from './terrainMap';

// 대회 결과 공유 카드 (9:16 세로 PNG). canvas로 직접 그린다 — 외부 라이브러리 없음.
// 랭킹/이메일은 아직 백엔드가 없어 입력값으로 받고, 없으면 플레이스홀더로 렌더한다.
// 레이아웃/색/브랜드 값은 CONFIG.shareCard 로 조정 가능.

export interface ShareCardData {
  card: ScoreCard;
  run: Run; // 라인 궤적(trajectory) 소스
  terrain: Terrain; // 힐셰이드 미니맵 소스
  resortName: string; // 리조트명 (terrain.meta.name)
  nickname: string;
  email?: string;
  rank?: number; // 랭킹 M위 (없으면 플레이스홀더)
  total?: number; // 참가자 N명
}

const font = (px: number, weight = 400): string =>
  `${weight} ${px}px system-ui, -apple-system, sans-serif`;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 결과 카드를 canvas로 렌더 (이미지 로드 때문에 async) */
export async function renderShareCard(data: ShareCardData): Promise<HTMLCanvasElement> {
  const s = CONFIG.shareCard;
  const col = s.colors;
  const W = s.width;
  const H = s.height;
  const pad = s.pad;
  const cw = W - pad * 2; // 콘텐츠 폭

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── 배경: 아이스블루 그라데이션 + 하단 산 실루엣 ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, col.bgTop);
  bg.addColorStop(1, col.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  drawMountains(ctx, W, H, col.mountain);

  ctx.textBaseline = 'alphabetic';
  let y = pad + 20;

  // ── 헤더: 대회명 + 리조트명 ──
  ctx.textAlign = 'left';
  ctx.fillStyle = col.accent;
  ctx.font = font(s.titleSize, 800);
  ctx.fillText(s.competitionName, pad, y + s.titleSize);
  y += s.titleSize + 14;
  ctx.fillStyle = col.inkSoft;
  ctx.font = font(s.resortSize, 600);
  ctx.fillText(data.resortName, pad, y + s.resortSize);
  y += s.resortSize + 44;

  // ── 총점 (가장 크게) ──
  ctx.textAlign = 'left';
  ctx.fillStyle = col.inkSoft;
  ctx.font = font(s.labelSize, 700);
  ctx.fillText('총점 / SCORE', pad, y + s.labelSize);
  y += s.labelSize + 6;
  ctx.textAlign = 'center';
  ctx.fillStyle = col.ink;
  ctx.font = font(s.scoreSize, 800);
  ctx.fillText(data.card.overall.toFixed(1), W / 2, y + s.scoreSize * 0.82);
  // 등급 배지
  const grade = gradeOf(data.card.overall);
  ctx.fillStyle = grade.color;
  ctx.font = font(s.rankSize, 800);
  ctx.fillText(grade.label, W / 2, y + s.scoreSize + 4);
  y += s.scoreSize + s.rankSize;

  // ── FWT 4개 항목 바 ──
  const bars: [string, number][] = [
    ['라인 난이도', data.card.line],
    ['에어 & 스타일', data.card.air],
    ['유려함', data.card.fluidity],
    ['컨트롤', data.card.control],
  ];
  const barColors = [col.accent, '#3a9ae0', col.good, '#d67a3a'];
  ctx.textAlign = 'left';
  for (let i = 0; i < bars.length; i++) {
    const [label, val] = bars[i];
    ctx.fillStyle = col.ink;
    ctx.font = font(s.barLabelSize, 700);
    ctx.fillText(label, pad, y + s.barLabelSize);
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(val)), pad + cw, y + s.barLabelSize);
    ctx.textAlign = 'left';
    const by = y + s.barLabelSize + 10;
    roundRect(ctx, pad, by, cw, s.barHeight, s.barHeight / 2);
    ctx.fillStyle = 'rgba(14,40,65,0.10)';
    ctx.fill();
    roundRect(ctx, pad, by, cw * Math.max(0, Math.min(1, val / 100)), s.barHeight, s.barHeight / 2);
    ctx.fillStyle = barColors[i];
    ctx.fill();
    y += s.barLabelSize + 10 + s.barHeight + s.barGap;
  }
  y += 10;

  // ── 라인 궤적 미니맵 (실제 주행 경로) ──
  ctx.fillStyle = col.inkSoft;
  ctx.font = font(s.labelSize, 700);
  ctx.textAlign = 'left';
  ctx.fillText('MY LINE / 라인 궤적', pad, y + s.labelSize);
  y += s.labelSize + 14;
  const mm = s.minimapSize;
  const mmX = (W - mm) / 2;
  drawMinimap(ctx, data, mmX, y, mm, col);
  y += mm + 44;

  // ── 랭킹 ──
  ctx.textAlign = 'center';
  ctx.fillStyle = col.ink;
  ctx.font = font(s.rankSize, 800);
  const rankText =
    data.rank && data.total ? `${data.total}명 중 ${data.rank}위` : '랭킹 집계 예정';
  ctx.fillText(`🏅 ${rankText}`, W / 2, y + s.rankSize);
  y += s.rankSize + 30;

  // ── 닉네임 + 이메일 ──
  ctx.fillStyle = col.ink;
  ctx.font = font(s.nameSize, 800);
  ctx.fillText(data.nickname || 'RIDER', W / 2, y + s.nameSize);
  y += s.nameSize + 6;
  if (data.email) {
    ctx.fillStyle = col.inkSoft;
    ctx.font = font(s.footSize, 500);
    ctx.fillText(data.email, W / 2, y + s.footSize);
  }

  // ── 푸터: 인스타 핸들(좌) + QR 슬롯(우), 하단 고정 ──
  const qr = s.qrSize;
  const footY = H - pad - qr;
  const qrImg = s.qrImageUrl ? await loadImage(`${import.meta.env.BASE_URL}${s.qrImageUrl}`) : null;
  // QR 슬롯
  const qrX = W - pad - qr;
  roundRect(ctx, qrX, footY, qr, qr, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = col.panelLine;
  ctx.stroke();
  if (qrImg) {
    ctx.drawImage(qrImg, qrX + 8, footY + 8, qr - 16, qr - 16);
  } else {
    ctx.fillStyle = col.inkSoft;
    ctx.font = font(28, 700);
    ctx.textAlign = 'center';
    ctx.fillText('QR', qrX + qr / 2, footY + qr / 2 + 10);
  }
  // 인스타 핸들
  ctx.textAlign = 'left';
  ctx.fillStyle = col.ink;
  ctx.font = font(s.footSize, 700);
  ctx.fillText('📷 ' + s.instagram, pad, footY + qr / 2 - 8);
  ctx.fillStyle = col.inkSoft;
  ctx.font = font(s.footSize - 6, 500);
  ctx.fillText('완주 인증 공유하고 이벤트 참여!', pad, footY + qr / 2 + 34);

  return canvas;
}

// ── 미니맵: 힐셰이드 + 실제 궤적 ──
function drawMinimap(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  x: number,
  y: number,
  size: number,
  col: typeof CONFIG.shareCard.colors,
): void {
  ctx.save();
  roundRect(ctx, x, y, size, size, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = col.panelLine;
  ctx.stroke();
  ctx.clip();
  ctx.drawImage(renderHillshade(data.terrain, size), x, y);

  const traj = data.run.trajectory;
  if (traj.length > 1) {
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff5a3c';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    const p0 = worldToMapPx(data.terrain, traj[0].x, traj[0].y, size);
    ctx.moveTo(x + p0.x, y + p0.y);
    for (let i = 1; i < traj.length; i++) {
      const p = worldToMapPx(data.terrain, traj[i].x, traj[i].y, size);
      ctx.lineTo(x + p.x, y + p.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    dot(ctx, x + p0.x, y + p0.y, '#2f9e6f');
    const pn = worldToMapPx(data.terrain, traj[traj.length - 1].x, traj[traj.length - 1].y, size);
    dot(ctx, x + pn.x, y + pn.y, '#2f8fe0');
  }
  ctx.restore();
}

function drawMountains(ctx: CanvasRenderingContext2D, W: number, H: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.82);
  ctx.lineTo(W * 0.24, H * 0.72);
  ctx.lineTo(W * 0.46, H * 0.8);
  ctx.lineTo(W * 0.68, H * 0.69);
  ctx.lineTo(W, H * 0.79);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

function gradeOf(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'PODIUM', color: '#d9a406' };
  if (score >= 70) return { label: 'SOLID', color: '#2f9e6f' };
  if (score >= 50) return { label: 'OK', color: '#2f8fe0' };
  return { label: 'SKETCHY', color: '#d65a7a' };
}

// ── 공유 / 다운로드 ──
// 모바일 등 파일 공유 지원 시 Web Share API, 아니면 PNG 다운로드로 폴백.
export async function shareOrDownloadCard(
  canvas: HTMLCanvasElement,
  filename: string,
  shareText: string,
): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('PNG 생성 실패');
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareText, text: shareText });
      return 'shared';
    } catch (err) {
      // 사용자가 취소하면 그대로 종료(다운로드로 강제하지 않음)
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      // 그 외 오류는 다운로드로 폴백
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
