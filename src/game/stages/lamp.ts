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
const CX = 180;
/** ほや（ガラスの筒）の上端と下端 */
const GLASS_TOP = 66;
const GLASS_BOTTOM = 254;
/** ほやの輪郭: [y, 半分の幅]。間はなめらかにつなぐ */
const GLASS_PROFILE: [number, number][] = [
  [66, 21],
  [74, 19],
  [114, 19],
  [132, 30],
  [150, 46],
  [176, 52],
  [200, 49],
  [220, 40],
  [234, 34],
  [254, 34],
];
/** 口金（芯を支える金具） */
const BURNER = { x: 118, y: 252, w: 124, h: 30 };
/** 油つぼ */
const FOUNT = { x: CX, y: 318, rx: 100, ry: 40 };
/** 台座の首と足 */
const NECK = { x: CX - 22, y: 352, w: 44, h: 28 };
const FOOT = { y: 376, h: 38, topHalf: 42, bottomHalf: 88 };
/** 芯（取り付け先） */
const WICK = { x: CX, y: 240, size: 16 };
/** 芯を上下させるつまみ（取り付け先） */
const KNOB = { x: 262, y: 268, r: 15 };
/** 炎の根元 */
const FLAME = { x: CX, y: 227 };

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** ほやの、その高さでの半分の幅（外なら 0） */
function glassHalf(y: number): number {
  if (y < GLASS_TOP || y > GLASS_BOTTOM) return 0;
  for (let i = 0; i < GLASS_PROFILE.length - 1; i++) {
    const [y0, h0] = GLASS_PROFILE[i];
    const [y1, h1] = GLASS_PROFILE[i + 1];
    if (y >= y0 && y <= y1) {
      const t = (y - y0) / (y1 - y0 || 1);
      return h0 + (h1 - h0) * smooth(t);
    }
  }
  return 0;
}

function insideGlass(x: number, y: number): boolean {
  const h = glassHalf(y);
  return h > 0 && Math.abs(x - CX) <= h;
}

function glassPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(CX - glassHalf(GLASS_TOP), GLASS_TOP);
  for (let y = GLASS_TOP; y <= GLASS_BOTTOM; y += 2) ctx.lineTo(CX - glassHalf(y), y);
  for (let y = GLASS_BOTTOM; y >= GLASS_TOP; y -= 2) ctx.lineTo(CX + glassHalf(y), y);
  ctx.closePath();
}

function fountPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(FOUNT.x, FOUNT.y, FOUNT.rx, FOUNT.ry, 0, 0, Math.PI * 2);
}

function footPath(ctx: CanvasRenderingContext2D): void {
  const { y, h, topHalf, bottomHalf } = FOOT;
  ctx.beginPath();
  ctx.moveTo(CX - topHalf, y);
  ctx.lineTo(CX + topHalf, y);
  ctx.quadraticCurveTo(CX + bottomHalf - 6, y + h * 0.45, CX + bottomHalf, y + h - 6);
  ctx.quadraticCurveTo(CX + bottomHalf + 2, y + h, CX + bottomHalf - 8, y + h);
  ctx.lineTo(CX - bottomHalf + 8, y + h);
  ctx.quadraticCurveTo(CX - bottomHalf - 2, y + h, CX - bottomHalf, y + h - 6);
  ctx.quadraticCurveTo(CX - bottomHalf + 6, y + h * 0.45, CX - topHalf, y);
  ctx.closePath();
}

function rustSpots() {
  return [
    { x: 124, y: 312, r: 18 },
    { x: 238, y: 318, r: 18 },
    { x: 172, y: 340, r: 18 },
    { x: 204, y: 398, r: 17 },
  ];
}

