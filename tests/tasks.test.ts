import { describe, expect, it } from 'vitest';
import { FinalTask, FitTask, PolishTask, ScrubMask } from '../src/game/tasks';

describe('ScrubMask（汚れ落とし）', () => {
  const make = () =>
    new ScrubMask({
      id: 'd',
      title: '汚れ',
      hint: 'こする',
      rect: { x: 0, y: 0, w: 100, h: 100 },
      cols: 10,
      rows: 10,
      doneThreshold: 0.9,
    });

  it('最初は進み具合0で未完了', () => {
    const m = make();
    expect(m.progress).toBe(0);
    expect(m.isDone).toBe(false);
  });

  it('なぞった場所だけ汚れが減る', () => {
    const m = make();
    const before = m.valueAt(0, 0);
    m.brush(5, 5, 10, 0.5);
    expect(m.valueAt(0, 0)).toBeLessThan(before);
    expect(m.valueAt(9, 9)).toBe(1);
    expect(m.progress).toBeGreaterThan(0);
  });

  it('全体をこすれば完了する', () => {
    const m = make();
    for (let pass = 0; pass < 4 && !m.isDone; pass++) {
      for (let r = 0; r < m.rows; r++) {
        for (let c = 0; c < m.cols; c++) {
          const p = m.cellCenter(c, r);
          m.brush(p.x, p.y, 8, 0.6);
        }
      }
    }
    expect(m.isDone).toBe(true);
    expect(m.progress).toBe(1);
  });

  it('inside の外には汚れを置かない', () => {
    const m = new ScrubMask({
      id: 'd',
      title: 't',
      hint: 'h',
      rect: { x: 0, y: 0, w: 100, h: 100 },
      cols: 10,
      rows: 10,
      inside: (x) => x < 50,
    });
    expect(m.isActive(0, 0)).toBe(true);
    expect(m.isActive(9, 0)).toBe(false);
    expect(m.valueAt(9, 0)).toBe(0);
  });

  it('brushLine は高速ドラッグでも間を埋める', () => {
    const a = make();
    const b = make();
    a.brush(5, 50, 10, 0.6);
    a.brush(95, 50, 10, 0.6);
    b.brushLine(5, 50, 95, 50, 10, 0.6);
    expect(b.progress).toBeGreaterThan(a.progress);
  });

  it('clearAll で一気に完了にできる', () => {
    const m = make();
    m.clearAll();
    expect(m.isDone).toBe(true);
  });
});

describe('PolishTask（サビ磨き）', () => {
  const make = () =>
    new PolishTask({
      id: 'p',
      title: 'サビ',
      hint: '往復',
      spots: [
        { x: 50, y: 50, r: 10 },
        { x: 100, y: 50, r: 10 },
      ],
      strokeFactor: 8,
    });

  it('サビの外をこすっても進まない', () => {
    const t = make();
    const r = t.rub(0, 0, 10, 0);
    expect(r.hit).toBe(false);
    expect(t.progress).toBe(0);
  });

  it('サビの上をこすると進む', () => {
    const t = make();
    const r = t.rub(45, 50, 55, 50);
    expect(r.hit).toBe(true);
    expect(t.progress).toBeGreaterThan(0);
  });

  it('折り返しを検出してボーナスがつく', () => {
    const t = make();
    t.rub(45, 50, 55, 50);
    const back = t.rub(55, 50, 45, 50);
    expect(back.reversed).toBe(true);
    expect(t.reversalCount).toBe(1);
  });

  it('endStroke で方向の記憶が消える', () => {
    const t = make();
    t.rub(45, 50, 55, 50);
    t.endStroke();
    const back = t.rub(55, 50, 45, 50);
    expect(back.reversed).toBe(false);
  });

  it('往復し続ければ必ず完了する', () => {
    const t = make();
    for (let i = 0; i < 200 && !t.isDone; i++) {
      for (const s of t.spots) {
        t.rub(s.x - s.r, s.y, s.x + s.r, s.y);
        t.rub(s.x + s.r, s.y, s.x - s.r, s.y);
      }
    }
    expect(t.isDone).toBe(true);
  });

  it('進み具合が1を超えない', () => {
    const t = make();
    for (let i = 0; i < 500; i++) t.rub(40, 50, 60, 50);
    expect(t.progress).toBeLessThanOrEqual(1);
  });
});

describe('FitTask（部品の取り付け）', () => {
  const make = () =>
    new FitTask({
      id: 'f',
      title: '部品',
      hint: 'ドラッグ',
      parts: [
        { id: 'a', label: 'A', hitRadius: 30, trayX: 10, trayY: 200, targetX: 100, targetY: 100 },
        { id: 'b', label: 'B', hitRadius: 30, trayX: 60, trayY: 200, targetX: 200, targetY: 100 },
      ],
      defaultSnapRadius: 40,
    });

  it('トレイの位置から始まる', () => {
    const t = make();
    expect(t.parts[0].x).toBe(10);
    expect(t.parts[0].placed).toBe(false);
    expect(t.progress).toBe(0);
  });

  it('近い部品をつかめる / 離れていたらつかめない', () => {
    const t = make();
    expect(t.grabAt(12, 202)?.id).toBe('a');
    expect(t.grabAt(300, 300)).toBeNull();
  });

  it('重なっているときは近い方をつかむ', () => {
    const t = make();
    expect(t.grabAt(55, 200)?.id).toBe('b');
  });

  it('目標の近くで離すと吸い付いて設置される', () => {
    const t = make();
    const p = t.parts[0];
    t.drag(p, 110, 108);
    expect(t.drop(p)).toBe('placed');
    expect(p.x).toBe(100);
    expect(p.y).toBe(100);
    expect(t.isPlaced('a')).toBe(true);
    expect(t.progress).toBe(0.5);
  });

  it('遠い場所で離すとトレイに戻り、失敗の合図が出る', () => {
    const t = make();
    const p = t.parts[0];
    t.drag(p, 300, 300);
    expect(t.drop(p)).toBe('missed');
    expect(p.x).toBe(10);
    expect(p.placed).toBe(false);
    expect(p.shake).toBeGreaterThan(0);
  });

  it('設置済みの部品はつかめない', () => {
    const t = make();
    t.finishAll();
    expect(t.grabAt(100, 100)).toBeNull();
    expect(t.isDone).toBe(true);
  });
});

describe('FinalTask（最終動作）', () => {
  const make = () =>
    new FinalTask({ id: 'x', title: '電源', hint: 'タップ', x: 50, y: 50, hitRadius: 20, label: '電源' });

  it('範囲外のタップでは動かない', () => {
    const t = make();
    expect(t.tap(100, 100)).toBe(false);
    expect(t.isDone).toBe(false);
  });

  it('範囲内のタップで完了する', () => {
    const t = make();
    expect(t.tap(55, 52)).toBe(true);
    expect(t.isDone).toBe(true);
    expect(t.progress).toBe(1);
  });

  it('2回目のタップは無視される', () => {
    const t = make();
    t.tap(50, 50);
    expect(t.tap(50, 50)).toBe(false);
  });
});
