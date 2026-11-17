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
const HEAD = { x: 132, y: 116, w: 96, h: 68, r: 10 };
const NECK = { x: 166, y: 182, w: 28, h: 14 };
const TORSO = { x: 122, y: 194, w: 116, h: 106, r: 12 };
const EYES = [
  { x: 158, y: 146 },
  { x: 202, y: 146 },
];
const EYE_R = 12;
const METER = { x: 180, y: 234, r: 20 };
const ANTENNA_TIP = { x: 180, y: 102 };
/** ぜんまいの鍵（胴の右横に出ている） */
const KEY = { x: 266, y: 291 };

/** 手足の取り付け先。左右は 60 以上離す */
const ARM_L = { x: 100, y: 226 };
const ARM_R = { x: 260, y: 226 };
const LEG_L = { x: 148, y: 334 };
const LEG_R = { x: 212, y: 334 };
const LIMB_SIZE = 26;

function insideRoundRect(
  x: number,
  y: number,
  b: { x: number; y: number; w: number; h: number; r: number },
): boolean {
  const left = b.x;
  const top = b.y;
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + b.r), right - b.r);
  const cy = Math.min(Math.max(y, top + b.r), bottom - b.r);
  return Math.hypot(x - cx, y - cy) <= b.r + 0.001;
}

/** 体（頭・首・胴）の形の中か */
function insideBody(x: number, y: number): boolean {
  if (insideRoundRect(x, y, HEAD)) return true;
  if (insideRoundRect(x, y, TORSO)) return true;
  return x >= NECK.x && x <= NECK.x + NECK.w && y >= NECK.y && y <= NECK.y + NECK.h;
}

function rustSpots() {
  return [
    { x: 152, y: 130, r: 16 }, // 頭の左上
    { x: 224, y: 210, r: 16 }, // 右の肩
    { x: 142, y: 282, r: 17 }, // 胴の左下
    { x: 212, y: 282, r: 17 }, // 胴の右下
  ];
}

