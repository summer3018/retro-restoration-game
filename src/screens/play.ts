import { backButton, el, muteButton, type App, type ScreenParams, type Unmount } from '../app';
import { sfx } from '../core/audio';
import { Particles } from '../core/particles';
import { computeTransform, DESIGN_H, DESIGN_W, toLogical, type ViewTransform } from '../core/viewport';
import { roundRect, type VisualState } from '../game/art';
import { RepairSession } from '../game/session';
import { TRAY_AREA, type StageModule } from '../game/stage';
import { getStage } from '../game/stages';
import { openNoteSheet } from './note';
import { FinalTask, FitTask, PolishTask, ScrubMask, type FitPart } from '../game/tasks';

const FINALE_MS = 1700;
const AUTO_NEXT_MS = 2300;
const IDLE_HINT_MS = 7000;

export function mountPlay(app: App, params: ScreenParams): Unmount {
  const found = params.stageId ? getStage(params.stageId) : null;
  if (!found) {
    app.go('select');
    return () => undefined;
  }
  const stage: StageModule = found;

  /* ---------------- DOM ---------------- */
  const screen = el('div', { class: 'screen' });
  const head = el('div', { class: 'play-head' });
  const chip = el('span', { class: 'step-chip' }, ['1 / 4']);
  const title = el('h2', { class: 'step-title' }, ['']);
  const hint = el('p', { class: 'step-hint' }, ['']);
  const bar = el('div', { class: 'progress__bar' });
  const progress = el('div', { class: 'progress' }, [bar]);

  const noteBtn = el('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': '気づいたことをメモする',
  }, ['📝']) as HTMLButtonElement;

  const topRow = el('div', { class: 'play-head__row' }, [
    backButton(app, 'select'),
    el('div', { class: 'card__body' }, [el('div', { class: 'row' }, [chip]), title]),
    noteBtn,
    muteButton(app),
  ]);
  head.append(topRow, hint, progress);

  const wrap = el('div', { class: 'canvas-wrap' });
  const canvas = el('canvas', { class: 'stage' }) as HTMLCanvasElement;
  const toast = el('div', { class: 'toast' }, ['']);
  wrap.append(canvas, toast);
  screen.append(head, wrap);
  app.root.append(screen);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    screen.append(el('p', { class: 'muted' }, ['この端末ではCanvasが使えないため、ゲームを表示できません。']));
    return () => undefined;
  }

  /* ---------------- 状態 ---------------- */
  const steps = stage.build();
  const session = new RepairSession(steps, performance.now());
  const particles = new Particles();
  let view: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  let dustFade = 1;
  let finaleT = 0;
  let finished = false;
  let navigated = false;
  let toastTimer = 0;
  let lastProgress = 0;
  let idleMs = 0;
  let flash = 0;

  // 記録
  if (params.retry) app.analytics.track('stage_retry', { stageId: stage.def.id });
  if (params.fromNext) app.analytics.track('next_stage_start', { stageId: stage.def.id });
  app.analytics.track('stage_start', { stageId: stage.def.id });

  function showToast(text: string, ms = 1600): void {
    toast.textContent = text;
    toast.classList.add('is-on');
    toastTimer = ms;
  }

  noteBtn.addEventListener('click', () => {
    sfx.ui();
    openNoteSheet(
      app,
      {
        stageId: stage.def.id,
        stageTitle: stage.def.title,
        stepTitle: session.current?.title ?? '修復完了後',
      },
      (saved) => {
        if (saved) showToast('メモを残しました', 1400);
      },
    );
  });

  /* ---------------- 画面サイズ ---------------- */
  function resize(): void {
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    view = computeTransform(rect.width, rect.height);
    (ctx as CanvasRenderingContext2D).setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);
  resize();

  function pointerPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return toLogical(view, e.clientX - rect.left, e.clientY - rect.top);
  }

  /* ---------------- 入力 ---------------- */
  let pointerId: number | null = null;
  let last: { x: number; y: number } | null = null;
  let heldPart: FitPart | null = null;
  let grabOffset = { x: 0, y: 0 };
  let pressedFinal: FinalTask | null = null;

  function onDown(e: PointerEvent): void {
    if (finished || pointerId !== null) return;
    const step = session.current;
    if (!step) return;
    e.preventDefault();
    pointerId = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 一部の環境では捕捉できないが、操作は続けられる */
    }
    const p = pointerPos(e);
    last = p;
    idleMs = 0;

    if (step instanceof FitTask) {
      const part = step.grabAt(p.x, p.y);
      if (part) {
        heldPart = part;
        grabOffset = { x: part.x - p.x, y: part.y - p.y };
        part.dragging = true;
        sfx.pick();
      } else {
        showToast('下にある部品を指でつまんで運ぼう');
      }
      return;
    }
    if (step instanceof FinalTask) {
      if (step.hitTest(p.x, p.y)) {
        pressedFinal = step;
        step.press = 1;
      } else {
        showToast(`${step.label}をタップしてね`);
      }
      return;
    }
    if (step instanceof ScrubMask) {
      const removed = step.brush(p.x, p.y, brushRadius(), 0.5);
      if (removed > 0) {
        particles.dust(p.x, p.y, 2);
        sfx.wipe();
      }
    }
  }

  function onMove(e: PointerEvent): void {
    if (pointerId !== e.pointerId || finished) return;
    const step = session.current;
    if (!step || !last) return;
    e.preventDefault();
    const p = pointerPos(e);
    idleMs = 0;

    if (step instanceof FitTask && heldPart) {
      step.drag(heldPart, p.x + grabOffset.x, p.y + grabOffset.y);
    } else if (step instanceof ScrubMask) {
      const removed = step.brushLine(last.x, last.y, p.x, p.y, brushRadius(), 0.5);
      if (removed > 0) {
        particles.dust(p.x, p.y, 1);
        sfx.wipe();
      }
    } else if (step instanceof PolishTask) {
      const r = step.rub(last.x, last.y, p.x, p.y);
      if (r.hit) {
        sfx.polish();
        if (r.gained > 0 && Math.random() < 0.3) particles.burst(p.x, p.y, 1, 'spark', 0.5);
      }
    } else if (step instanceof FinalTask && pressedFinal) {
      if (!step.hitTest(p.x, p.y)) {
        pressedFinal.press = 0;
        pressedFinal = null;
      }
    }
    last = p;
  }

  function onUp(e: PointerEvent): void {
    if (pointerId !== e.pointerId) return;
    const step = session.current;
    const p = pointerPos(e);
    if (step instanceof FitTask && heldPart) {
      const result = step.drop(heldPart);
      if (result === 'placed') {
        sfx.snap();
        particles.burst(heldPart.targetX, heldPart.targetY, 10, 'spark', 0.8);
      } else {
        sfx.miss();
        showToast('ここではないみたい。点線の位置へ運ぼう');
      }
      heldPart = null;
    } else if (step instanceof FinalTask && pressedFinal) {
      pressedFinal.press = 0;
      if (step.tap(p.x, p.y)) {
        onFinalTriggered();
      }
      pressedFinal = null;
    } else if (step instanceof PolishTask) {
      step.endStroke();
    }
    try {
      if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      /* 解放できなくても次の操作に影響しない */
    }
    pointerId = null;
    last = null;
  }

  function brushRadius(): number {
    return 26;
  }

  function onFinalTriggered(): void {
    if (stage.def.id === 'camera') {
      sfx.shutter();
      flash = 1;
    } else if (stage.def.id === 'clock') {
      sfx.tick();
      sfx.power();
    } else {
      sfx.power();
    }
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  // ドラッグ中にページが動かないようにする保険
  const blockTouch = (e: TouchEvent) => e.preventDefault();
  canvas.addEventListener('touchmove', blockTouch, { passive: false });

  /* ---------------- HUD 更新 ---------------- */
  function updateHud(): void {
    const step = session.current;
    const idx = Math.min(session.currentIndex, steps.length - 1);
    chip.textContent = `工程 ${idx + 1} / ${steps.length}`;
    if (step) {
      title.textContent = step.title;
      hint.textContent = step.hint;
    } else {
      title.textContent = '修復完了！';
      hint.textContent = '';
    }
    bar.style.width = `${Math.round(session.overallProgress * 100)}%`;
  }
  updateHud();

  /* ---------------- 描画 ---------------- */
  function drawWorkbench(c: CanvasRenderingContext2D, showTray: boolean, time: number): void {
    // 作業台
    const g = c.createLinearGradient(0, 0, 0, DESIGN_H);
    g.addColorStop(0, '#3a2a1c');
    g.addColorStop(0.55, '#2a1d13');
    g.addColorStop(1, '#1b120b');
    c.fillStyle = g;
    c.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // ランプの光
    const lamp = c.createRadialGradient(DESIGN_W / 2, 90, 10, DESIGN_W / 2, 190, 330);
    lamp.addColorStop(0, 'rgba(255,216,150,0.20)');
    lamp.addColorStop(1, 'rgba(255,216,150,0)');
    c.fillStyle = lamp;
    c.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // 板の継ぎ目
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const x = (DESIGN_W / 4) * i;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, DESIGN_H);
      c.stroke();
    }

    // 作業マット（品物が浮いて見えないように敷く）
    c.save();
    roundRect(c, 22, 96, DESIGN_W - 44, 340, 18);
    c.fillStyle = 'rgba(58,40,25,0.5)';
    c.fill();
    c.strokeStyle = 'rgba(255,221,170,0.12)';
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();

    if (showTray) {
      c.save();
      roundRect(c, TRAY_AREA.x, TRAY_AREA.y, TRAY_AREA.w, TRAY_AREA.h, 14);
      c.fillStyle = 'rgba(16,10,6,0.55)';
      c.fill();
      c.strokeStyle = 'rgba(255,221,170,0.22)';
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = 'rgba(233,169,75,0.75)';
      c.font = '11px "Hiragino Sans", "Noto Sans JP", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.fillText('部品トレイ', TRAY_AREA.x + 12, TRAY_AREA.y + 18);
      const pulse = (Math.sin(time / 500) + 1) / 2;
      c.fillStyle = `rgba(246,234,212,${0.3 + pulse * 0.3})`;
      c.fillText('↑ ドラッグして取り付け', TRAY_AREA.x + 92, TRAY_AREA.y + 18);
      c.restore();
    }
  }

  function render(time: number): void {
    const c = ctx as CanvasRenderingContext2D;
    const rect = wrap.getBoundingClientRect();
    c.save();
    c.clearRect(0, 0, rect.width, rect.height);
    c.translate(view.offsetX, view.offsetY);
    c.scale(view.scale, view.scale);
    c.beginPath();
    c.rect(0, 0, DESIGN_W, DESIGN_H);
    c.clip();

    const current = session.current;
    drawWorkbench(c, current instanceof FitTask, time);

    const state: VisualState = {
      steps,
      stepIndex: session.currentIndex,
      finale: finaleT,
      time,
      dustFade,
    };
    stage.draw(c, state);
    particles.draw(c);

    if (flash > 0) {
      c.fillStyle = `rgba(255,255,255,${(flash * 0.85).toFixed(3)})`;
      c.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }

    if (finished) {
      const a = Math.min(0.55, finaleT * 0.55);
      const glow = c.createRadialGradient(DESIGN_W / 2, 230, 20, DESIGN_W / 2, 230, 300);
      glow.addColorStop(0, `rgba(255,214,140,${a})`);
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    c.restore();
  }

  /* ---------------- ループ ---------------- */
  let raf = 0;
  let prev = performance.now();

  function tick(now: number): void {
    const dt = Math.min(64, now - prev);
    prev = now;

    const before = session.currentIndex;
    session.update(now);
    const current = session.current;

    // 汚れ落としが終わったら、残りをふわっと消す
    const wipe = steps.find((s) => s instanceof ScrubMask) as ScrubMask | undefined;
    if (wipe && wipe.isDone && dustFade > 0) {
      dustFade = Math.max(0, dustFade - dt / 420);
      if (dustFade === 0) wipe.clearAll();
    }

    // 部品の失敗演出
    for (const s of steps) {
      if (s instanceof FitTask) {
        for (const p of s.parts) if (p.shake > 0) p.shake = Math.max(0, p.shake - dt);
      }
    }

    if (session.currentIndex !== before) {
      updateHud();
      if (!session.isComplete) {
        sfx.stepClear();
        showToast('いいね！次の工程へ', 1200);
      }
    }

    // 完成
    if (session.isComplete && !finished) {
      finished = true;
      sfx.complete();
      particles.burst(180, 240, 34, 'spark', 1.4);
      updateHud();
    }
    if (finished) {
      finaleT = Math.min(1, finaleT + dt / FINALE_MS);
      if (finaleT > 0.3 && particles.items.length < 40 && Math.random() < 0.25) {
        particles.burst(60 + Math.random() * 240, 150 + Math.random() * 180, 2, 'spark', 0.8);
      }
    }

    // 進み具合が動いていない時間を測って、ヒントを出す
    const p = session.overallProgress;
    if (Math.abs(p - lastProgress) > 0.001) {
      lastProgress = p;
      idleMs = 0;
    } else if (!finished && current) {
      idleMs += dt;
      if (idleMs > IDLE_HINT_MS) {
        idleMs = 0;
        showToast(current.hint, 2200);
      }
    }
    bar.style.width = `${Math.round(p * 100)}%`;

    if (flash > 0) flash = Math.max(0, flash - dt / 420);

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.classList.remove('is-on');
    }

    particles.update(dt);
    render(now);

    if (finished && !navigated && finaleT >= 1) {
      navigated = true;
      const elapsed = Math.round(session.clearedMs ?? session.elapsedMs(now));
      window.setTimeout(() => {
        const firstClear = app.save.recordClear(stage.def.id, elapsed, new Date().toISOString());
        app.analytics.track('stage_complete', { stageId: stage.def.id, elapsedMs: elapsed });
        app.go('complete', { stageId: stage.def.id, clearedMs: elapsed, firstClear });
      }, AUTO_NEXT_MS - FINALE_MS);
    }

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    document.querySelectorAll('.sheet').forEach((n) => n.remove());
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('touchmove', blockTouch);
  };
}
