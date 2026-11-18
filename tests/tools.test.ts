import { describe, expect, it } from 'vitest';
import {
  applyToolEffects,
  defaultToolLevels,
  nextGoal,
  rewardFor,
  toolEffects,
  upgradeCost,
  tapGate,
} from '../src/game/tools';
import { FitTask, PolishTask } from '../src/game/tasks';

const all = (n: number) => ({ cloth: n, polish: n, tweezers: n });

describe('お礼', () => {
  it('初クリアは300円、再クリアは120円', () => {
    expect(rewardFor(true)).toBe(300);
    expect(rewardFor(false)).toBe(120);
  });
});

describe('道具の値段', () => {
  it('Lv2は250円、Lv3は600円、最高からは買えない', () => {
    expect(upgradeCost(1)).toBe(250);
    expect(upgradeCost(2)).toBe(600);
    expect(upgradeCost(3)).toBeNull();
  });

  it('最初は全部Lv1', () => {
    expect(defaultToolLevels()).toEqual(all(1));
  });
});

describe('道具の効果', () => {
  it('Lv1は効果なし', () => {
    expect(toolEffects(all(1))).toEqual({ brushScale: 1, strokeScale: 1, snapBonus: 0 });
  });

  it('レベルごとの効果', () => {
    expect(toolEffects({ cloth: 3, polish: 2, tweezers: 3 })).toEqual({
      brushScale: 1.6,
      strokeScale: 0.75,
      snapBonus: 24,
    });
    expect(toolEffects({ cloth: 2, polish: 3, tweezers: 2 })).toEqual({
      brushScale: 1.3,
      strokeScale: 0.5,
      snapBonus: 12,
    });
  });

  it('工程に当てると、磨きの距離が縮み、吸い付く範囲が広がる', () => {
    const polish = new PolishTask({ id: 'p', title: 't', hint: 'h', spots: [{ x: 0, y: 0, r: 10 }], strokeFactor: 8 });
    const fit = new FitTask({
      id: 'f',
      title: 't',
      hint: 'h',
      parts: [{ id: 'a', label: 'a', hitRadius: 30, trayX: 0, trayY: 0, targetX: 50, targetY: 50, snapRadius: 46 }],
    });
    applyToolEffects([polish, fit], toolEffects(all(3)));
    expect(polish.strokeFactor).toBe(4);
    expect(fit.parts[0].snapRadius).toBe(70);
  });
});

describe('次の目標', () => {
  it('何も持っていなければ、布のLv2が目標', () => {
    expect(nextGoal(0, all(1))).toEqual({ toolId: 'cloth', nextLevel: 2, cost: 250, short: 250 });
  });

  it('いちばん安いものを選び、買えるなら残りは0', () => {
    expect(nextGoal(300, { cloth: 2, polish: 1, tweezers: 1 })).toEqual({
      toolId: 'polish',
      nextLevel: 2,
      cost: 250,
      short: 0,
    });
  });

  it('全部最高なら目標なし', () => {
    expect(nextGoal(0, all(3))).toBeNull();
  });
});

describe('連打よけ（道具屋の買うボタン）', () => {
  it('開いた直後と、買った直後のしばらくは押しても通らない', () => {
    let t = 1000;
    const gate = tapGate(400, () => t);
    // 画面を開いた瞬間（別の画面のボタンを2回押した2回目がここに来る）
    expect(gate()).toBe(false);
    t += 399;
    expect(gate()).toBe(false);
    t += 1; // 開いてから400ms
    expect(gate()).toBe(true); // 1回目の購入
    t += 120; // すばやい2回目のタップ
    expect(gate()).toBe(false);
    t += 400;
    expect(gate()).toBe(true); // 間をあけた次の購入は通る
  });
});
