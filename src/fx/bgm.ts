import { CONFIG } from '../config';

// 배경 음악(BGM). 두 가지 소스를 자동 선택한다:
//  1) public/audio/bgm.mp3 가 있으면 그 트랙을 루프 재생 (로열티 프리 음원을 직접 넣는 슬롯)
//  2) 없으면(404/디코드 실패) WebAudio로 절차적 앰비언트 음악을 합성 — 외부 에셋·저작권 0
// 브라우저 자동재생 정책상 첫 입력 제스처에서 AudioContext를 초기화·재생한다.

const FILE_URL = `${import.meta.env.BASE_URL}audio/bgm.mp3`;

// A 단조 진행 (글라이드로 부드럽게 전환). MIDI 노트 → 코드별 3음.
const CHORDS: number[][] = [
  [45, 48, 52], // Am  (A2 C3 E3)
  [41, 45, 48], // F   (F2 A2 C3)
  [48, 52, 55], // C   (C3 E3 G3)
  [43, 47, 50], // G   (G2 B2 D3)
];
const CHORD_SECONDS = 7; // 코드 한 번 유지 시간
// 아르페지오용 A 단5음계 (어떤 코드 위에서도 협화) — 한 옥타브 위
const ARP_MIDI = [69, 72, 74, 76, 79, 81];
const ARP_STEP = 0.5; // s, 한 음 간격 (느릿하게)

const midiToFreq = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export class BackgroundMusic {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private started = false;

  // 절차 합성용
  private padOscs: OscillatorNode[] = [];
  private chordIndex = 0;
  private arpGain!: GainNode;
  private nextArpTime = 0;
  private arpStep = 0;

  constructor() {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return;
    const start = (): void => {
      if (!this.started) void this.begin();
      void this.ctx?.resume();
    };
    window.addEventListener('keydown', start, { once: true });
    window.addEventListener('pointerdown', start, { once: true });
  }

  private async begin(): Promise<void> {
    this.started = true;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.targetGain();
    this.master.connect(ctx.destination);

    const buffer = await this.tryLoadFile(ctx);
    if (buffer) this.playFile(ctx, buffer);
    else this.playProcedural(ctx);
  }

  /** public/audio/bgm.mp3 로드 시도 — 없거나 디코드 실패면 null */
  private async tryLoadFile(ctx: AudioContext): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(FILE_URL);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      return await ctx.decodeAudioData(data);
    } catch {
      return null;
    }
  }

  // ── 파일 모드: 트랙 루프 ─────────────────────────────────
  private playFile(ctx: AudioContext, buffer: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.master);
    src.start();
  }

  // ── 합성 모드: 패드 + 아르페지오 앰비언트 ────────────────
  private playProcedural(ctx: AudioContext): void {
    // 패드: 디튠 톱니 3음을 로우패스로 부드럽게, 게인 살짝 낮춰 깔아줌
    const padGain = ctx.createGain();
    padGain.gain.value = 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    filter.connect(padGain).connect(this.master);

    // 필터 컷오프를 아주 느린 LFO로 흔들어 숨쉬는 듯한 질감
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoDepth.gain.value = 300;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();

    const chord = CHORDS[0];
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToFreq(chord[i]);
      osc.detune.value = (i - 1) * 6; // 살짝 디튠
      osc.connect(filter);
      osc.start();
      this.padOscs.push(osc);
    }
    // 루트 한 옥타브 아래 사인 서브로 두께 추가
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = midiToFreq(chord[0] - 12);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    sub.connect(subGain).connect(this.master);
    sub.start();
    this.padOscs.push(sub);

    // 코드 진행: 일정 간격으로 패드 주파수를 다음 코드로 글라이드
    window.setInterval(() => this.advanceChord(), CHORD_SECONDS * 1000);

    // 아르페지오: 룩어헤드 스케줄러로 협화 음 하나씩
    this.arpGain = ctx.createGain();
    this.arpGain.gain.value = 0.18;
    this.arpGain.connect(this.master);
    this.nextArpTime = ctx.currentTime + 0.2;
    window.setInterval(() => this.scheduleArp(), 60);
  }

  private advanceChord(): void {
    if (!this.ctx) return;
    this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
    const chord = CHORDS[this.chordIndex];
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.padOscs[i]?.frequency.setTargetAtTime(midiToFreq(chord[i]), t, 1.2);
    }
    this.padOscs[3]?.frequency.setTargetAtTime(midiToFreq(chord[0] - 12), t, 1.2);
  }

  private scheduleArp(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    while (this.nextArpTime < ctx.currentTime + 0.3) {
      // 패턴이 단조롭지 않게 위/아래로 오가며 가끔 건너뜀
      const m = ARP_MIDI[this.arpStep % ARP_MIDI.length];
      this.arpStep++;
      if (this.arpStep % 4 !== 3) this.playArpNote(ctx, midiToFreq(m), this.nextArpTime);
      this.nextArpTime += ARP_STEP;
    }
  }

  private playArpNote(ctx: AudioContext, freq: number, when: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(1, when + 0.03); // 부드러운 어택
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.8); // 잔향처럼 감쇠
    osc.connect(env).connect(this.arpGain);
    osc.start(when);
    osc.stop(when + 0.85);
  }

  // ── 외부 제어 ────────────────────────────────────────────
  private targetGain(): number {
    return CONFIG.fx.music.enabled ? CONFIG.fx.music.volume : 0;
  }

  /** 볼륨/온오프 변경을 반영 (GUI·버튼에서 호출) */
  apply(): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.1);
  }

  /** 음소거 토글 → 새 enabled 값 반환 */
  toggle(): boolean {
    CONFIG.fx.music.enabled = !CONFIG.fx.music.enabled;
    this.apply();
    return CONFIG.fx.music.enabled;
  }
}
