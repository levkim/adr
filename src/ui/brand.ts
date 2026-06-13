// tournski 브랜드 로고를 캔버스로 재현 (외부 에셋 없음).
// 시작 화면 푸터 <img> 와 3D 깃발 텍스처가 동일 소스를 공유한다.
// 투톤 블루 워드마크 + 활강 스키어 + 눈송이.

const LIGHT = '#5fb0e6';
const DARK = '#2f6fb0';

export function tournskiLogoCanvas(W = 600, H = 180, bg?: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.clearRect(0, 0, W, H);
  if (bg) {
    // 깃발 천: 둥근 모서리 배경
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  const fontPx = Math.round(H * 0.62);
  ctx.font = `800 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const baseY = H * 0.74;
  const t1 = 'tourn';
  const t2 = 'ski';
  const w1 = ctx.measureText(t1).width;
  const w2 = ctx.measureText(t2).width;
  const sfGap = fontPx * 0.18;
  const sfR = fontPx * 0.28;
  const total = w1 + w2 + sfGap + sfR * 2;
  let x = (W - total) / 2;

  ctx.fillStyle = LIGHT;
  ctx.fillText(t1, x, baseY);
  ctx.fillStyle = DARK;
  ctx.fillText(t2, x + w1, baseY);

  // 눈송이 (워드마크 오른쪽 위)
  drawSnowflake(ctx, x + w1 + w2 + sfGap + sfR, baseY - fontPx * 0.62, sfR, LIGHT);

  // 활강 스키어 ('n' 위)
  drawSkier(ctx, x + w1 - fontPx * 0.42, baseY - fontPx * 1.02, fontPx * 0.5, DARK);

  return c;
}

/** 푸터용 <img> (canvas data URL) */
export function tournskiLogoImg(heightPx: number): HTMLImageElement {
  const canvas = tournskiLogoCanvas();
  const img = document.createElement('img');
  img.src = canvas.toDataURL();
  img.style.height = `${heightPx}px`;
  img.alt = 'tournski';
  return img;
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    // 가지
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.26, -r * 0.78);
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(-r * 0.26, -r * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkier(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 머리
  ctx.beginPath();
  ctx.arc(s * 0.18, -s * 0.6, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // 몸통(앞으로 숙인) + 다리
  ctx.beginPath();
  ctx.moveTo(s * 0.16, -s * 0.5);
  ctx.lineTo(-s * 0.05, -s * 0.15); // 등
  ctx.lineTo(s * 0.2, -s * 0.05); // 허벅지
  ctx.lineTo(s * 0.42, s * 0.08); // 정강이
  ctx.stroke();
  // 팔 + 폴
  ctx.beginPath();
  ctx.moveTo(s * 0.02, -s * 0.32);
  ctx.lineTo(s * 0.32, -s * 0.28);
  ctx.stroke();
  // 스키 (활강 라인)
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.16);
  ctx.lineTo(s * 0.78, s * 0.0);
  ctx.stroke();
  ctx.restore();
}
