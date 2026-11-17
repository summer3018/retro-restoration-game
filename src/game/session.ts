import type { RepairStep } from './tasks';

/**
 * 1ステージぶんの修復の進行役。
 * 「今どの工程か」「全体でどこまで進んだか」「終わったか」だけを持つ。
 * 時間の取得は外から渡して、テストできるようにする。
 */
export class RepairSession {
  readonly steps: RepairStep[];
  private index = 0;
  private startedAt: number;
  private finishedAt: number | null = null;
  /** 工程が切り替わった瞬間を知りたいとき用 */
  private lastReportedIndex = -1;

  constructor(steps: RepairStep[], now: number) {
    if (steps.length === 0) throw new Error('工程が空です');
    this.steps = steps;
    this.startedAt = now;
  }

  get current(): RepairStep | null {
    return this.index < this.steps.length ? this.steps[this.index] : null;
  }

  get currentIndex(): number {
    return this.index;
  }

  get isComplete(): boolean {
    return this.index >= this.steps.length;
  }

  /** 全工程を通した進み具合 0..1 */
  get overallProgress(): number {
    let sum = 0;
    for (let i = 0; i < this.steps.length; i++) {
      sum += i < this.index ? 1 : this.steps[i].progress;
    }
    return Math.min(1, sum / this.steps.length);
  }

  /**
   * 現在の工程が終わっていれば次へ進める。
   * @returns 進んだ工程数（0 または 1 以上）
   */
  update(now: number): number {
    let advanced = 0;
    while (this.index < this.steps.length && this.steps[this.index].isDone) {
      this.index++;
      advanced++;
    }
    if (this.isComplete && this.finishedAt === null) {
      this.finishedAt = now;
    }
    return advanced;
  }

  /** 工程が切り替わったら true（演出・効果音のトリガ用） */
  consumeStepChanged(): boolean {
    if (this.lastReportedIndex !== this.index) {
      this.lastReportedIndex = this.index;
      return true;
    }
    return false;
  }

  elapsedMs(now: number): number {
    return Math.max(0, (this.finishedAt ?? now) - this.startedAt);
  }

  get clearedMs(): number | null {
    return this.finishedAt === null ? null : this.finishedAt - this.startedAt;
  }
}
