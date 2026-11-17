import {
  drawDust,
  drawRust,
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

/* ---------------- 配置（論理座標） ---------------- */
/** 木の箱の天板（斜め上から見た上の面） */
const TOP = { x: 34, y: 118, w: 292, h: 220, r: 14 };
/** 箱の手前の面（厚み） */
const FRONT_H = 24;
/** 回転盤 */
const PLATTER = { x: 152, y: 226, r: 82 };
/** レコード盤（見た目の半径）とラベル */
const RECORD_R = 74;
const LABEL_R = 22;
/** トレイに置いてあるときのレコードの見た目の半径 */
const TRAY_DISC_R = 32;
/** トーンアームの付け根 */
const PIVOT = { x: 276, y: 150, r: 18 };
/** トーンアームの長さ（付け根→針の先） */
const ARM_LEN = 136;
/** 休んでいるときの角度（ほぼ真下）と、針を下ろしたときの角度（盤の上） */
const ARM_REST = 1.48;
const ARM_PLAY = 2.2;
/** 休んでいるときの針の先 = 針（カートリッジ）の取り付け先 */
const ARM_TIP = {
  x: PIVOT.x + Math.cos(ARM_REST) * ARM_LEN,
  y: PIVOT.y + Math.sin(ARM_REST) * ARM_LEN,
};
/** アームを乗せておく台 */
const ARM_REST_POST = {
  x: PIVOT.x + Math.cos(ARM_REST) * ARM_LEN * 0.72,
  y: PIVOT.y + Math.sin(ARM_REST) * ARM_LEN * 0.72,
};
/** 操作レバー（最後にタップする所） */
const LEVER = { x: 304, y: 316 };
/** 回転数のつまみ（飾り） */
const SPEED_KNOB = { x: 62, y: 314, r: 12 };

function insideTop(x: number, y: number): boolean {
  const r = TOP.r;
  const left = TOP.x;
  const top = TOP.y;
  const right = TOP.x + TOP.w;
  const bottom = TOP.y + TOP.h;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + r), right - r);
  const cy = Math.min(Math.max(y, top + r), bottom - r);
  return Math.hypot(x - cx, y - cy) <= r + 0.001;
}

function rustSpots() {
  const rimA = -2.4;
  const rimB = 0.75;
  return [
    // トーンアームの付け根
    { x: PIVOT.x, y: PIVOT.y, r: 19 },
    // 回転盤のふち（左上・右下）
    { x: PLATTER.x + Math.cos(rimA) * PLATTER.r, y: PLATTER.y + Math.sin(rimA) * PLATTER.r, r: 18 },
    { x: PLATTER.x + Math.cos(rimB) * PLATTER.r, y: PLATTER.y + Math.sin(rimB) * PLATTER.r, r: 18 },
    // 左上の角の金具
    { x: TOP.x + 14, y: TOP.y + 14, r: 18 },
  ];
}

export function buildRecordSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'dust',
      title: 'ホコリを拭き取る',
      hint: '指でこすって汚れを落とそう',
      rect: { x: TOP.x - 4, y: TOP.y - 4, w: TOP.w + 8, h: TOP.h + 8 },
      cols: 30,
      rows: 22,
      inside: insideTop,
      doneThreshold: 0.88,
    }),
    new PolishTask({
      id: 'chrome',
      title: '金具のサビを磨く',
      hint: '光っている輪の上で指を往復させよう',
      spots: rustSpots(),
      strokeFactor: 8,
    }),
    new FitTask({
      id: 'parts',
      title: 'レコードと針を取り付ける',
      hint: '下の部品を点線の位置までドラッグ',
      parts: [
        {
          id: 'disc',
          label: 'レコード',
          hitRadius: 44,
          trayX: 110,
          trayY: 502,
          targetX: PLATTER.x,
          targetY: PLATTER.y,
          size: RECORD_R,
          snapRadius: 56,
        },
        {
          id: 'needle',
          label: '針',
          hitRadius: 38,
          trayX: 250,
          trayY: 498,
          targetX: ARM_TIP.x,
          targetY: ARM_TIP.y,
          size: 14,
          snapRadius: 44,
        },
      ],
    }),
    new FinalTask({
      id: 'play',
      title: '針を下ろす',
      hint: 'レバーをタップして針を下ろそう',
      x: LEVER.x,
      y: LEVER.y,
      hitRadius: 34,
      label: 'レバー',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) * (1 - c) * (1 - c);
}