export function buildLampSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'soot',
      title: 'ガラスのすすを落とす',
      hint: '指でこすってすすを落とそう',
      rect: { x: CX - 56, y: GLASS_TOP - 2, w: 112, h: GLASS_BOTTOM - GLASS_TOP + 4 },
      cols: 16,
      rows: 26,
      inside: insideGlass,
      doneThreshold: 0.88,
    }),
    new PolishTask({
      id: 'brass',
      title: '真鍮の台を磨く',
      hint: '光っている輪の上で指を往復させよう',
      spots: rustSpots(),
      strokeFactor: 8,
    }),
    new FitTask({
      id: 'parts',
      title: '芯とつまみを取り付ける',
      hint: '下の部品を点線の位置までドラッグ',
      parts: [
        {
          id: 'wick',
          label: '芯',
          hitRadius: 38,
          trayX: 120,
          trayY: 498,
          targetX: WICK.x,
          targetY: WICK.y,
          size: WICK.size,
          snapRadius: 46,
        },
        {
          id: 'knob',
          label: 'つまみ',
          hitRadius: 38,
          trayX: 240,
          trayY: 498,
          targetX: KNOB.x,
          targetY: KNOB.y,
          size: KNOB.r,
          snapRadius: 44,
        },
      ],
    }),
    new FinalTask({
      id: 'light',
      title: '火を灯す',
      hint: 'つまみをタップして火を灯そう',
      x: KNOB.x,
      y: KNOB.y,
      hitRadius: 34,
      label: 'つまみ',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

/** 真鍮の色（左右に光が回り込む横グラデーション） */
function brassGradient(ctx: CanvasRenderingContext2D, x0: number, x1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#7a5a22');
  g.addColorStop(0.3, '#e2bd62');
  g.addColorStop(0.5, '#fbe4a0');
  g.addColorStop(0.72, '#c99a3e');
  g.addColorStop(1, '#6e4f1c');
  return g;
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(CX + 6, FOOT.y + FOOT.h + 4, FOOT.bottomHalf + 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 油つぼ・首・足。くすみは polished(0..1) で引いていく */
function drawBrassBase(ctx: CanvasRenderingContext2D, polished: number): void {
  const dull = 1 - polished;
  ctx.save();

  // 足
  footPath(ctx);
  ctx.fillStyle = brassGradient(ctx, CX - FOOT.bottomHalf, CX + FOOT.bottomHalf);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = vGradient(ctx, FOOT.y, FOOT.y + FOOT.h, [
    [0, 'rgba(255,240,200,0.18)'],
    [1, 'rgba(60,36,10,0.35)'],
  ]);
  ctx.fillRect(CX - FOOT.bottomHalf - 4, FOOT.y, FOOT.bottomHalf * 2 + 8, FOOT.h);
  // 足の縁の線
  ctx.strokeStyle = 'rgba(90,60,20,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(CX - FOOT.bottomHalf, FOOT.y + FOOT.h - 9);
  ctx.lineTo(CX + FOOT.bottomHalf, FOOT.y + FOOT.h - 9);
  ctx.stroke();
  ctx.fillStyle = `rgba(52,44,30,${(0.5 * dull).toFixed(3)})`;
  ctx.fillRect(CX - FOOT.bottomHalf - 4, FOOT.y, FOOT.bottomHalf * 2 + 8, FOOT.h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(58,36,10,0.8)';
  ctx.lineWidth = 2;
  footPath(ctx);
  ctx.stroke();

  // 首
  roundRect(ctx, NECK.x, NECK.y, NECK.w, NECK.h, 6);
  ctx.fillStyle = brassGradient(ctx, NECK.x, NECK.x + NECK.w);
  ctx.fill();
  ctx.fillStyle = `rgba(52,44,30,${(0.5 * dull).toFixed(3)})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,36,10,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 首の輪
  ctx.fillStyle = 'rgba(80,52,16,0.6)';
  ctx.fillRect(NECK.x - 3, NECK.y + NECK.h / 2 - 2, NECK.w + 6, 4);

  // 油つぼ
  fountPath(ctx);
  ctx.fillStyle = brassGradient(ctx, FOUNT.x - FOUNT.rx, FOUNT.x + FOUNT.rx);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 上の光と下の影
  ctx.fillStyle = vGradient(ctx, FOUNT.y - FOUNT.ry, FOUNT.y + FOUNT.ry, [
    [0, 'rgba(255,246,214,0.35)'],
    [0.45, 'rgba(255,246,214,0)'],
    [1, 'rgba(60,34,8,0.45)'],
  ]);
  ctx.fillRect(FOUNT.x - FOUNT.rx, FOUNT.y - FOUNT.ry, FOUNT.rx * 2, FOUNT.ry * 2);
  // 飾りの帯
  ctx.strokeStyle = 'rgba(110,72,22,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(FOUNT.x, FOUNT.y + 4, FOUNT.rx - 4, FOUNT.ry * 0.42, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  // ツヤの筋（磨くほど強く）
  ctx.fillStyle = `rgba(255,252,236,${(0.12 + polished * 0.3).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(FOUNT.x - 38, FOUNT.y - 16, 34, 8, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // くすみ
  ctx.fillStyle = `rgba(52,44,30,${(0.5 * dull).toFixed(3)})`;
  ctx.fillRect(FOUNT.x - FOUNT.rx, FOUNT.y - FOUNT.ry, FOUNT.rx * 2, FOUNT.ry * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(58,36,10,0.85)';
  ctx.lineWidth = 2;
  fountPath(ctx);
  ctx.stroke();

  ctx.restore();
}

/** 口金（芯を支える金具）と、つまみの軸 */
function drawBurner(ctx: CanvasRenderingContext2D, polished: number): void {
  const dull = 1 - polished;
  const { x, y, w, h } = BURNER;
  ctx.save();
  // つまみの軸
  ctx.fillStyle = brassGradient(ctx, x + w - 10, KNOB.x);
  roundRect(ctx, x + w - 8, KNOB.y - 4, KNOB.x - (x + w - 8), 8, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,36,10,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // 本体
  roundRect(ctx, x, y, w, h, 7);
  ctx.fillStyle = brassGradient(ctx, x, x + w);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 空気穴の列
  ctx.fillStyle = 'rgba(48,28,8,0.75)';
  for (let i = 0; i < 9; i++) {
    const hx = x + 14 + i * ((w - 28) / 8);
    ctx.beginPath();
    ctx.ellipse(hx, y + h * 0.62, 3.2, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,246,214,0.28)';
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = `rgba(52,44,30,${(0.45 * dull).toFixed(3)})`;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(58,36,10,0.85)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 7);
  ctx.stroke();
  ctx.restore();
}

/** ほや（ガラス）の本体。glow 0..1 で中から暖かく光る */
function drawGlassBack(ctx: CanvasRenderingContext2D, glow: number): void {
  ctx.save();
  glassPath(ctx);
  ctx.fillStyle = 'rgba(214,226,222,0.22)';
  ctx.fill();
  if (glow > 0) {
    const g = ctx.createRadialGradient(FLAME.x, FLAME.y - 18, 4, FLAME.x, FLAME.y - 30, 110);
    g.addColorStop(0, `rgba(255,226,150,${(0.55 * glow).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,170,70,${(0.12 * glow).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

function drawGlassFront(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 縁
  glassPath(ctx);
  ctx.strokeStyle = 'rgba(232,240,236,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 縦の映り込み
  ctx.save();
  glassPath(ctx);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 86; y <= 228; y += 2) {
    const px = CX - glassHalf(y) * 0.62;
    if (y === 86) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = 150; y <= 214; y += 2) {
    const px = CX + glassHalf(y) * 0.7;
    if (y === 150) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.stroke();
  ctx.restore();
  // 上の口の輪
  ctx.strokeStyle = 'rgba(236,244,240,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(CX, GLASS_TOP, glassHalf(GLASS_TOP), 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 芯: 真鍮の筒から白い布の芯がのぞく、四角い部品 */
function drawWickShape(ctx: CanvasRenderingContext2D, s: number, lit: boolean): void {
  // 布の芯
  ctx.fillStyle = '#f1e6cf';
  roundRect(ctx, -s * 0.42, -s * 0.9, s * 0.84, s * 1.1, 2);
  ctx.fill();
  // 織り目
  ctx.strokeStyle = 'rgba(150,128,96,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const yy = -s * 0.9 + i * s * 0.26;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, yy);
    ctx.lineTo(s * 0.42, yy);
    ctx.stroke();
  }
  // 先の焦げ
  ctx.fillStyle = lit ? '#3a2416' : '#6a4a30';
  roundRect(ctx, -s * 0.42, -s * 0.9, s * 0.84, s * 0.22, 2);
  ctx.fill();
  // 筒
  const g = ctx.createLinearGradient(-s * 0.7, 0, s * 0.7, 0);
  g.addColorStop(0, '#8a6426');
  g.addColorStop(0.45, '#f2d68a');
  g.addColorStop(1, '#7a5520');
  ctx.fillStyle = g;
  roundRect(ctx, -s * 0.7, 0, s * 1.4, s * 0.72, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,36,10,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

/** つまみ: ギザギザの縁がある丸い歯車形 */
function drawKnobShape(ctx: CanvasRenderingContext2D, r: number, angle: number): void {
  ctx.save();
  ctx.rotate(angle);
  const teeth = 14;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.84;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#fbe4a0');
  g.addColorStop(0.5, '#c99a3e');
  g.addColorStop(1, '#6e4f1c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,36,10,0.85)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  // 中心の座
  ctx.fillStyle = '#8a6426';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,250,230,0.4)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.34, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawSocket(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ctx.fillStyle = '#2a1808';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,8,2,0.8)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

/** ゆらめく炎 */
function drawFlame(ctx: CanvasRenderingContext2D, on: number, time: number): void {
  if (on <= 0) return;
  const sway = Math.sin(time / 170) * 2.2 + Math.sin(time / 67) * 0.8;
  const height = (30 + Math.sin(time / 120) * 3 + Math.sin(time / 47) * 1.5) * (0.4 + on * 0.6);
  const half = 8 * (0.6 + on * 0.4);
  const bx = FLAME.x;
  const by = FLAME.y;
  const tipX = bx + sway;
  const tipY = by - height;
  ctx.save();
  ctx.globalAlpha = Math.min(1, on * 1.4);
  ctx.shadowBlur = 24;
  ctx.shadowColor = 'rgba(255,170,60,0.9)';
  // 外側
  ctx.beginPath();
  ctx.moveTo(bx - half, by);
  ctx.bezierCurveTo(bx - half * 1.2, by - height * 0.45, tipX - 2, tipY + height * 0.25, tipX, tipY);
  ctx.bezierCurveTo(tipX + 2, tipY + height * 0.25, bx + half * 1.2, by - height * 0.45, bx + half, by);
  ctx.quadraticCurveTo(bx, by + 5, bx - half, by);
  const g = ctx.createLinearGradient(0, tipY, 0, by + 4);
  g.addColorStop(0, 'rgba(255,150,40,0.85)');
  g.addColorStop(0.55, 'rgba(255,196,80,0.95)');
  g.addColorStop(1, 'rgba(255,236,170,1)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  // 内側の明るい芯
  const ih = height * 0.55;
  ctx.beginPath();
  ctx.moveTo(bx - half * 0.45, by);
  ctx.quadraticCurveTo(bx - half * 0.5, by - ih * 0.6, bx + sway * 0.5, by - ih);
  ctx.quadraticCurveTo(bx + half * 0.5, by - ih * 0.6, bx + half * 0.45, by);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,252,236,0.95)';
  ctx.fill();
  // 根元の青み
  ctx.fillStyle = 'rgba(110,150,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(bx, by - 1, half * 0.55, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** ガラス越しに広がる暖かい光 */
function drawWarmLight(ctx: CanvasRenderingContext2D, on: number, time: number): void {
  if (on <= 0) return;
  const flicker = 0.92 + Math.sin(time / 130) * 0.05 + Math.sin(time / 53) * 0.03;
  const cy = FLAME.y - 34;
  const radius = 70 + on * 190;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(CX, cy, 8, CX, cy, radius);
  g.addColorStop(0, `rgba(255,214,140,${(0.42 * on * flicker).toFixed(3)})`);
  g.addColorStop(0.35, `rgba(255,170,80,${(0.18 * on * flicker).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(CX - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

export const lampStage: StageModule = {
  def: {
    id: 'lamp',
    order: 4,
    title: '石油ランプ',
    subtitle: '古道具屋の棚の奥にあった真鍮のランプ',
    caption: 'すすけたガラスと、くすんだ真鍮の台。芯に火を灯すと、部屋がやわらかな明かりに包まれる。',
    accent: '#f0a04b',
    finalCue: 'flame',
    // 縦長なので、ガラスの上から台座の下まで入るように切り出す
    thumbFocus: { x: -4, y: 54, w: 368, h: 368 },
  },

  build: buildLampSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const soot = findDust(steps, 'soot');
    const brass = findPolish(steps, 'brass');
    const fit = findFit(steps, 'parts');
    const light = findFinal(steps, 'light');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;

    const wickPlaced = fit?.isPlaced('wick') ?? false;
    const knobPlaced = fit?.isPlaced('knob') ?? false;
    const lit = light?.triggered ?? false;
    const fin = smooth(Math.min(1, Math.max(0, state.finale)));
    // 火を灯す工程の間は真っ暗に近く、灯ったら finale に合わせて明るさが戻る
    const dark = lit ? 1 - fin : current !== null && current === light ? 1 : 0;
    const flameOn = lit ? Math.min(1, state.finale * 2.5 + 0.3) : 0;
    const polished = brass?.progress ?? 0;

    // 部屋を暗くする（作業台ごと）
    if (dark > 0.001) {
      ctx.fillStyle = `rgba(6,4,2,${(0.62 * dark).toFixed(3)})`;
      ctx.fillRect(0, 0, 360, 560);
    }

    drawShadow(ctx);
    drawBrassBase(ctx, polished);
    drawBurner(ctx, polished);

    // サビ（拭き終わってから見える）
    if (brass) {
      drawRust(ctx, brass, time);
      if (current === brass) drawRustMarkers(ctx, brass, time);
    }

    // 取り付け穴
    if (!wickPlaced) drawSocket(ctx, WICK.x, BURNER.y + 2, 13, 4);
    if (!knobPlaced) drawSocket(ctx, KNOB.x, KNOB.y, 6, 6);

    // ガラスの奥側と芯・炎
    drawGlassBack(ctx, flameOn);
    if (wickPlaced) {
      ctx.save();
      ctx.translate(WICK.x, WICK.y);
      drawWickShape(ctx, WICK.size, lit);
      ctx.restore();
    }
    drawFlame(ctx, flameOn, time);
    drawGlassFront(ctx);

    // 暗い間はランプ本体も少し沈める（つまみだけ目立たせる）
    if (dark > 0.001) {
      ctx.fillStyle = `rgba(6,4,2,${(0.32 * dark).toFixed(3)})`;
      ctx.fillRect(0, 0, 360, 560);
    }

    if (knobPlaced) {
      const active = current !== null && current === light && !lit;
      ctx.save();
      ctx.translate(KNOB.x, KNOB.y);
      if (active) {
        const pulse = (Math.sin(time / 280) + 1) / 2;
        ctx.shadowBlur = 10 + pulse * 18;
        ctx.shadowColor = 'rgba(255,196,110,0.9)';
        ctx.fillStyle = `rgba(255,210,130,${(0.18 + pulse * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(0, 0, KNOB.r + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      const turn = lit ? Math.min(1, state.finale * 3) * 1.2 : 0;
      drawKnobShape(ctx, KNOB.r, turn - (light?.press ?? 0) * 0.3);
      ctx.restore();
    }

    // 暖かい光（炎とガラス越し）
    drawWarmLight(ctx, flameOn, time);

    // すす（いちばん上）
    if (soot) drawDust(ctx, soot, state.dustFade, '38,30,24');

    // 取り付け先の目印 + 未設置の部品
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        const near = p.dragging && Math.hypot(p.x - p.targetX, p.y - p.targetY) <= (p.snapRadius ?? 46);
        drawSlotMarker(ctx, p.targetX, p.targetY, (p.size ?? 16) + 8, time, true, near);
      }
      for (const p of fit.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          ctx.scale(scale, scale);
          if (p.id === 'wick') {
            // トレイでは中心が見た目の中心に来るよう少し下げる
            ctx.translate(0, WICK.size * 0.1);
            drawWickShape(ctx, (p.size ?? WICK.size) * 1.25, false);
          } else {
            drawKnobShape(ctx, (p.size ?? KNOB.r) * 1.2, 0);
          }
        });
      }
    }
  },
};
