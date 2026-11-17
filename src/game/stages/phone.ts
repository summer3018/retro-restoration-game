import {
  drawDust,
  drawHaze,
  drawRustMarkers,
  findDust,
  findFit,
  findPolish,
  findRotate,
  roundRect,
  vGradient,
  withPartTransform,
  type VisualState,
} from '../art';
import type { StageModule } from '../stage';
import { FitTask, PolishTask, RotateTask, ScrubMask, type RepairStep } from '../tasks';

/* ---------------- 配置（論理座標） ---------------- */
/** 本体（上がせまい台形） */
const BODY = { top: 168, bottom: 372, topL: 84, topR: 276, botL: 42, botR: 318, r: 20 };
/** 受話器を置く台（フック）の柱 */
const POSTS = [
  { x: 100, y: 146, w: 32, h: 26 },
  { x: 260, y: 146, w: 32, h: 26 },
];
/** 受話器の置き場所（中心） */
const RECEIVER = { x: 180, y: 140 };
/** ダイヤル */
const DIAL = { x: 180, y: 284, r: 64, holeR: 47, hole: 10.5, inner: 30, label: 26 };
/** 指止め（フィンガーストップ）の向き。指穴は ここから左回りに並ぶ */
const STOP_A = Math.PI / 3;
const HOLE_STEP = Math.PI / 6;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function holeAngle(k: number): number {
  return STOP_A - (k + 1) * HOLE_STEP;
}

function edgesAt(y: number): { left: number; right: number } {
  const t = (y - BODY.top) / (BODY.bottom - BODY.top);
  return {
    left: BODY.topL + (BODY.botL - BODY.topL) * t,
    right: BODY.topR + (BODY.botR - BODY.topR) * t,
  };
}

function insideBody(x: number, y: number): boolean {
  for (const p of POSTS) {
    if (Math.abs(x - p.x) <= p.w / 2 && y >= p.y && y <= p.y + p.h) return true;
  }
  if (y < BODY.top || y > BODY.bottom) return false;
  const { left, right } = edgesAt(y);
  return x >= left && x <= right;
}

function bodyPath(ctx: CanvasRenderingContext2D, dx = 0, dy = 0): void {
  const r = BODY.r;
  ctx.beginPath();
  ctx.moveTo((BODY.topL + BODY.topR) / 2 + dx, BODY.top + dy);
  ctx.arcTo(BODY.topR + dx, BODY.top + dy, BODY.botR + dx, BODY.bottom + dy, r);
  ctx.arcTo(BODY.botR + dx, BODY.bottom + dy, BODY.botL + dx, BODY.bottom + dy, r);
  ctx.arcTo(BODY.botL + dx, BODY.bottom + dy, BODY.topL + dx, BODY.top + dy, r);
  ctx.arcTo(BODY.topL + dx, BODY.top + dy, BODY.topR + dx, BODY.top + dy, r);
  ctx.closePath();
}

function hazeSpots() {
  // 数字盤の指穴の下（4か所）。指止めのまわりは避ける
  return [1, 3, 6, 8].map((k) => {
    const a = holeAngle(k);
    return { x: DIAL.x + Math.cos(a) * DIAL.holeR, y: DIAL.y + Math.sin(a) * DIAL.holeR, r: 17 };
  });
}