function drawBox(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  roundRect(ctx, TOP.x + 6, TOP.y + 14, TOP.w, TOP.h + FRONT_H, TOP.r);
  ctx.fill();

  // 手前の面（厚み）
  roundRect(ctx, TOP.x, TOP.y + TOP.h - TOP.r, TOP.w, FRONT_H + TOP.r, TOP.r);
  ctx.fillStyle = vGradient(ctx, TOP.y + TOP.h - TOP.r, TOP.y + TOP.h + FRONT_H, [
    [0, '#6e3f1e'],
    [1, '#4a2912'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(36,18,6,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 天板
  roundRect(ctx, TOP.x, TOP.y, TOP.w, TOP.h, TOP.r);
  ctx.fillStyle = vGradient(ctx, TOP.y, TOP.y + TOP.h, [
    [0, '#b77a43'],
    [0.5, '#9a5e30'],
    [1, '#7a4622'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 木目
  for (let i = 0; i < 18; i++) {
    const y = TOP.y + 6 + i * 12.4;
    ctx.strokeStyle = `rgba(60,32,12,${0.06 + (i % 3) * 0.035})`;
    ctx.lineWidth = 1 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(TOP.x, y);
    ctx.bezierCurveTo(TOP.x + 90, y - 5, TOP.x + 200, y + 6, TOP.x + TOP.w, y - 2);
    ctx.stroke();
  }
  // 上からの光
  ctx.fillStyle = vGradient(ctx, TOP.y, TOP.y + 80, [
    [0, 'rgba(255,232,190,0.24)'],
    [1, 'rgba(255,232,190,0)'],
  ]);
  ctx.fillRect(TOP.x, TOP.y, TOP.w, 80);
  ctx.restore();

  ctx.strokeStyle = 'rgba(42,22,8,0.75)';
  ctx.lineWidth = 2;
  roundRect(ctx, TOP.x, TOP.y, TOP.w, TOP.h, TOP.r);
  ctx.stroke();

  // 天板のふちの細い線（ふたの合わせ目）
  ctx.strokeStyle = 'rgba(255,222,170,0.14)';
  ctx.lineWidth = 1;
  roundRect(ctx, TOP.x + 6, TOP.y + 6, TOP.w - 12, TOP.h - 12, TOP.r - 4);
  ctx.stroke();

  // 脚
  ctx.fillStyle = '#3b200d';
  roundRect(ctx, TOP.x + 22, TOP.y + TOP.h + FRONT_H - 4, 36, 12, 4);
  ctx.fill();
  roundRect(ctx, TOP.x + TOP.w - 58, TOP.y + TOP.h + FRONT_H - 4, 36, 12, 4);
  ctx.fill();
  ctx.restore();
}

/** 四隅の金具 */
function drawCornerFittings(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const corners: [number, number, number, number][] = [
    [TOP.x, TOP.y, 1, 1],
    [TOP.x + TOP.w, TOP.y, -1, 1],
    [TOP.x, TOP.y + TOP.h, 1, -1],
    [TOP.x + TOP.w, TOP.y + TOP.h, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    const g = ctx.createLinearGradient(x, y, x + sx * 26, y + sy * 26);
    g.addColorStop(0, '#efe6d3');
    g.addColorStop(0.5, '#b3a78f');
    g.addColorStop(1, '#8c816d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + sx * 2, y + sy * 2);
    ctx.lineTo(x + sx * 28, y + sy * 2);
    ctx.quadraticCurveTo(x + sx * 10, y + sy * 10, x + sx * 2, y + sy * 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,44,22,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,56,36,0.8)';
    ctx.beginPath();
    ctx.arc(x + sx * 9, y + sy * 9, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlatter(ctx: CanvasRenderingContext2D, spin: number): void {
  ctx.save();
  // 盤が沈んでいる穴の影
  ctx.fillStyle = 'rgba(30,14,4,0.55)';
  ctx.beginPath();
  ctx.arc(PLATTER.x + 2, PLATTER.y + 4, PLATTER.r + 3, 0, Math.PI * 2);
  ctx.fill();

  // 金属のふち
  const rim = ctx.createLinearGradient(
    PLATTER.x - PLATTER.r,
    PLATTER.y - PLATTER.r,
    PLATTER.x + PLATTER.r,
    PLATTER.y + PLATTER.r,
  );
  rim.addColorStop(0, '#f1eadb');
  rim.addColorStop(0.4, '#aea38d');
  rim.addColorStop(0.7, '#e2d9c5');
  rim.addColorStop(1, '#857a67');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(PLATTER.x, PLATTER.y, PLATTER.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,38,20,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ゴムのマット
  ctx.fillStyle = '#2f2a26';
  ctx.beginPath();
  ctx.arc(PLATTER.x, PLATTER.y, PLATTER.r - 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(PLATTER.x, PLATTER.y);
  ctx.rotate(spin);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let rr = 18; rr < PLATTER.r - 10; rr += 9) {
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 中心の軸
  ctx.fillStyle = '#d9d0bd';
  ctx.beginPath();
  ctx.arc(PLATTER.x, PLATTER.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** レコード盤（原点が中心） */
function drawDisc(ctx: CanvasRenderingContext2D, r: number, spin: number): void {
  ctx.save();
  // 盤
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#2a2a2e');
  g.addColorStop(1, '#0e0e11');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 溝
  const labelR = r * (LABEL_R / RECORD_R);
  ctx.lineWidth = Math.max(0.6, r / 90);
  for (let rr = labelR + r * 0.06; rr < r * 0.96; rr += r * 0.045) {
    ctx.strokeStyle = 'rgba(120,120,130,0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 光の反射（盤が回っても動かない）
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
  ctx.moveTo(labelR + 2, 0);
  ctx.arc(0, 0, labelR + 2, 0, Math.PI * 2, true);
  ctx.clip();
  for (const base of [-Math.PI * 0.75, Math.PI * 0.25]) {
    ctx.fillStyle = 'rgba(220,220,235,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, base - 0.22, base + 0.22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ラベル（回る）
  ctx.save();
  ctx.rotate(spin);
  ctx.fillStyle = '#c4473a';
  ctx.beginPath();
  ctx.arc(0, 0, labelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,190,0.6)';
  ctx.lineWidth = Math.max(0.8, labelR / 16);
  ctx.beginPath();
  ctx.arc(0, 0, labelR * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  // 回っているのが分かる半月の模様
  ctx.fillStyle = '#f0d9a8';
  ctx.beginPath();
  ctx.arc(0, 0, labelR * 0.66, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.arc(0, 0, labelR * 0.36, -Math.PI * 0.15, -Math.PI * 0.85, true);
  ctx.closePath();
  ctx.fill();
  // 小さな星（架空のマーク）
  ctx.fillStyle = 'rgba(255,240,210,0.85)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = (i % 2 === 0 ? 0.22 : 0.1) * labelR;
    ctx.lineTo(Math.cos(a) * rr, labelR * 0.52 + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 中心の穴
  ctx.fillStyle = '#d9d0bd';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.4, r * 0.04), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 針（カートリッジ）。原点が針の先、-y がアームの方向 */
function drawCartridge(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.save();
  // ヘッドの金属板
  const g = ctx.createLinearGradient(-s, 0, s, 0);
  g.addColorStop(0, '#e9e1cf');
  g.addColorStop(0.5, '#a79c86');
  g.addColorStop(1, '#d8cfbb');
  ctx.fillStyle = g;
  roundRect(ctx, -s * 0.75, -s * 1.6, s * 1.5, s * 0.9, s * 0.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,40,24,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 黒い本体
  ctx.fillStyle = '#1e1c1b';
  roundRect(ctx, -s * 0.6, -s * 0.9, s * 1.2, s * 0.9, s * 0.18);
  ctx.fill();
  ctx.fillStyle = '#c4473a';
  ctx.fillRect(-s * 0.6, -s * 0.62, s * 1.2, s * 0.14);
  // 針の先
  ctx.strokeStyle = '#e8e2d2';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05);
  ctx.lineTo(0, s * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawArmRestPost(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(30,14,4,0.45)';
  ctx.beginPath();
  ctx.ellipse(ARM_REST_POST.x + 2, ARM_REST_POST.y + 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.ellipse(ARM_REST_POST.x, ARM_REST_POST.y, 8, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,190,170,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawPivotBase(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(30,14,4,0.45)';
  ctx.beginPath();
  ctx.arc(PIVOT.x + 2, PIVOT.y + 4, PIVOT.r + 1, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(PIVOT.x - PIVOT.r, PIVOT.y - PIVOT.r, PIVOT.x + PIVOT.r, PIVOT.y + PIVOT.r);
  g.addColorStop(0, '#f2ebdc');
  g.addColorStop(0.5, '#aaa08a');
  g.addColorStop(1, '#7f7562');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(PIVOT.x, PIVOT.y, PIVOT.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,38,20,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** トーンアーム。angle は付け根から針の先への向き */
function drawArm(ctx: CanvasRenderingContext2D, angle: number, withCartridge: boolean): void {
  ctx.save();
  ctx.translate(PIVOT.x, PIVOT.y);
  ctx.rotate(angle - Math.PI / 2); // +y が針の先の方向になる

  // おもり（付け根の反対側）
  const w = ctx.createLinearGradient(-9, 0, 9, 0);
  w.addColorStop(0, '#d8d0bf');
  w.addColorStop(0.5, '#8d846f');
  w.addColorStop(1, '#c9c0ac');
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -8, -34, 18, 20, 4);
  ctx.fill();
  ctx.fillStyle = w;
  roundRect(ctx, -9, -36, 18, 20, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,38,20,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // アームの影
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(3, -14);
  ctx.lineTo(3, ARM_LEN - 18);
  ctx.stroke();

  // アーム（細い金属の棒）
  ctx.strokeStyle = '#d6cdb9';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(0, ARM_LEN - 20);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-1, -14);
  ctx.lineTo(-1, ARM_LEN - 22);
  ctx.stroke();

  // 付け根のキャップ
  ctx.fillStyle = '#5a5246';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e0cf';
  ctx.beginPath();
  ctx.arc(-1.5, -1.5, 3, 0, Math.PI * 2);
  ctx.fill();

  // 先端（針がないときは差し込み口だけ）
  ctx.translate(0, ARM_LEN);
  if (withCartridge) {
    drawCartridge(ctx, 14);
  } else {
    ctx.fillStyle = '#3a3530';
    roundRect(ctx, -5, -22, 10, 8, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLever(ctx: CanvasRenderingContext2D, down: number, active: boolean, pressed: number, time: number): void {
  ctx.save();
  ctx.translate(LEVER.x, LEVER.y);
  // 台
  ctx.fillStyle = 'rgba(30,14,4,0.45)';
  roundRect(ctx, -13, -14, 28, 32, 6);
  ctx.fill();
  const g = ctx.createLinearGradient(-12, -16, 12, 16);
  g.addColorStop(0, '#ece4d2');
  g.addColorStop(1, '#8e846f');
  ctx.fillStyle = g;
  roundRect(ctx, -12, -16, 24, 30, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,38,20,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 溝
  ctx.fillStyle = '#3a3028';
  roundRect(ctx, -2.5, -11, 5, 20, 2.5);
  ctx.fill();

  // つまみ（上 = 針が上がっている / 下 = 下りている）
  const knobY = -7 + (down * 0.8 + pressed * 0.2) * 12;
  if (active) {
    const pulse = (Math.sin(time / 280) + 1) / 2;
    ctx.shadowBlur = 10 + pulse * 16;
    ctx.shadowColor = 'rgba(255,200,120,0.9)';
  }
  ctx.fillStyle = '#c4473a';
  ctx.beginPath();
  ctx.arc(0, knobY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-2, knobY - 2.5, 3, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpeedKnob(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(SPEED_KNOB.x, SPEED_KNOB.y);
  ctx.fillStyle = 'rgba(30,14,4,0.45)';
  ctx.beginPath();
  ctx.arc(1.5, 2.5, SPEED_KNOB.r + 1, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(-SPEED_KNOB.r, -SPEED_KNOB.r, SPEED_KNOB.r, SPEED_KNOB.r);
  g.addColorStop(0, '#f0e8d6');
  g.addColorStop(1, '#8b816c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, SPEED_KNOB.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3a28';
  roundRect(ctx, -1.5, -SPEED_KNOB.r + 2, 3, SPEED_KNOB.r * 0.8, 1.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.7)';
  ctx.font = '8px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('33', SPEED_KNOB.r + 4, -4);
  ctx.fillText('45', SPEED_KNOB.r + 4, 6);
  ctx.restore();
}

/** 八分音符（原点が玉の中心） */
function drawNote(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.55, s * 0.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(s * 0.4, -s * 1.7, s * 0.16, s * 1.7);
  ctx.beginPath();
  ctx.moveTo(s * 0.56, -s * 1.7);
  ctx.quadraticCurveTo(s * 1.25, -s * 1.3, s * 1.0, -s * 0.7);
  ctx.quadraticCurveTo(s * 0.95, -s * 1.15, s * 0.56, -s * 1.25);
  ctx.closePath();
  ctx.fill();
}

/** 盤の上からふわふわ上がって消える音符（time から計算） */
function drawNotes(ctx: CanvasRenderingContext2D, strength: number, time: number): void {
  if (strength <= 0.001) return;
  ctx.save();
  const period = 2600;
  const count = 4;
  for (let i = 0; i < count; i++) {
    const t = (((time + (i * period) / count) % period) + period) % period / period; // 0..1
    const baseX = PLATTER.x - 50 + i * 34;
    const x = baseX + Math.sin(t * Math.PI * 2 + i) * 10;
    const y = PLATTER.y - 70 - t * 96;
    const a = Math.sin(t * Math.PI) * strength;
    if (a <= 0.01) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * Math.PI * 2 + i * 1.7) * 0.25);
    ctx.shadowBlur = 8;
    ctx.shadowColor = `rgba(255,214,140,${(0.8 * a).toFixed(3)})`;
    ctx.fillStyle = `rgba(255,238,200,${a.toFixed(3)})`;
    drawNote(ctx, 9 + (i % 2) * 2);
    ctx.restore();
  }
  ctx.restore();
}

export const recordStage: StageModule = {
  def: {
    id: 'record',
    order: 6,
    title: 'レコードプレーヤー',
    subtitle: '祖父の家にあった木箱のプレーヤー',
    caption: '木の箱に回転盤と細いアーム。針を下ろすと、レコードが回って昔の歌が流れ出す。',
    accent: '#d8705a',
    finalCue: 'music',
  },

  build: buildRecordSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const dust = findDust(steps, 'dust');
    const rust = findPolish(steps, 'chrome');
    const fit = findFit(steps, 'parts');
    const play = findFinal(steps, 'play');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;

    const discPlaced = fit?.isPlaced('disc') ?? false;
    const needlePlaced = fit?.isPlaced('needle') ?? false;
    const playing = play?.triggered ?? false;
    // 針を下ろしたあと: アームが盤の上へ動き、着いたらレコードが回る
    const armT = playing ? easeOut(state.finale / 0.55) : 0;
    const armAngle = ARM_REST + (ARM_PLAY - ARM_REST) * armT;
    const spinning = playing && state.finale > 0.45;
    const spin = spinning ? time / 380 : 0;
    const noteStrength = playing ? Math.min(1, Math.max(0, (state.finale - 0.5) / 0.4)) : 0;

    drawBox(ctx);
    drawCornerFittings(ctx);
    drawPlatter(ctx, spin);
    if (discPlaced) {
      ctx.save();
      ctx.translate(PLATTER.x, PLATTER.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(1.5, 3, RECORD_R, 0, Math.PI * 2);
      ctx.fill();
      drawDisc(ctx, RECORD_R, spin);
      ctx.restore();
    }
    drawSpeedKnob(ctx);
    drawArmRestPost(ctx);
    drawPivotBase(ctx);
    drawArm(ctx, armAngle, needlePlaced);
    drawLever(ctx, armT, current === play && !playing, play?.press ?? 0, time);

    // サビ（拭き終わってから見える）
    if (rust) {
      drawRust(ctx, rust, time);
      if (current === rust) drawRustMarkers(ctx, rust, time);
    }

    // 汚れ（いちばん上）
    if (dust) drawDust(ctx, dust, state.dustFade);

    // 取り付け先の目印 + 未設置の部品
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        const near = p.dragging && Math.hypot(p.x - p.targetX, p.y - p.targetY) <= (p.snapRadius ?? 46);
        const r = p.id === 'disc' ? RECORD_R + 2 : 20;
        drawSlotMarker(ctx, p.targetX, p.targetY, r, time, true, near);
      }
      for (const p of fit.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          if (p.id === 'disc') {
            // トレイでは小さく、取り付け先に近づくほど本来の大きさに
            const d = Math.hypot(p.x - p.targetX, p.y - p.targetY);
            const grow = p.dragging ? Math.min(1, Math.max(0, 1 - d / 220)) : 0;
            const r = TRAY_DISC_R + (RECORD_R - TRAY_DISC_R) * grow;
            drawDisc(ctx, r, 0);
          } else {
            ctx.scale(scale, scale);
            ctx.translate(0, 10);
            drawCartridge(ctx, 18);
          }
        });
      }
    }

    // 音符（いちばん手前）
    drawNotes(ctx, noteStrength, time);
  },
};
