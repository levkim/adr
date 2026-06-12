import { CONFIG } from '../config';
import type { CameraModeId } from '../camera/cameraSystem';

// 스크린 스페이스 효과: 고글 스플래터(눈 튀어 붙음 → 녹아 흘러내림),
// 김서림, 화이트룸. 캔버스 2D + CSS 오버레이, 강도는 screenIntensity로 일괄 조절.

interface Blob {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  drift: number;
  alive: boolean;
}

export class ScreenFx {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly whiteroomEl: HTMLDivElement;
  private readonly blobs: Blob[];
  private spawnDebt = 0;
  private fog = 0;
  private whiteroom = 0;
  private anyBlobAlive = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:6;width:100%;height:100%';
    document.body.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트 생성 실패');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // 화이트룸: 화면 하단에서 차오르는 백색 베일 (CSS 그라데이션)
    this.whiteroomEl = document.createElement('div');
    this.whiteroomEl.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:4',
      'opacity:0',
      'background:linear-gradient(to top, rgba(244,248,252,0.95) 0%, rgba(244,248,252,0.55) 35%, rgba(244,248,252,0) 75%)',
    ].join(';');
    document.body.appendChild(this.whiteroomEl);

    this.blobs = Array.from({ length: CONFIG.fx.splatter.maxBlobs }, () => ({
      x: 0,
      y: 0,
      r: 0,
      age: 0,
      life: 1,
      drift: 0,
      alive: false,
    }));
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update(dt: number, speed: number, sprayIntensity: number, mode: CameraModeId): void {
    const master = CONFIG.fx.screenIntensity;
    const sp = CONFIG.fx.splatter;
    const wr = CONFIG.fx.whiteroom;

    // ── 화이트룸 강도 ──
    const speedT = Math.min(
      1,
      Math.max(0, (speed - wr.speedMin) / (wr.speedMax - wr.speedMin)),
    );
    const target = speedT * sprayIntensity * wr.modeFactor[mode];
    const rate = target > this.whiteroom ? wr.attack : wr.release;
    this.whiteroom += (target - this.whiteroom) * Math.min(1, rate * dt);
    this.whiteroomEl.style.opacity = String(this.whiteroom * wr.maxOpacity * master);

    // ── 스플래터/김서림은 1인칭 전용 ──
    const fp = mode === 'first';
    if (fp && master > 0) {
      // 스폰: 스프레이 강도 비례
      this.spawnDebt += sp.spawnRate * sprayIntensity * dt;
      while (this.spawnDebt >= 1) {
        this.spawnDebt -= 1;
        this.spawnBlob();
      }
      // 김서림 누적/감쇠
      this.fog = Math.min(1, this.fog + sprayIntensity * sp.fogGain * dt);
    }
    this.fog = Math.max(0, this.fog - sp.fogDecay * this.fog * dt);

    // ── 블롭 갱신/렌더 ──
    let any = false;
    for (const b of this.blobs) {
      if (!b.alive) continue;
      b.age += dt;
      if (b.age >= b.life || !fp) {
        b.alive = false;
        continue;
      }
      any = true;
    }
    if (any || this.anyBlobAlive || this.fog > 0.01) this.render(fp, master);
    this.anyBlobAlive = any;
  }

  private spawnBlob(): void {
    const sp = CONFIG.fx.splatter;
    const b = this.blobs.find((x) => !x.alive);
    if (!b) return;
    // 고글 렌즈 영역(중앙 타원) 안쪽 위주로
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random());
    b.x = this.canvas.width * (0.5 + Math.cos(ang) * 0.34 * rad);
    b.y = this.canvas.height * (0.48 + Math.sin(ang) * 0.3 * rad);
    b.r = sp.minR + Math.random() * (sp.maxR - sp.minR);
    b.age = 0;
    b.life = sp.life + (Math.random() - 0.5) * sp.lifeJitter;
    b.drift = 0.5 + Math.random();
    b.alive = true;
  }

  private render(fp: boolean, master: number): void {
    const sp = CONFIG.fx.splatter;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!fp || master <= 0) return;

    // 김서림: 가장자리에서 옅게 차오르는 화이트
    if (this.fog > 0.01) {
      const g = ctx.createRadialGradient(
        this.canvas.width / 2,
        this.canvas.height / 2,
        this.canvas.height * 0.25,
        this.canvas.width / 2,
        this.canvas.height / 2,
        this.canvas.height * 0.75,
      );
      const a = this.fog * sp.fogMaxOpacity * master;
      g.addColorStop(0, 'rgba(235,242,248,0)');
      g.addColorStop(1, `rgba(235,242,248,${a.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 스플래터 블롭: 붙은 뒤 녹으며(축소) 흘러내림(가속 하강)
    for (const b of this.blobs) {
      if (!b.alive) continue;
      const t = b.age / b.life;
      const melt = 1 - t * 0.75;
      const y = b.y + sp.slide * b.drift * b.age * b.age;
      const r = b.r * melt;
      const alpha = (1 - t) * 0.85 * master;
      const g = ctx.createRadialGradient(b.x, y, r * 0.15, b.x, y, r);
      g.addColorStop(0, `rgba(250,252,255,${(alpha * 0.95).toFixed(3)})`);
      g.addColorStop(0.7, `rgba(240,246,252,${(alpha * 0.55).toFixed(3)})`);
      g.addColorStop(1, 'rgba(240,246,252,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      // 흘러내린 자국: 세로로 살짝 늘어난 타원
      ctx.ellipse(b.x, y, r * 0.9, r * (1 + t * 0.8), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
