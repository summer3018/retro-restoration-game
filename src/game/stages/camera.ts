import {
  drawDust,
  drawHaze,
  drawRustMarkers,
  drawSlotMarker,
  findDust,
  findFinal,
  findFit,
  findPolish,
  roundRect,
  vGradient,
  withPartTransform,
  type VisualState,
} from '../art';
import type { StageModule } from '../stage';
import { FinalTask, FitTask, PolishTask, ScrubMask, type RepairStep } from '../tasks';

/* ---------------- 配置 ---------------- */
const TOP = { x: 46, y: 132, w: 268, h: 34, r: 8 };
const BODY = { x: 46, y: 162, w: 268, h: 158, r: 16 };
const LENS = { x: 150, y: 250, outer: 62, glass: 34 };
const RING = { x: LENS.x, y: LENS.y, r: 54 };
const WINDER = { x: 244, y: 146, r: 17 };
const SHUTTER = { x: 290, y: 146, r: 15 };
const FINDER = { x: 84, y: 146 };

function insideShell(x: number, y: number): boolean {
  const inTop = x >= TOP.x && x <= TOP.x + TOP.w && y >= TOP.y && y <= TOP.y + TOP.h;
  if (inTop) return true;
  const r = BODY.r;
  const left = BODY.x;
  const top = BODY.y;
  const right = BODY.x + BODY.w;
  const bottom = BODY.y + BODY.h;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + r), right - r);
  const cy = Math.min(Math.max(y, top + r), bottom - r);
  return Math.hypot(x - cx, y - cy) <= r + 0.001;
}

