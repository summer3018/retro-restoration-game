import { expect } from 'vitest';
import { RepairSession } from '../src/game/session';
import type { StageModule } from '../src/game/stage';
import { FinalTask, FitTask, PolishTask, RotateTask, ScrubMask, type RepairStep } from '../src/game/tasks';

/**
 * 1工程を仕様どおりに操作して終わらせる（画面なし）。
 * 「進行不能にならないか」を機械的に確かめるために使う。
 */
export function playStep(step: RepairStep): void {
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
  if (step instanceof RotateTask) {
    // 中心から半径の6割の円周上を、指でなぞって回す
    const rr = step.hitRadius * 0.6;
    expect(step.begin(step.x + rr, step.y), `${step.label}に指を置けない`).toBe(true);
    for (let i = 1; i <= 400 && !step.isDone; i++) {
      const a = (i / 24) * Math.PI * 2;
      step.move(step.x + Math.cos(a) * rr, step.y + Math.sin(a) * rr);
    }
    step.end();
    return;
  }
  throw new Error('未知の工程');
}

/** ステージを最初から最後まで通す */
export function playThrough(stage: StageModule): RepairSession {
  const steps = stage.build();
  const session = new RepairSession(steps, 0);
  let guard = 0;
  while (!session.isComplete && guard++ < 20) {
    const step = session.current;
    expect(step).not.toBeNull();
    playStep(step as RepairStep);
    session.update(guard);
  }
  return session;
}
