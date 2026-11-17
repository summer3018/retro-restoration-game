import { describe, expect, it } from 'vitest';
import { RepairSession } from '../src/game/session';
import { STAGES } from '../src/game/stages';
import { FinalTask, FitTask, PolishTask, ScrubMask, type RepairStep } from '../src/game/tasks';

/**
 * 「進行不能にならないか」を機械的に確かめるテスト。
 * 画面を使わずに、各工程を仕様どおりに操作して最後まで到達できるかを見る。
 */
function playStep(step: RepairStep): void {
  if (step instanceof ScrubMask) {
    for (let pass = 0; pass < 6 && !step.isDone; pass++) {
      for (let r = 0; r < step.rows; r++) {
        for (let c = 0; c < step.cols; c++) {
          if (!step.isActive(c, r)) continue;
          const p = step.cellCenter(c, r);
          step.brush(p.x, p.y, 14, 0.5);
        }
      }
    }
    return;
  }
  if (step instanceof PolishTask) {
    for (let i = 0; i < 400 && !step.isDone; i++) {
      for (const s of step.spots) {
        step.rub(s.x - s.r * 0.6, s.y, s.x + s.r * 0.6, s.y);
        step.rub(s.x + s.r * 0.6, s.y, s.x - s.r * 0.6, s.y);
      }
    }
    return;
  }
  if (step instanceof FitTask) {
    for (const p of step.parts) {
      const grabbed = step.grabAt(p.trayX, p.trayY);
      expect(grabbed, `トレイの部品 ${p.id} をつかめない`).not.toBeNull();
      step.drag(p, p.targetX, p.targetY);
      expect(step.drop(p), `部品 ${p.id} が取り付けられない`).toBe('placed');
    }
    return;
  }
  if (step instanceof FinalTask) {
    expect(step.tap(step.x, step.y)).toBe(true);
    return;
  }
  throw new Error('未知の工程');
}

describe('3ステージの通しプレイ', () => {
  for (const stage of STAGES) {
    describe(stage.def.title, () => {
      it('工程が仕様どおり（汚れ落とし→…→最終動作）', () => {
        const steps = stage.build();
        expect(steps.length).toBeGreaterThanOrEqual(4);
        expect(steps[0].kind).toBe('wipe');
        expect(steps[steps.length - 1].kind).toBe('final');
        // 工程IDの重複がないこと（絵の取り違えを防ぐ）
        const ids = steps.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        // どの工程にも操作の案内がある
        for (const s of steps) {
          expect(s.title.length).toBeGreaterThan(0);
          expect(s.hint.length).toBeGreaterThan(0);
        }
      });

      it('最後までクリアできる（進行不能にならない）', () => {
        const steps = stage.build();
        const session = new RepairSession(steps, 0);
        let guard = 0;
        while (!session.isComplete && guard++ < 20) {
          const step = session.current;
          expect(step).not.toBeNull();
          playStep(step as RepairStep);
          session.update(guard);
        }
        expect(session.isComplete).toBe(true);
        expect(session.overallProgress).toBe(1);
      });

      it('作り直すと前回の状態を持ち越さない（再プレイできる）', () => {
        const first = stage.build();
        for (const s of first) playStep(s);
        const second = stage.build();
        expect(second.every((s) => !s.isDone)).toBe(true);
      });

      it('部品の取り付け先が品物の表示範囲に収まっている', () => {
        for (const step of stage.build()) {
          if (!(step instanceof FitTask)) continue;
          for (const p of step.parts) {
            expect(p.targetX).toBeGreaterThan(0);
            expect(p.targetX).toBeLessThan(360);
            expect(p.targetY).toBeGreaterThan(40);
            expect(p.targetY).toBeLessThan(440);
            // トレイは画面下
            expect(p.trayY).toBeGreaterThan(448);
            expect(p.trayY).toBeLessThan(548);
            // 指で押しやすい大きさ（直径 60 以上）
            expect(p.hitRadius).toBeGreaterThanOrEqual(30);
          }
        }
      });
    });
  }

  it('ステージは3つで、IDが重複していない', () => {
    expect(STAGES.length).toBe(3);
    const ids = STAGES.map((s) => s.def.id);
    expect(new Set(ids).size).toBe(3);
  });
});