export function buildPhoneSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'dust',
      title: 'ホコリを拭き取る',
      hint: '指でこすって汚れを落とそう',
      rect: { x: BODY.botL - 4, y: POSTS[0].y - 4, w: BODY.botR - BODY.botL + 8, h: BODY.bottom - POSTS[0].y + 8 },
      cols: 30,
      rows: 22,
      inside: insideBody,
      doneThreshold: 0.88,
    }),
    new PolishTask({
      id: 'haze',
      title: '数字盤のくもりを磨く',
      hint: '光っている輪の上で指を往復させよう',
      spots: hazeSpots(),
      strokeFactor: 8,
    }),
    new FitTask({
      id: 'receiver',
      title: '受話器を置く',
      hint: '受話器を点線の位置までドラッグ',
      parts: [
        {
          id: 'receiver',
          label: '受話器',
          hitRadius: 64, // 横長の受話器の両端をつまんでも掴めるように広めにする
          trayX: 180,
          trayY: 498,
          targetX: RECEIVER.x,
          targetY: RECEIVER.y,
          size: 1,
          snapRadius: 70,
        },
      ],
    }),
    new RotateTask({
      id: 'dial',
      title: 'ダイヤルを回す',
      hint: 'ダイヤルに指をのせて、ぐるっと回そう',
      x: DIAL.x,
      y: DIAL.y,
      hitRadius: 72,
      turns: 1.25,
      label: 'ダイヤル',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

/** 黒い艶のある本体。shine: 0=くすんでいる, 1=ツヤツヤ */
function drawBody(ctx: CanvasRenderingContext2D, shine: number): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  bodyPath(ctx, 6, 12);
  ctx.fill();

  // 台座
  ctx.fillStyle = '#121214';
  roundRect(ctx, BODY.botL - 4, BODY.bottom - 14, BODY.botR - BODY.botL + 8, 20, 8);
  ctx.fill();

  // フックの柱
  for (const p of POSTS) {
    roundRect(ctx, p.x - p.w / 2, p.y, p.w, p.h + 8, 8);
    ctx.fillStyle = vGradient(ctx, p.y, p.y + p.h, [
      [0, '#3b3b40'],
      [1, '#141416'],
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 受け口のくぼみ
    ctx.fillStyle = '#0a0a0b';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, p.w / 2 - 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 本体
  bodyPath(ctx);
  ctx.fillStyle = vGradient(ctx, BODY.top, BODY.bottom, [
    [0, '#3c3c42'],
    [0.35, '#1d1d21'],
    [1, '#09090a'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 上からの光
  ctx.fillStyle = vGradient(ctx, BODY.top, BODY.top + 60, [
    [0, `rgba(255,255,255,${(0.08 + 0.14 * shine).toFixed(3)})`],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(BODY.botL, BODY.top, BODY.botR - BODY.botL, 60);
  // 左上の映り込み
  const g = ctx.createRadialGradient(112, 196, 2, 112, 196, 60);
  g.addColorStop(0, `rgba(255,255,255,${(0.05 + 0.28 * shine).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(112, 200, 46, 22, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // 右側の縦のツヤ
  ctx.strokeStyle = `rgba(255,255,255,${(0.03 + 0.14 * shine).toFixed(3)})`;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(268, 186);
  ctx.lineTo(296, 344);
  ctx.stroke();
  // くすみ（ホコリが残っている間の灰色の膜）
  const dull = 1 - shine;
  if (dull > 0.01) {
    ctx.fillStyle = `rgba(150,146,140,${(0.28 * dull).toFixed(3)})`;
    ctx.fillRect(BODY.botL, BODY.top, BODY.botR - BODY.botL, BODY.bottom - BODY.top);
  }
  ctx.restore();

  bodyPath(ctx);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** 数字盤（固定）・指穴の板（angle だけ回る）・中央の白い円・指止め（固定） */
function drawDial(ctx: CanvasRenderingContext2D, angle: number): void {
  ctx.save();
  ctx.translate(DIAL.x, DIAL.y);

  // くぼみ
  ctx.fillStyle = '#060607';
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.r + 5, 0, Math.PI * 2);
  ctx.fill();
  const rim = ctx.createLinearGradient(-DIAL.r, -DIAL.r, DIAL.r, DIAL.r);
  rim.addColorStop(0, '#d9d9dc');
  rim.addColorStop(0.5, '#6d6d72');
  rim.addColorStop(1, '#bdbdc2');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 数字盤（回らない）
  ctx.fillStyle = '#efe8d8';
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2622';
  ctx.font = 'bold 11px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k < DIGITS.length; k++) {
    const a = holeAngle(k);
    ctx.fillText(DIGITS[k], Math.cos(a) * DIAL.holeR, Math.sin(a) * DIAL.holeR + 0.5);
  }

  // 指穴の板（回る）
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.r, 0, Math.PI * 2);
  ctx.moveTo(DIAL.inner, 0);
  ctx.arc(0, 0, DIAL.inner, 0, Math.PI * 2);
  for (let k = 0; k < DIGITS.length; k++) {
    const a = holeAngle(k);
    const hx = Math.cos(a) * DIAL.holeR;
    const hy = Math.sin(a) * DIAL.holeR;
    ctx.moveTo(hx + DIAL.hole, hy);
    ctx.arc(hx, hy, DIAL.hole, 0, Math.PI * 2);
  }
  const plate = ctx.createLinearGradient(-DIAL.r, -DIAL.r, DIAL.r, DIAL.r);
  plate.addColorStop(0, '#45454b');
  plate.addColorStop(0.5, '#1a1a1d');
  plate.addColorStop(1, '#0d0d0f');
  ctx.fillStyle = plate;
  ctx.fill('evenodd');
  // 指穴のふち
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < DIGITS.length; k++) {
    const a = holeAngle(k);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * DIAL.holeR, Math.sin(a) * DIAL.holeR, DIAL.hole, Math.PI * 0.9, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.restore();

  // 板のツヤ（回らない光の映り込み）
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.r - 4, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();

  // 中央の白い円（回らない）
  ctx.fillStyle = '#0b0b0c';
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.inner, 0, Math.PI * 2);
  ctx.fill();
  const label = ctx.createRadialGradient(-6, -8, 2, 0, 0, DIAL.label);
  label.addColorStop(0, '#ffffff');
  label.addColorStop(1, '#dcd8cf');
  ctx.fillStyle = label;
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.label, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,60,48,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.label - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,84,76,0.55)';
  ctx.lineWidth = 1.2;
  for (const ly of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(-12, ly);
    ctx.lineTo(12, ly);
    ctx.stroke();
  }

  // 指止め（回らない）
  ctx.save();
  ctx.rotate(STOP_A);
  const metal = ctx.createLinearGradient(0, -4, 0, 4);
  metal.addColorStop(0, '#f2f2f4');
  metal.addColorStop(1, '#8a8a90');
  ctx.fillStyle = metal;
  roundRect(ctx, DIAL.holeR - 6, -3.5, DIAL.r - DIAL.holeR + 16, 7, 3.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/** 受話器（中心が原点。横 約216・高さ 約44） */
function drawReceiverShape(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 持ち手（ゆるいアーチ）
  ctx.beginPath();
  ctx.moveTo(-84, -2);
  ctx.quadraticCurveTo(0, -26, 84, -2);
  ctx.lineTo(84, 12);
  ctx.quadraticCurveTo(0, -8, -84, 12);
  ctx.closePath();
  ctx.fillStyle = vGradient(ctx, -20, 12, [
    [0, '#4a4a50'],
    [1, '#101012'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 耳あて（左）と送話口（右）
  for (const sx of [-82, 82]) {
    ctx.beginPath();
    ctx.ellipse(sx, 8, 26, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = vGradient(ctx, -8, 24, [
      [0, '#46464c'],
      [0.6, '#18181b'],
      [1, '#070708'],
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx - 8, 1, 10, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 持ち手のツヤ
  ctx.strokeStyle = 'rgba(255,255,255,0.26)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-50, -8);
  ctx.quadraticCurveTo(0, -20, 50, -8);
  ctx.stroke();
  ctx.restore();
}

/** 受話器の置き場所の点線 */
function drawReceiverSlot(ctx: CanvasRenderingContext2D, time: number, near: boolean): void {
  const pulse = (Math.sin(time / 300) + 1) / 2;
  ctx.save();
  ctx.translate(RECEIVER.x, RECEIVER.y);
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeStyle = near ? 'rgba(255,226,150,0.85)' : `rgba(255,222,160,${(0.35 + pulse * 0.4).toFixed(3)})`;
  const grow = (near ? 4 : 0) + pulse * 2;
  roundRect(ctx, -112 - grow, -22 - grow, 224 + grow * 2, 50 + grow * 2, 24);
  ctx.stroke();
  ctx.restore();
}

/** 受話器から本体へのびるカールコード */
function drawCord(ctx: CanvasRenderingContext2D, fromX: number, fromY: number): void {
  const toX = 58;
  const toY = 300;
  const cx = 26;
  const cy = (fromY + toY) / 2;
  ctx.save();
  ctx.strokeStyle = '#141416';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * cx + t * t * toX;
    const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * cy + t * t * toY;
    const coil = t > 0.06 && t < 0.94 ? Math.sin(t * Math.PI * 28) * 4 : 0;
    if (i === 0) ctx.moveTo(x + coil, y);
    else ctx.lineTo(x + coil, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** ベルが鳴っている振動の線「((  ))」 */
function drawRinging(ctx: CanvasRenderingContext2D, time: number, strength: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6;
  const y = 214;
  const sides = [
    { cx: 74, from: Math.PI - 0.55, to: Math.PI + 0.55 },
    { cx: 286, from: -0.55, to: 0.55 },
  ];
  for (let i = 0; i < 3; i++) {
    const phase = (time / 640 + i / 3) % 1;
    const r = 12 + phase * 30;
    const a = (1 - phase) * 0.8 * strength;
    ctx.strokeStyle = `rgba(255,226,160,${a.toFixed(3)})`;
    for (const s of sides) {
      ctx.beginPath();
      ctx.arc(s.cx, y, r, s.from, s.to);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 回す工程の間だけ出す「回せる」目印（光る輪・矢印・進み具合） */
function drawRotateGuide(ctx: CanvasRenderingContext2D, task: RotateTask, time: number): void {
  const pulse = (Math.sin(time / 300) + 1) / 2;
  ctx.save();
  ctx.translate(DIAL.x, DIAL.y);
  ctx.lineCap = 'round';

  // 光る輪
  ctx.shadowBlur = 10 + pulse * 12;
  ctx.shadowColor = 'rgba(255,200,120,0.8)';
  ctx.strokeStyle = `rgba(255,214,140,${(0.3 + pulse * 0.4).toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, DIAL.r + 8 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 進み具合
  if (task.progress > 0) {
    ctx.strokeStyle = 'rgba(255,236,190,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, DIAL.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * task.progress);
    ctx.stroke();
  }

  // 右回りの矢印（ダイヤルの上側）
  if (!task.turning) {
    const R = DIAL.r + 17;
    const a0 = -Math.PI * 0.78 + pulse * 0.12;
    const a1 = -Math.PI * 0.3 + pulse * 0.12;
    ctx.strokeStyle = `rgba(255,226,160,${(0.55 + pulse * 0.4).toFixed(3)})`;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    ctx.stroke();
    const tx = Math.cos(a1) * R;
    const ty = Math.sin(a1) * R;
    const dir = a1 + Math.PI / 2; // 接線の向き
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(dir) * 9, ty + Math.sin(dir) * 9);
    ctx.lineTo(tx + Math.cos(dir + 2.4) * 8, ty + Math.sin(dir + 2.4) * 8);
    ctx.lineTo(tx + Math.cos(dir - 2.4) * 8, ty + Math.sin(dir - 2.4) * 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export const phoneStage: StageModule = {
  def: {
    id: 'phone',
    order: 7,
    title: '黒電話',
    subtitle: '実家の玄関で鳴っていたダイヤル式の電話',
    caption: 'ツヤのある黒い本体に、指で回すダイヤル。回し終えると、ジリリンと元気なベルが鳴る。',
    accent: '#d0705a',
    finalCue: 'bell',
  },

  build: buildPhoneSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const dust = findDust(steps, 'dust');
    const haze = findPolish(steps, 'haze');
    const fit = findFit(steps, 'receiver');
    const dial = findRotate(steps, 'dial');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;

    const receiverPlaced = fit?.isPlaced('receiver') ?? false;
    const ringing = (dial?.isDone ?? false) && state.finale > 0;

    // ツヤ: ホコリが落ちるほど黒く光る
    const dustLeft = dust ? (1 - dust.progress) * state.dustFade : 0;
    const shine = dust && dust.isDone ? 1 : 1 - Math.min(1, dustLeft);

    drawBody(ctx, shine);
    drawDial(ctx, dial?.angle ?? 0);

    // 数字盤のくもり（ダイヤルの中だけ）
    if (haze) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(DIAL.x, DIAL.y, DIAL.r, 0, Math.PI * 2);
      ctx.clip();
      drawHaze(ctx, haze, time);
      ctx.restore();
      if (current === haze) drawRustMarkers(ctx, haze, time);
    }

    // ホコリ（本体の形に切り抜いて描く）
    if (dust) {
      ctx.save();
      bodyPath(ctx);
      for (const p of POSTS) ctx.rect(p.x - p.w / 2, p.y, p.w, p.h);
      ctx.clip();
      drawDust(ctx, dust, state.dustFade, '150,146,138');
      ctx.restore();
    }

    // 置いた受話器（鳴っている間は小刻みに揺れる）
    if (receiverPlaced) {
      let dx = 0;
      let dy = 0;
      let rot = 0;
      if (ringing) {
        const amp = 3.2 * (1 - 0.65 * state.finale);
        dx = Math.sin(time / 26) * amp;
        dy = -Math.abs(Math.sin(time / 41)) * amp * 0.8;
        rot = Math.sin(time / 31) * 0.022 * (amp / 3.2);
      }
      drawCord(ctx, RECEIVER.x - 82 + dx, RECEIVER.y + 20 + dy);
      ctx.save();
      ctx.translate(RECEIVER.x + dx, RECEIVER.y + dy);
      ctx.rotate(rot);
      drawReceiverShape(ctx);
      ctx.restore();
    }

    if (ringing) drawRinging(ctx, time, 1 - 0.4 * state.finale);

    // 回す工程の目印
    if (dial && current === dial && !dial.isDone) drawRotateGuide(ctx, dial, time);

    // 受話器の置き場所 + トレイの受話器
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        const near = p.dragging && Math.hypot(p.x - p.targetX, p.y - p.targetY) <= (p.snapRadius ?? 46);
        drawReceiverSlot(ctx, time, near);
      }
      for (const p of fit.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          ctx.scale(scale, scale);
          drawReceiverShape(ctx);
        });
      }
    }
  },
};
