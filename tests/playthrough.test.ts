import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/game/stages';
import { RepairSession } from '../src/game/session';
import { FitTask, RotateTask, type RepairStep } from '../src/game/tasks';
import { applyToolEffects, toolEffects } from '../src/game/tools';
import { playStep, playThrough } from './playStep';

/**
 * 「進行不能にならないか」を機械的に確かめるテスト。
 * 画面を使わずに、各工程を仕様どおりに操作して最後まで到達できるかを見る。
 */
describe('全ステージの通しプレイ', () => {
  for (const stage of STAGES) {
    describe(stage.def.title, () => {
      it('工程が仕様どおり（汚れ落とし→…→最終動作）', () => {
        const steps = stage.build();
        expect(steps.length).toBeGreaterThanOrEqual(4);
        expect(steps[0].kind).toBe('wipe');
        // 最後は「動いた！」になる操作（タップ、または回す）
        expect(['final', 'rotate']).toContain(steps[steps.length - 1].kind);
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
        const session = playThrough(stage);
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

      it('道具を全部いちばん良くしても、最後までクリアできる（進み具合は1を超えない）', () => {
        const steps = stage.build();
        applyToolEffects(steps, toolEffects({ cloth: 3, polish: 3, tweezers: 3 }));
        const session = new RepairSession(steps, 0);
        let guard = 0;
        while (!session.isComplete && guard++ < 20) {
          playStep(session.current as RepairStep);
          for (const s of steps) expect(s.progress).toBeLessThanOrEqual(1);
          session.update(guard);
        }
        expect(session.isComplete).toBe(true);
        expect(session.overallProgress).toBe(1);
      });

      it('回す工程は、指を置ける範囲が十分に大きい', () => {
        for (const step of stage.build()) {
          if (!(step instanceof RotateTask)) continue;
          expect(step.hitRadius).toBeGreaterThanOrEqual(50);
          expect(step.y - step.hitRadius).toBeGreaterThan(40);
          expect(step.y + step.hitRadius).toBeLessThan(448);
        }
      });
    });
  }

  it('ステージは7つで、IDと並び順が重複していない', () => {
    expect(STAGES.length).toBe(7);
    const ids = STAGES.map((s) => s.def.id);
    expect(new Set(ids).size).toBe(7);
    const orders = STAGES.map((s) => s.def.order);
    expect(new Set(orders).size).toBe(7);
  });
});
