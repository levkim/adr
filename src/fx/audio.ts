import { CONFIG } from '../config';
import type { CameraModeId } from '../camera/cameraSystem';

// 절차 생성 사운드 (WebAudio, 외부 에셋 없음).
// 바람/슬러시/카빙 = 필터링된 노이즈 + 상태 연동 게인, 착지 = 노이즈 버스트,
// 1인칭 호흡 = LFO 변조 노이즈. 브라우저 정책상 첫 입력 제스처에서 초기화.

const SMOOTH = 0.08; // s, 게인/필터 스무딩

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private slushGain!: GainNode;
  private carveGain!: GainNode;
  private impactGain!: GainNode;
  private breathGain!: GainNode;
  private enabled = true;

  constructor() {
    if (typeof window === 'undefined' || !('AudioContext' in window)) {
      this.enabled = false;
      return;
    }
    const start = () => {
      if (!this.ctx) this.init();
      void this.ctx?.resume();
    };
    window.addEventListener('keydown', start, { once: true });
    window.addEventListener('pointerdown', start, { once: true });
  }

  private init(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const noise = this.makeNoiseSource(ctx);

    // 바람: 밴드패스 노이즈, 속도에 따라 게인·중심주파수 상승
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 350;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(this.windFilter).connect(this.windGain).connect(this.master);

    // 파우더 슬러시: 저역 노이즈
    const slushFilter = ctx.createBiquadFilter();
    slushFilter.type = 'lowpass';
    slushFilter.frequency.value = 420;
    this.slushGain = ctx.createGain();
    this.slushGain.gain.value = 0;
    noise.connect(slushFilter).connect(this.slushGain).connect(this.master);

    // 에지 카빙: 고역 히스
    const carveFilter = ctx.createBiquadFilter();
    carveFilter.type = 'bandpass';
    carveFilter.frequency.value = 2600;
    carveFilter.Q.value = 1.2;
    this.carveGain = ctx.createGain();
    this.carveGain.gain.value = 0;
    noise.connect(carveFilter).connect(this.carveGain).connect(this.master);

    // 착지 임팩트: 저역 노이즈 버스트 (이벤트 시 엔벨로프)
    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'lowpass';
    impactFilter.frequency.value = 220;
    this.impactGain = ctx.createGain();
    this.impactGain.gain.value = 0;
    noise.connect(impactFilter).connect(this.impactGain).connect(this.master);

    // 호흡 (1인칭): 중역 노이즈를 느린 LFO로 변조
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 750;
    breathFilter.Q.value = 1.5;
    this.breathGain = ctx.createGain();
    this.breathGain.gain.value = 0;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.38; // 분당 ~23회 호흡
    lfo.connect(lfoDepth).connect(this.breathGain.gain);
    lfo.start();
    noise.connect(breathFilter).connect(this.breathGain).connect(this.master);
  }

  private makeNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  }

  update(
    speed: number,
    grounded: boolean,
    steer: number,
    sprayIntensity: number,
    mode: CameraModeId,
  ): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const a = CONFIG.fx.audio;
    const t = this.ctx.currentTime;
    const speedT = Math.min(1, speed / 30);

    this.master.gain.setTargetAtTime(a.master, t, SMOOTH);
    // 바람: 속도 제곱 비례 + 공중에서 더 크게
    const windBoost = grounded ? 1 : 1.35;
    this.windGain.gain.setTargetAtTime(speedT * speedT * a.wind * windBoost, t, SMOOTH);
    this.windFilter.frequency.setTargetAtTime(350 + speedT * 900, t, SMOOTH);
    // 슬러시: 접지 주행
    this.slushGain.gain.setTargetAtTime(
      grounded ? speedT * (0.35 + 0.65 * sprayIntensity) * a.slush * 0.5 : 0,
      t,
      SMOOTH,
    );
    // 카빙: 접지 + 조향
    this.carveGain.gain.setTargetAtTime(
      grounded ? Math.abs(steer) * speedT * a.carve * 0.4 : 0,
      t,
      SMOOTH,
    );
    // 호흡: 1인칭만
    this.breathGain.gain.setTargetAtTime(mode === 'first' ? a.breath * 0.25 : 0, t, 0.4);
  }

  /** 착지 임팩트 버스트 */
  impact(strength: number): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const peak = Math.min(1, strength / 10) * CONFIG.fx.audio.impact;
    this.impactGain.gain.cancelScheduledValues(t);
    this.impactGain.gain.setValueAtTime(peak, t);
    this.impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  }
}
