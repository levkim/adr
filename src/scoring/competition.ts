import { CONFIG } from '../config';
import type { ScoreCard } from './run';

// 대회 모드 세션: 시도 횟수 제한 + 최고 점수 보관. (랭킹/로그인은 아직 없음 — 로컬만)
// 시도 횟수와 최고 점수를 코스별로 localStorage에 보관해 새로고침에도 유지한다.
// 자유 연습과 완전히 분리 — 자유 연습은 이 세션을 만들지 않는다.

interface CompState {
  attemptsUsed: number;
  best: ScoreCard | null;
}

export class CompetitionSession {
  readonly locationId: string;
  readonly maxAttempts: number;
  private attemptsUsed = 0;
  private best: ScoreCard | null = null;

  constructor(
    locationId: string = CONFIG.competition.locationId,
    maxAttempts: number = CONFIG.competition.maxAttempts,
  ) {
    this.locationId = locationId;
    this.maxAttempts = maxAttempts;
    this.load();
  }

  get used(): number {
    return this.attemptsUsed;
  }
  get bestCard(): ScoreCard | null {
    return this.best;
  }
  attemptsLeft(): number {
    return Math.max(0, this.maxAttempts - this.attemptsUsed);
  }
  canAttempt(): boolean {
    return this.attemptsUsed < this.maxAttempts;
  }

  /** 런 종료 점수 기록 → 시도 1 소진, 최고 갱신 여부 반환 */
  recordAttempt(card: ScoreCard): { isBest: boolean; attemptNo: number } {
    this.attemptsUsed += 1;
    const isBest = !this.best || card.overall > this.best.overall;
    if (isBest) this.best = card;
    this.save();
    return { isBest, attemptNo: this.attemptsUsed };
  }

  /** 시도 횟수·최고 점수 초기화 (재도전용) */
  reset(): void {
    this.attemptsUsed = 0;
    this.best = null;
    try {
      localStorage.removeItem(this.key());
    } catch {
      /* ignore */
    }
  }

  private key(): string {
    return `tournski_comp_${this.locationId}`;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.key());
      if (!raw) return;
      const s = JSON.parse(raw) as CompState;
      this.attemptsUsed = typeof s.attemptsUsed === 'number' ? s.attemptsUsed : 0;
      this.best = s.best ?? null;
    } catch {
      /* 형식 오류/없음 → 새 세션 */
    }
  }

  private save(): void {
    try {
      const s: CompState = { attemptsUsed: this.attemptsUsed, best: this.best };
      localStorage.setItem(this.key(), JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }
}
