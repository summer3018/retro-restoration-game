import { describe, expect, it } from 'vitest';
import { Analytics } from '../src/core/analytics';
import { MemoryStore, SAVE_KEY, SaveStore } from '../src/core/storage';
import { computeTransform, toLogical, toScreen } from '../src/core/viewport';
import { RepairSession } from '../src/game/session';
import { FinalTask, ScrubMask } from '../src/game/tasks';

describe('SaveStore（進行状況の保存）', () => {
  it('最初は何も修復していない', () => {
    const s = new SaveStore(new MemoryStore());
    expect(s.clearedCount).toBe(0);
    expect(s.isCleared('radio')).toBe(false);
    expect(s.muted).toBe(false);
  });

  it('クリアを記録し、再読み込みしても残る', () => {
    const store = new MemoryStore();
    const a = new SaveStore(store);
    expect(a.recordClear('radio', 90_000, '2026-11-17T10:00:00.000Z')).toBe(true);

    const b = new SaveStore(store);
    expect(b.isCleared('radio')).toBe(true);
    expect(b.record('radio').bestMs).toBe(90_000);
    expect(b.record('radio').clearCount).toBe(1);
    expect(b.clearedCount).toBe(1);
  });

  it('2回目以降は初クリア扱いにならず、最短時間だけ更新される', () => {
    const s = new SaveStore(new MemoryStore());
    s.recordClear('radio', 90_000, '2026-11-17T10:00:00.000Z');
    expect(s.recordClear('radio', 120_000, '2026-11-17T11:00:00.000Z')).toBe(false);
    expect(s.record('radio').bestMs).toBe(90_000);
    s.recordClear('radio', 60_000, '2026-11-17T12:00:00.000Z');
    expect(s.record('radio').bestMs).toBe(60_000);
    expect(s.record('radio').clearCount).toBe(3);
    expect(s.record('radio').firstClearedAt).toBe('2026-11-17T10:00:00.000Z');
  });

  it('音量設定が保存される', () => {
    const store = new MemoryStore();
    new SaveStore(store).setMuted(true);
    expect(new SaveStore(store).muted).toBe(true);
  });

  it('保存データが壊れていても遊べる（初期状態に戻す）', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{壊れたJSON');
    const s = new SaveStore(store);
    expect(s.clearedCount).toBe(0);
  });
});

describe('Analytics（プレイ記録）', () => {
  const makeAnalytics = (store = new MemoryStore()) => {
    let t = 1_700_000_000_000;
    return {
      store,
      a: new Analytics({ store, now: () => (t += 1000), sessionId: 'sess-1' }),
    };
  };

  it('イベントを記録し、必要な項目がそろっている', () => {
    const { a } = makeAnalytics();
    const e = a.track('stage_start', { stageId: 'radio' });
    expect(e.event).toBe('stage_start');
    expect(e.stageId).toBe('radio');
    expect(e.sessionId).toBe('sess-1');
    expect(e.clientId).toMatch(/.+/);
    expect(new Date(e.ts).toString()).not.toBe('Invalid Date');
  });

  it('経過時間を記録できる', () => {
    const { a } = makeAnalytics();
    const e = a.track('stage_complete', { stageId: 'radio', elapsedMs: 95_000 });
    expect(e.elapsedMs).toBe(95_000);
  });

  it('リロードしても記録が残り、同じ匿名IDが使われる', () => {
    const store = new MemoryStore();
    const first = new Analytics({ store, sessionId: 's1' });
    first.track('game_start');
    const second = new Analytics({ store, sessionId: 's2' });
    expect(second.allEvents.length).toBe(1);
    expect(second.clientId).toBe(first.clientId);
  });

  it('game_start は1セッションにつき1回だけ', () => {
    const { a } = makeAnalytics();
    a.trackGameStartOnce();
    a.trackGameStartOnce();
    expect(a.allEvents.filter((e) => e.event === 'game_start').length).toBe(1);
  });

  it('アンケートを保存し、JSON出力に含まれる', () => {
    const { a } = makeAnalytics();
    a.track('stage_complete', { stageId: 'radio', elapsedMs: 1000 });
    a.saveSurvey({ stageId: 'radio', fun: 5, playAgain: true, wantMore: true, comment: 'たのしい' });
    const payload = a.exportPayload();
    expect(payload.surveys.length).toBe(1);
    expect(payload.surveys[0].fun).toBe(5);
    expect(payload.events.length).toBe(1);
    expect(payload.app).toBe('retro-restoration-game');
    // 個人情報は入らない
    expect(JSON.stringify(payload)).not.toMatch(/@|latitude|longitude/);
  });

  it('自由入力は500文字で切る', () => {
    const { a } = makeAnalytics();
    const s = a.saveSurvey({
      stageId: 'radio',
      fun: 3,
      playAgain: false,
      wantMore: true,
      comment: 'あ'.repeat(900),
    });
    expect(s.comment.length).toBe(500);
  });

  it('記録を消せる', () => {
    const { a } = makeAnalytics();
    a.track('game_start');
    a.clearAll();
    expect(a.allEvents.length).toBe(0);
  });
});

describe('RepairSession（工程の進行）', () => {
  const makeSteps = () => [
    new ScrubMask({ id: 'w', title: 'a', hint: 'a', rect: { x: 0, y: 0, w: 10, h: 10 }, cols: 2, rows: 2 }),
    new FinalTask({ id: 'f', title: 'b', hint: 'b', x: 0, y: 0, hitRadius: 5, label: 'b' }),
  ];

  it('最初の工程から始まる', () => {
    const s = new RepairSession(makeSteps(), 0);
    expect(s.currentIndex).toBe(0);
    expect(s.current?.id).toBe('w');
    expect(s.isComplete).toBe(false);
  });

  it('工程が終わると次へ進み、全部終わると完了する', () => {
    const steps = makeSteps();
    const s = new RepairSession(steps, 0);
    (steps[0] as ScrubMask).clearAll();
    expect(s.update(100)).toBe(1);
    expect(s.current?.id).toBe('f');
    (steps[1] as FinalTask).tap(0, 0);
    s.update(200);
    expect(s.isComplete).toBe(true);
    expect(s.clearedMs).toBe(200);
    expect(s.overallProgress).toBe(1);
  });

  it('工程が空だとエラーになる', () => {
    expect(() => new RepairSession([], 0)).toThrow();
  });
});

describe('座標の変換（タッチ位置のずれ防止）', () => {
  it('画面座標と論理座標が往復しても同じ値になる', () => {
    const t = computeTransform(390, 700);
    const screen = toScreen(t, 180, 280);
    const logical = toLogical(t, screen.x, screen.y);
    expect(logical.x).toBeCloseTo(180, 6);
    expect(logical.y).toBeCloseTo(280, 6);
  });

  it('縦長でも横長でも画面に収まる（はみ出さない）', () => {
    for (const [w, h] of [
      [390, 700],
      [360, 640],
      [1280, 800],
      [320, 900],
    ]) {
      const t = computeTransform(w, h);
      const tl = toScreen(t, 0, 0);
      const br = toScreen(t, 360, 560);
      expect(tl.x).toBeGreaterThanOrEqual(-0.001);
      expect(tl.y).toBeGreaterThanOrEqual(-0.001);
      expect(br.x).toBeLessThanOrEqual(w + 0.001);
      expect(br.y).toBeLessThanOrEqual(h + 0.001);
    }
  });
});