export function buildCameraSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'body',
      title: 'ボディの汚れを落とす',
      hint: '指でこすって汚れを落とそう',
      rect: { x: TOP.x - 4, y: TOP.y - 4, w: TOP.w + 8, h: BODY.y + BODY.h - TOP.y + 8 },
      cols: 30,
      rows: 22,
      inside: insideShell,
      doneThreshold: 0.88,
    }),
    new PolishTask({
      id: 'lens',
      title: 'レンズを磨く',
      hint: 'レンズの上で指を往復させよう',
      spots: [
        { x: LENS.x - 14, y: LENS.y - 12, r: 17 },
        { x: LENS.x + 15, y: LENS.y - 8, r: 17 },
        { x: LENS.x, y: LENS.y + 16, r: 17 },
      ],
      strokeFactor: 8,
    }),
    new FitTask({
      id: 'parts',
      title: '部品を取り付ける',
      hint: '下の部品を点線の位置までドラッグ',
      parts: [
        {
          id: 'ring',
          label: 'レンズリング',
          hitRadius: 46,
          trayX: 78,
          trayY: 498,
          targetX: RING.x,
          targetY: RING.y,
          size: RING.r,
          snapRadius: 52,
        },
        {
          id: 'winder',
          label: '巻き上げノブ',
          hitRadius: 38,
          trayX: 182,
          trayY: 498,
          targetX: WINDER.x,
          targetY: WINDER.y,
          size: WINDER.r,
          snapRadius: 44,
        },
        {
          id: 'shutter',
          label: 'シャッターボタン',
          hitRadius: 36,
          trayX: 282,
          trayY: 498,
          targetX: SHUTTER.x,
          targetY: SHUTTER.y,
          size: SHUTTER.r,
          snapRadius: 42,
        },
      ],
    }),
    new FinalTask({
      id: 'shoot',
      title: 'シャッターを押す',
      hint: '取り付けたボタンをタップ',
      x: SHUTTER.x,
      y: SHUTTER.y,
      hitRadius: 34,
      label: 'シャッター',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

function drawShell(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, BODY.x + 5, BODY.y + 12, BODY.w, BODY.h, BODY.r);
  ctx.fill();

  // 上部のシルバープレート
  roundRect(ctx, TOP.x, TOP.y, TOP.w, TOP.h + 14, TOP.r);
  ctx.fillStyle = vGradient(ctx, TOP.y, TOP.y + TOP.h, [
    [0, '#efe9df'],
    [0.5, '#c3bbae'],
    [1, '#8f877a'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,34,26,0.6)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 本体
  roundRect(ctx, BODY.x, BODY.y, BODY.w, BODY.h, BODY.r);
  ctx.fillStyle = vGradient(ctx, BODY.y, BODY.y + BODY.h, [
    [0, '#453d36'],
    [0.5, '#322c27'],
    [1, '#231e1a'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 革のシボ
  for (let y = BODY.y + 6; y < BODY.y + BODY.h; y += 6) {
    for (let x = BODY.x + 4; x < BODY.x + BODY.w; x += 6) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const v = n - Math.floor(n);
      ctx.fillStyle = `rgba(255,240,220,${(0.03 + v * 0.05).toFixed(3)})`;
      ctx.fillRect(x, y, 2.6, 2.6);
    }
  }
  ctx.fillStyle = vGradient(ctx, BODY.y, BODY.y + 50, [
    [0, 'rgba(255,240,220,0.14)'],
    [1, 'rgba(255,240,220,0)'],
  ]);
  ctx.fillRect(BODY.x, BODY.y, BODY.w, 50);
  ctx.restore();
  ctx.strokeStyle = 'rgba(16,12,8,0.85)';
  ctx.lineWidth = 2;
  roundRect(ctx, BODY.x, BODY.y, BODY.w, BODY.h, BODY.r);
  ctx.stroke();

  // ファインダー
  roundRect(ctx, FINDER.x - 17, FINDER.y - 10, 34, 20, 4);
  ctx.fillStyle = '#20242a';
  ctx.fill();
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(150,200,220,0.45)';
  roundRect(ctx, FINDER.x - 13, FINDER.y - 6, 26, 12, 3);
  ctx.fill();

  // ブランド銘板（架空の名前）
  ctx.fillStyle = 'rgba(230,220,200,0.75)';
  ctx.font = 'bold 11px "Georgia", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('WARMLIGHT', BODY.x + 186, BODY.y + 132);
  ctx.restore();
}

function drawLens(ctx: CanvasRenderingContext2D, ringPlaced: boolean, time: number, finale: number): void {
  ctx.save();
  // 鏡胴
  const barrel = ctx.createRadialGradient(LENS.x - 16, LENS.y - 18, 6, LENS.x, LENS.y, LENS.outer);
  barrel.addColorStop(0, '#5b544c');
  barrel.addColorStop(0.6, '#3a342e');
  barrel.addColorStop(1, '#1c1815');
  ctx.fillStyle = barrel;
  ctx.beginPath();
  ctx.arc(LENS.x, LENS.y, LENS.outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,10,8,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 刻みのある中間リング
  ctx.strokeStyle = 'rgba(190,182,168,0.5)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(LENS.x + Math.cos(a) * (LENS.outer - 12), LENS.y + Math.sin(a) * (LENS.outer - 12));
    ctx.lineTo(LENS.x + Math.cos(a) * (LENS.outer - 4), LENS.y + Math.sin(a) * (LENS.outer - 4));
    ctx.stroke();
  }

  // ガラス
  const glass = ctx.createRadialGradient(
    LENS.x - 12,
    LENS.y - 14,
    2,
    LENS.x,
    LENS.y,
    LENS.glass,
  );
  glass.addColorStop(0, '#5f7f8c');
  glass.addColorStop(0.45, '#2c4650');
  glass.addColorStop(1, '#101c22');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(LENS.x, LENS.y, LENS.glass, 0, Math.PI * 2);
  ctx.fill();

  // 絞り羽根（撮影時に閉じる）
  if (finale > 0) {
    const close = Math.sin(Math.min(1, finale * 2.4) * Math.PI) * 0.85;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,14,0.92)';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(LENS.x, LENS.y);
      ctx.rotate((i / 6) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(-LENS.glass, -LENS.glass * (1 - close));
      ctx.lineTo(LENS.glass, -LENS.glass * (1 - close));
      ctx.lineTo(LENS.glass, -LENS.glass * 1.05);
      ctx.lineTo(-LENS.glass, -LENS.glass * 1.05);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 反射
  const tw = (Math.sin(time / 900) + 1) / 2;
  ctx.fillStyle = `rgba(190,230,255,${0.16 + tw * 0.1})`;
  ctx.beginPath();
  ctx.ellipse(LENS.x - 11, LENS.y - 13, LENS.glass * 0.4, LENS.glass * 0.22, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // レンズリング（部品）
  if (ringPlaced) {
    drawRingShape(ctx, RING.r);
  }
  ctx.restore();
}

function drawRingShape(ctx: CanvasRenderingContext2D, r: number, centered = false): void {
  ctx.save();
  if (!centered) ctx.translate(RING.x, RING.y);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#f1ece0');
  g.addColorStop(0.4, '#b7ae9d');
  g.addColorStop(0.75, '#e4ddcd');
  g.addColorStop(1, '#847b6c');
  ctx.strokeStyle = g;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,34,26,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r + 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r - 4.5, 0, Math.PI * 2);
  ctx.stroke();
  // 刻み（ローレット）
  ctx.strokeStyle = 'rgba(60,52,42,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 3.5), Math.sin(a) * (r - 3.5));
    ctx.lineTo(Math.cos(a) * (r + 3.5), Math.sin(a) * (r + 3.5));
    ctx.stroke();
  }
  ctx.restore();
}

function drawWinderShape(ctx: CanvasRenderingContext2D, r: number, angle: number): void {
  ctx.save();
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#efe9dd');
  g.addColorStop(1, '#7d7568');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,34,26,0.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,62,52,0.55)';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(60,52,44,0.8)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShutterShape(ctx: CanvasRenderingContext2D, r: number, pressed: number): void {
  ctx.save();
  const depth = 1 - pressed * 0.3;
  ctx.fillStyle = '#7a7268';
  ctx.beginPath();
  ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#e2654e');
  g.addColorStop(1, '#8e3220');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * depth, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.33, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSocketHole(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(24,20,16,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhoto(ctx: CanvasRenderingContext2D, finale: number): void {
  if (finale <= 0.25) return;
  const t = Math.min(1, (finale - 0.25) / 0.6);
  const w = 110;
  const h = 128;
  const x = 180 - w / 2;
  const y = 300 + (1 - t) * 60;
  ctx.save();
  ctx.globalAlpha = t;
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.rotate(0);
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = '#f7f1e2';
  ctx.fill();
  ctx.shadowBlur = 0;
  // 写真の中身（あたたかい風景）
  const g = ctx.createLinearGradient(0, y + 8, 0, y + 96);
  g.addColorStop(0, '#f3c27a');
  g.addColorStop(0.55, '#e39b63');
  g.addColorStop(1, '#8e5f44');
  ctx.fillStyle = g;
  ctx.fillRect(x + 8, y + 8, w - 16, 88);
  ctx.fillStyle = 'rgba(255,243,210,0.9)';
  ctx.beginPath();
  ctx.arc(x + 36, y + 36, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(90,60,40,0.65)';
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 96);
  ctx.lineTo(x + 40, y + 58);
  ctx.lineTo(x + 66, y + 96);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 48, y + 96);
  ctx.lineTo(x + 76, y + 66);
  ctx.lineTo(x + 102, y + 96);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(80,64,48,0.8)';
  ctx.font = '10px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('はじめの一枚', x + w / 2, y + 114);
  ctx.restore();
}

export const cameraStage: StageModule = {
  def: {
    id: 'camera',
    order: 3,
    title: 'レトロカメラ',
    subtitle: '棚の奥にあったフィルムカメラ',
    caption: 'くもったレンズを磨き、部品をそろえる。シャッターを押せば、また一枚が残せる。',
    accent: '#c98f6a',
  },

  build: buildCameraSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const dust = findDust(steps, 'body');
    const lens = findPolish(steps, 'lens');
    const fit = findFit(steps, 'parts');
    const shoot = findFinal(steps, 'shoot');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;

    const ringPlaced = fit?.isPlaced('ring') ?? false;
    const winderPlaced = fit?.isPlaced('winder') ?? false;
    const shutterPlaced = fit?.isPlaced('shutter') ?? false;
    const fired = shoot?.triggered ?? false;
    const finale = fired ? state.finale : 0;

    drawShell(ctx);
    drawLens(ctx, ringPlaced, time, finale);

    // レンズのくもり
    if (lens) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(LENS.x, LENS.y, LENS.glass, 0, Math.PI * 2);
      ctx.clip();
      drawHaze(ctx, lens, time);
      ctx.restore();
      if (current === lens) drawRustMarkers(ctx, lens, time);
    }

    // 取り付け位置
    if (!winderPlaced) drawSocketHole(ctx, WINDER.x, WINDER.y, WINDER.r);
    if (!shutterPlaced) drawSocketHole(ctx, SHUTTER.x, SHUTTER.y, SHUTTER.r);

    if (winderPlaced) {
      ctx.save();
      ctx.translate(WINDER.x, WINDER.y);
      drawWinderShape(ctx, WINDER.r, fired ? time / 1400 : 0);
      ctx.restore();
    }
    if (shutterPlaced) {
      ctx.save();
      ctx.translate(SHUTTER.x, SHUTTER.y);
      if (current === shoot && !fired) {
        const pulse = (Math.sin(time / 280) + 1) / 2;
        ctx.shadowBlur = 10 + pulse * 16;
        ctx.shadowColor = 'rgba(255,120,90,0.85)';
      }
      drawShutterShape(ctx, SHUTTER.r, shoot?.press ?? 0);
      ctx.restore();
    }

    // 汚れ
    if (dust) drawDust(ctx, dust, state.dustFade);

    // 目印とトレイの部品
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        const near = p.dragging && Math.hypot(p.x - p.targetX, p.y - p.targetY) <= (p.snapRadius ?? 46);
        drawSlotMarker(ctx, p.targetX, p.targetY, (p.size ?? 20) + 6, time, true, near);
      }
    }
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          ctx.scale(scale, scale);
          if (p.id === 'ring') drawRingShape(ctx, p.dragging ? RING.r : 34, true);
          else if (p.id === 'winder') drawWinderShape(ctx, p.size ?? 17, 0);
          else drawShutterShape(ctx, p.size ?? 15, 0);
        });
      }
    }

    if (fired) drawPhoto(ctx, state.finale);
  },
};