export function buildRobotSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'dust',
      title: 'ホコリを拭き取る',
      hint: '指でこすって汚れを落とそう',
      rect: { x: TORSO.x - 4, y: HEAD.y - 4, w: TORSO.w + 8, h: TORSO.y + TORSO.h - HEAD.y + 8 },
      cols: 14,
      rows: 22,
      inside: insideBody,
      doneThreshold: 0.88,
    }),
    new PolishTask({
      id: 'rust',
      title: 'サビを磨く',
      hint: '光っている輪の上で指を往復させよう',
      spots: rustSpots(),
      strokeFactor: 8,
    }),
    new FitTask({
      id: 'limbs',
      title: '腕と足をはめる',
      hint: '下の部品を点線の位置までドラッグ',
      parts: [
        {
          id: 'arm-l',
          label: '左腕',
          hitRadius: 36,
          trayX: 62,
          trayY: 498,
          targetX: ARM_L.x,
          targetY: ARM_L.y,
          size: LIMB_SIZE,
          snapRadius: 44,
        },
        {
          id: 'leg-l',
          label: '左足',
          hitRadius: 36,
          trayX: 142,
          trayY: 498,
          targetX: LEG_L.x,
          targetY: LEG_L.y,
          size: LIMB_SIZE,
          snapRadius: 40,
        },
        {
          id: 'leg-r',
          label: '右足',
          hitRadius: 36,
          trayX: 222,
          trayY: 498,
          targetX: LEG_R.x,
          targetY: LEG_R.y,
          size: LIMB_SIZE,
          snapRadius: 40,
        },
        {
          id: 'arm-r',
          label: '右腕',
          hitRadius: 36,
          trayX: 302,
          trayY: 498,
          targetX: ARM_R.x,
          targetY: ARM_R.y,
          size: LIMB_SIZE,
          snapRadius: 44,
        },
      ],
    }),
    new FinalTask({
      id: 'wind',
      title: 'ぜんまいを巻く',
      hint: 'ぜんまいの鍵をタップ',
      x: KEY.x,
      y: KEY.y,
      hitRadius: 34,
      label: 'ぜんまい',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

/** ブリキの銀色（斜めのグラデーション） */
function tinGradient(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#eef1f3');
  g.addColorStop(0.35, '#b9c1c8');
  g.addColorStop(0.6, '#dde2e6');
  g.addColorStop(1, '#8a949d');
  return g;
}

function drawRivet(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2.6): void {
  ctx.fillStyle = 'rgba(40,30,30,0.45)';
  ctx.beginPath();
  ctx.arc(x + 0.6, y + 0.8, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9edf0';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(182, 370, 78, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAntenna(ctx: CanvasRenderingContext2D, blink: number): void {
  ctx.save();
  ctx.strokeStyle = '#9aa3ab';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(180, HEAD.y + 2);
  ctx.lineTo(ANTENNA_TIP.x, ANTENNA_TIP.y);
  ctx.stroke();
  // 根元
  ctx.fillStyle = '#7c868f';
  roundRect(ctx, 172, HEAD.y - 4, 16, 6, 3);
  ctx.fill();
  // 先の玉
  if (blink > 0) {
    ctx.shadowBlur = 14 * blink;
    ctx.shadowColor = `rgba(255,110,90,${0.9 * blink})`;
  }
  ctx.fillStyle = blink > 0 ? `rgb(${200 + 55 * blink},${70 + 60 * blink},${60 + 30 * blink})` : '#9a3a30';
  ctx.beginPath();
  ctx.arc(ANTENNA_TIP.x, ANTENNA_TIP.y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, eyeGlow: number): void {
  ctx.save();
  // 耳のボルト
  ctx.fillStyle = '#c9473b';
  ctx.beginPath();
  ctx.arc(HEAD.x - 1, 150, 7, 0, Math.PI * 2);
  ctx.arc(HEAD.x + HEAD.w + 1, 150, 7, 0, Math.PI * 2);
  ctx.fill();

  roundRect(ctx, HEAD.x, HEAD.y, HEAD.w, HEAD.h, HEAD.r);
  ctx.fillStyle = tinGradient(ctx, HEAD.x, HEAD.y, HEAD.w, HEAD.h);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 上の光
  ctx.fillStyle = vGradient(ctx, HEAD.y, HEAD.y + 26, [
    [0, 'rgba(255,255,255,0.45)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(HEAD.x, HEAD.y, HEAD.w, 26);
  // 額の青い帯
  ctx.fillStyle = '#3d6aa8';
  ctx.fillRect(HEAD.x, HEAD.y + 14, HEAD.w, 6);
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,44,52,0.7)';
  ctx.lineWidth = 2;
  roundRect(ctx, HEAD.x, HEAD.y, HEAD.w, HEAD.h, HEAD.r);
  ctx.stroke();

  // 目
  for (const e of EYES) {
    ctx.fillStyle = '#6f7880';
    ctx.beginPath();
    ctx.arc(e.x, e.y, EYE_R + 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    if (eyeGlow > 0) {
      ctx.shadowBlur = 20 * eyeGlow;
      ctx.shadowColor = `rgba(255,226,110,${0.95 * eyeGlow})`;
      const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, EYE_R);
      g.addColorStop(0, `rgba(255,252,220,${eyeGlow})`);
      g.addColorStop(0.55, `rgba(255,214,90,${0.6 + eyeGlow * 0.4})`);
      g.addColorStop(1, `rgba(220,150,40,${0.5 + eyeGlow * 0.5})`);
      ctx.fillStyle = '#2a323c';
      ctx.beginPath();
      ctx.arc(e.x, e.y, EYE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#2a323c';
    }
    ctx.beginPath();
    ctx.arc(e.x, e.y, EYE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ガラスのツヤ
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(e.x - 4, e.y - 4, 3.6, 2.4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 口（スリット）
  ctx.fillStyle = '#4a525b';
  roundRect(ctx, 158, 164, 44, 12, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,226,230,0.7)';
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 6; i++) {
    const x = 158 + (44 / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, 166);
    ctx.lineTo(x, 174);
    ctx.stroke();
  }

  drawRivet(ctx, HEAD.x + 8, HEAD.y + HEAD.h - 8, 2.2);
  drawRivet(ctx, HEAD.x + HEAD.w - 8, HEAD.y + HEAD.h - 8, 2.2);
  ctx.restore();
}

function drawNeck(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = '#7c868f';
  ctx.fillRect(NECK.x, NECK.y, NECK.w, NECK.h);
  ctx.strokeStyle = 'rgba(40,44,52,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = NECK.y + 3 + i * 4;
    ctx.beginPath();
    ctx.moveTo(NECK.x, y);
    ctx.lineTo(NECK.x + NECK.w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, powered: boolean, time: number, glow: number): void {
  ctx.save();
  roundRect(ctx, TORSO.x, TORSO.y, TORSO.w, TORSO.h, TORSO.r);
  ctx.fillStyle = vGradient(ctx, TORSO.y, TORSO.y + TORSO.h, [
    [0, '#dc5a4b'],
    [0.5, '#b93a2f'],
    [1, '#86261f'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 横の光
  const side = ctx.createLinearGradient(TORSO.x, 0, TORSO.x + TORSO.w, 0);
  side.addColorStop(0, 'rgba(255,220,200,0.28)');
  side.addColorStop(0.3, 'rgba(255,220,200,0)');
  side.addColorStop(1, 'rgba(40,0,0,0.25)');
  ctx.fillStyle = side;
  ctx.fillRect(TORSO.x, TORSO.y, TORSO.w, TORSO.h);
  // 腰の帯
  ctx.fillStyle = '#3d6aa8';
  ctx.fillRect(TORSO.x, TORSO.y + TORSO.h - 16, TORSO.w, 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,14,10,0.75)';
  ctx.lineWidth = 2;
  roundRect(ctx, TORSO.x, TORSO.y, TORSO.w, TORSO.h, TORSO.r);
  ctx.stroke();

  // 胸の銀の板
  const plate = { x: 144, y: 206, w: 72, h: 66 };
  roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 8);
  ctx.fillStyle = tinGradient(ctx, plate.x, plate.y, plate.w, plate.h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,44,52,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // メーター（半円）
  ctx.fillStyle = '#f6f0dc';
  ctx.beginPath();
  ctx.arc(METER.x, METER.y, METER.r, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a525b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(METER.x + Math.cos(a) * METER.r * 0.72, METER.y + Math.sin(a) * METER.r * 0.72);
    ctx.lineTo(METER.x + Math.cos(a) * METER.r * 0.92, METER.y + Math.sin(a) * METER.r * 0.92);
    ctx.stroke();
  }
  const needle = powered ? 0.5 + Math.sin(time / 260) * 0.32 : 0.12;
  const na = Math.PI + needle * Math.PI;
  ctx.strokeStyle = '#c93b2b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(METER.x, METER.y);
  ctx.lineTo(METER.x + Math.cos(na) * METER.r * 0.82, METER.y + Math.sin(na) * METER.r * 0.82);
  ctx.stroke();
  ctx.fillStyle = '#4a525b';
  ctx.beginPath();
  ctx.arc(METER.x, METER.y, 3, 0, Math.PI * 2);
  ctx.fill();

  // 小さなランプ3つ
  const lamps = ['255,90,70', '255,206,80', '110,220,120'];
  for (let i = 0; i < 3; i++) {
    const x = 164 + i * 16;
    const y = 256;
    const on = powered ? glow * (0.55 + 0.45 * ((Math.sin(time / 220 + i * 2.1) + 1) / 2)) : 0;
    ctx.save();
    if (on > 0) {
      ctx.shadowBlur = 10 * on;
      ctx.shadowColor = `rgba(${lamps[i]},${on})`;
      ctx.fillStyle = `rgba(${lamps[i]},${0.35 + on * 0.65})`;
    } else {
      ctx.fillStyle = 'rgba(70,60,60,0.85)';
    }
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // リベット
  drawRivet(ctx, TORSO.x + 9, TORSO.y + 9);
  drawRivet(ctx, TORSO.x + TORSO.w - 9, TORSO.y + 9);
  drawRivet(ctx, TORSO.x + 9, TORSO.y + TORSO.h - 26);
  drawRivet(ctx, TORSO.x + TORSO.w - 9, TORSO.y + TORSO.h - 26);
  ctx.restore();
}

/** 手足の付け根の穴（まだ付いていないとき） */
function drawSocket(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ctx.fillStyle = '#2a1a18';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,206,212,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * 腕（細い・先にはさみ型の手）。原点 = 取り付け先の中心。
 * side: -1 = 左腕, 1 = 右腕。swing: 振りの角度(rad)
 */
function drawArmShape(ctx: CanvasRenderingContext2D, side: number, swing: number): void {
  ctx.save();
  // 胴へつなぐ肩の軸（内側へ伸びる）
  ctx.fillStyle = '#7c868f';
  roundRect(ctx, side < 0 ? 0 : -26, -31, 26, 8, 4);
  ctx.fill();

  // 肩を支点に少し外へ開く＋振る
  ctx.translate(0, -28);
  ctx.rotate(side * 0.08 + swing);
  ctx.translate(0, 28);

  // 上腕
  roundRect(ctx, -9, -36, 18, 42, 8);
  ctx.fillStyle = vGradient(ctx, -36, 6, [
    [0, '#5b8bcc'],
    [1, '#2f5590'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,30,60,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 肩のボルト
  ctx.fillStyle = '#dfe4e8';
  ctx.beginPath();
  ctx.arc(0, -28, 4, 0, Math.PI * 2);
  ctx.fill();
  // ひじ
  ctx.fillStyle = '#9aa3ab';
  ctx.beginPath();
  ctx.arc(0, 8, 7, 0, Math.PI * 2);
  ctx.fill();
  // 前腕
  roundRect(ctx, -7, 10, 14, 17, 5);
  ctx.fillStyle = tinGradient(ctx, -7, 10, 14, 17);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,44,52,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // はさみ型の手（下が開いている）
  ctx.strokeStyle = '#c9473b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 33, 7, Math.PI / 2 + 0.7, Math.PI / 2 - 0.7 + Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * 足（太い・つま先が外向きの靴）。原点 = 取り付け先の中心。
 * side: -1 = 左足, 1 = 右足
 */
function drawLegShape(ctx: CanvasRenderingContext2D, side: number): void {
  ctx.save();
  // もも〜すね（上の端は胴の後ろに隠れる）
  roundRect(ctx, -13, -40, 26, 60, 6);
  ctx.fillStyle = vGradient(ctx, -40, 20, [
    [0, '#4677ba'],
    [1, '#264a80'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,30,60,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // ひざの帯
  ctx.fillStyle = '#9aa3ab';
  ctx.fillRect(-13, -6, 26, 6);
  drawRivet(ctx, 0, -3, 2);
  // 靴（つま先は外向き）
  const toe = side < 0 ? -24 : -14;
  roundRect(ctx, toe, 18, 38, 14, 6);
  ctx.fillStyle = tinGradient(ctx, toe, 18, 38, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,44,52,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawLimbPart(ctx: CanvasRenderingContext2D, id: string, swing = 0): void {
  if (id === 'arm-l') drawArmShape(ctx, -1, swing);
  else if (id === 'arm-r') drawArmShape(ctx, 1, swing);
  else if (id === 'leg-l') drawLegShape(ctx, -1);
  else drawLegShape(ctx, 1);
}

/** ぜんまいの鍵。angle は軸まわりの回転（横から見ると羽が縮んで見える） */
function drawKey(ctx: CanvasRenderingContext2D, angle: number, active: boolean, time: number): void {
  ctx.save();
  // 軸
  ctx.fillStyle = '#8a7444';
  ctx.fillRect(TORSO.x + TORSO.w - 2, KEY.y - 3, KEY.x - (TORSO.x + TORSO.w) - 2, 6);

  ctx.translate(KEY.x, KEY.y);
  if (active) {
    const pulse = (Math.sin(time / 280) + 1) / 2;
    ctx.shadowBlur = 10 + pulse * 16;
    ctx.shadowColor = 'rgba(255,214,120,0.9)';
  }
  const c = Math.cos(angle);
  const sy = Math.sign(c || 1) * Math.max(0.14, Math.abs(c));
  ctx.scale(1, sy);
  const g = ctx.createLinearGradient(-8, -18, 8, 18);
  g.addColorStop(0, '#f6dc8a');
  g.addColorStop(0.5, '#c79a3e');
  g.addColorStop(1, '#8a6626');
  ctx.fillStyle = g;
  // 羽（8の字）
  ctx.beginPath();
  ctx.ellipse(0, -9, 7, 8.5, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 9, 7, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(80,56,16,0.75)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -9, 7, 8.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 9, 7, 8.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 羽の穴
  ctx.fillStyle = 'rgba(60,40,12,0.7)';
  ctx.beginPath();
  ctx.ellipse(0, -10, 2.8, 3.4, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 10, 2.8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // 中心
  ctx.fillStyle = '#e8c87d';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const robotStage: StageModule = {
  def: {
    id: 'robot',
    order: 5,
    title: 'ブリキのロボット',
    subtitle: '押し入れの箱で眠っていたぜんまい仕掛け',
    caption: '銀の頭に赤い胴、青い手足のブリキのおもちゃ。ぜんまいを巻くと、目を光らせてカシャカシャ歩き出す。',
    accent: '#e0645a',
    finalCue: 'walk',
  },

  build: buildRobotSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const dust = findDust(steps, 'dust');
    const rust = findPolish(steps, 'rust');
    const fit = findFit(steps, 'limbs');
    const wind = findFinal(steps, 'wind');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;

    const placed = (id: string) => fit?.isPlaced(id) ?? false;
    const powered = wind?.triggered ?? false;

    // 動き出しの強さ（巻いた直後から少しずつ大きくなる）
    const amp = powered ? Math.min(1, state.finale * 1.6 + 0.15) : 0;
    const eyeGlow = powered ? Math.min(1, state.finale * 2.2 + 0.25) * (0.88 + Math.sin(time / 200) * 0.12) : 0;
    const phase = time / 150;
    const step = Math.sin(phase);
    const bob = -Math.abs(step) * 3 * amp;
    const liftL = Math.max(0, step) * 5 * amp;
    const liftR = Math.max(0, -step) * 5 * amp;
    const swing = step * 0.18 * amp;
    const keyAngle = powered ? time / 180 : 0;
    const blink = powered ? eyeGlow * ((Math.sin(time / 160) + 1) / 2) : 0;

    drawShadow(ctx);

    // 足（胴の後ろ。体の上下とは別に交互に持ち上がる）
    if (placed('leg-l')) {
      ctx.save();
      ctx.translate(LEG_L.x, LEG_L.y - liftL);
      drawLimbPart(ctx, 'leg-l');
      ctx.restore();
    }
    if (placed('leg-r')) {
      ctx.save();
      ctx.translate(LEG_R.x, LEG_R.y - liftR);
      drawLimbPart(ctx, 'leg-r');
      ctx.restore();
    }

    // 上半身（巻いたあとは小さく上下に揺れる）
    ctx.save();
    ctx.translate(0, bob);
    drawAntenna(ctx, blink);
    drawNeck(ctx);
    drawTorso(ctx, powered, time, eyeGlow);
    drawHead(ctx, eyeGlow);

    // 付け根の穴
    if (!placed('arm-l')) drawSocket(ctx, TORSO.x + 3, ARM_L.y - 26, 4, 7);
    if (!placed('arm-r')) drawSocket(ctx, TORSO.x + TORSO.w - 3, ARM_R.y - 26, 4, 7);
    if (!placed('leg-l')) drawSocket(ctx, LEG_L.x, TORSO.y + TORSO.h - 1, 11, 4);
    if (!placed('leg-r')) drawSocket(ctx, LEG_R.x, TORSO.y + TORSO.h - 1, 11, 4);

    // 腕
    if (placed('arm-l')) {
      ctx.save();
      ctx.translate(ARM_L.x, ARM_L.y);
      drawLimbPart(ctx, 'arm-l', swing);
      ctx.restore();
    }
    if (placed('arm-r')) {
      ctx.save();
      ctx.translate(ARM_R.x, ARM_R.y);
      drawLimbPart(ctx, 'arm-r', -swing);
      ctx.restore();
    }

    drawKey(ctx, keyAngle, current === wind && !powered, time);

    // サビ（拭き終わってから見える）
    if (rust) {
      drawRust(ctx, rust, time);
      if (current === rust) drawRustMarkers(ctx, rust, time);
    }
    ctx.restore();

    // 汚れ（いちばん上）
    if (dust) drawDust(ctx, dust, state.dustFade);

    // 取り付け先の目印 + 未設置の部品
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        const near = p.dragging && Math.hypot(p.x - p.targetX, p.y - p.targetY) <= (p.snapRadius ?? 46);
        drawSlotMarker(ctx, p.targetX, p.targetY, (p.size ?? 20) + 6, time, true, near);
      }
      for (const p of fit.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          ctx.scale(scale, scale);
          drawLimbPart(ctx, p.id);
        });
      }
    }
  },
};
