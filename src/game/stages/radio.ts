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
const BODY = { x: 38, y: 126, w: 288, h: 200, r: 18 };
const GRILLE = { x: 112, y: 226, r: 60 };
const WINDOW = { x: 186, y: 150, w: 128, h: 46 };
const DIAL = { x: 206, y: 272, r: 25 };
const KNOB = { x: 262, y: 272, r: 19 };
const POWER = { x: 302, y: 272, r: 17 };
const LAMP = { x: 302, y: 220, r: 8 };

function insideBody(x: number, y: number): boolean {
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

function rustSpots() {
  const spots: { x: number; y: number; r: number }[] = [];
  const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const a of angles) {
    spots.push({ x: GRILLE.x + Math.cos(a) * GRILLE.r, y: GRILLE.y + Math.sin(a) * GRILLE.r, r: 19 });
  }
  return spots;
}

export function buildRadioSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'dust',
      title: 'ホコリを拭き取る',
      hint: '指でこすって汚れを落とそう',
      rect: { x: BODY.x - 4, y: BODY.y - 4, w: BODY.w + 8, h: BODY.h + 8 },
      cols: 30,
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
      id: 'parts',
      title: 'ダイヤルを取り付ける',
      hint: '下の部品を点線の位置までドラッグ',
      parts: [
        {
          id: 'dial',
          label: 'ダイヤル',
          hitRadius: 42,
          trayX: 110,
          trayY: 498,
          targetX: DIAL.x,
          targetY: DIAL.y,
          size: DIAL.r,
          snapRadius: 48,
        },
        {
          id: 'knob',
          label: 'つまみ',
          hitRadius: 38,
          trayX: 232,
          trayY: 498,
          targetX: KNOB.x,
          targetY: KNOB.y,
          size: KNOB.r,
          snapRadius: 44,
        },
      ],
    }),
    new FinalTask({
      id: 'power',
      title: '電源を入れる',
      hint: '赤いボタンをタップ',
      x: POWER.x,
      y: POWER.y,
      hitRadius: 34,
      label: '電源',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

function drawAntenna(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = '#b9ae9c';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(300, BODY.y + 4);
  ctx.lineTo(334, 58);
  ctx.stroke();
  ctx.fillStyle = '#d8d0c2';
  ctx.beginPath();
  ctx.arc(334, 58, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, BODY.x + 6, BODY.y + 12, BODY.w, BODY.h, BODY.r);
  ctx.filter = 'blur(0px)';
  ctx.fill();

  // 木のボディ
  roundRect(ctx, BODY.x, BODY.y, BODY.w, BODY.h, BODY.r);
  ctx.fillStyle = vGradient(ctx, BODY.y, BODY.y + BODY.h, [
    [0, '#b1753f'],
    [0.45, '#955a2d'],
    [1, '#6b3d1d'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 木目
  for (let i = 0; i < 16; i++) {
    const y = BODY.y + 8 + i * 12.5;
    ctx.strokeStyle = `rgba(60,32,12,${0.06 + (i % 3) * 0.035})`;
    ctx.lineWidth = 1 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(BODY.x, y);
    ctx.bezierCurveTo(BODY.x + 90, y - 5, BODY.x + 190, y + 6, BODY.x + BODY.w, y - 2);
    ctx.stroke();
  }
  // 上からの光
  ctx.fillStyle = vGradient(ctx, BODY.y, BODY.y + 70, [
    [0, 'rgba(255,232,190,0.26)'],
    [1, 'rgba(255,232,190,0)'],
  ]);
  ctx.fillRect(BODY.x, BODY.y, BODY.w, 70);
  ctx.restore();

  ctx.strokeStyle = 'rgba(42,22,8,0.75)';
  ctx.lineWidth = 2;
  roundRect(ctx, BODY.x, BODY.y, BODY.w, BODY.h, BODY.r);
  ctx.stroke();

  // 脚
  ctx.fillStyle = '#4a2a13';
  roundRect(ctx, BODY.x + 24, BODY.y + BODY.h - 2, 40, 14, 5);
  ctx.fill();
  roundRect(ctx, BODY.x + BODY.w - 64, BODY.y + BODY.h - 2, 40, 14, 5);
  ctx.fill();
  ctx.restore();
}

function drawGrille(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 布地
  ctx.beginPath();
  ctx.arc(GRILLE.x, GRILLE.y, GRILLE.r - 5, 0, Math.PI * 2);
  ctx.fillStyle = '#d8c39b';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,96,62,0.35)';
  ctx.lineWidth = 1;
  for (let i = -GRILLE.r; i <= GRILLE.r; i += 5) {
    ctx.beginPath();
    ctx.moveTo(GRILLE.x - GRILLE.r, GRILLE.y + i);
    ctx.lineTo(GRILLE.x + GRILLE.r, GRILLE.y + i);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(GRILLE.x + i, GRILLE.y - GRILLE.r);
    ctx.lineTo(GRILLE.x + i, GRILLE.y + GRILLE.r);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(80,58,32,0.18)';
  ctx.beginPath();
  ctx.arc(GRILLE.x, GRILLE.y, GRILLE.r - 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // クロームのリング
  const ring = ctx.createLinearGradient(
    GRILLE.x - GRILLE.r,
    GRILLE.y - GRILLE.r,
    GRILLE.x + GRILLE.r,
    GRILLE.y + GRILLE.r,
  );
  ring.addColorStop(0, '#f2ead9');
  ring.addColorStop(0.4, '#b6a991');
  ring.addColorStop(0.7, '#e6dcc6');
  ring.addColorStop(1, '#8e8371');
  ctx.strokeStyle = ring;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(GRILLE.x, GRILLE.y, GRILLE.r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTuningWindow(ctx: CanvasRenderingContext2D, powered: boolean, time: number): void {
  ctx.save();
  roundRect(ctx, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 7);
  ctx.fillStyle = powered ? '#ffe9b4' : '#e8dcbb';
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (powered) {
    ctx.fillStyle = 'rgba(255,186,90,0.35)';
    ctx.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
  }
  // 目盛り
  ctx.strokeStyle = 'rgba(80,56,28,0.7)';
  for (let i = 0; i <= 12; i++) {
    const x = WINDOW.x + 8 + (i * (WINDOW.w - 16)) / 12;
    const long = i % 3 === 0;
    ctx.lineWidth = long ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x, WINDOW.y + 26);
    ctx.lineTo(x, WINDOW.y + (long ? 38 : 34));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(80,56,28,0.8)';
  ctx.font = '9px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AM  530    800   1100   1600', WINDOW.x + 7, WINDOW.y + 18);
  // 赤い針
  const sweep = powered ? (Math.sin(time / 900) + 1) / 2 : 0.34;
  const nx = WINDOW.x + 10 + sweep * (WINDOW.w - 20);
  ctx.strokeStyle = '#c93b2b';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(nx, WINDOW.y + 22);
  ctx.lineTo(nx, WINDOW.y + WINDOW.h - 3);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(52,30,12,0.8)';
  ctx.lineWidth = 2;
  roundRect(ctx, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 7);
  ctx.stroke();
  ctx.restore();
}

function drawSocket(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = '#3a2210';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,4,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawDialShape(ctx: CanvasRenderingContext2D, r: number, angle: number): void {
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#f6eddc');
  g.addColorStop(0.45, '#c9b89b');
  g.addColorStop(1, '#8b7a60');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,18,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 刻み
  ctx.save();
  ctx.rotate(angle);
  ctx.strokeStyle = 'rgba(70,48,22,0.5)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(r * 0.72, 0);
    ctx.lineTo(r * 0.94, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = '#5b3a18';
  roundRect(ctx, -2, -r * 0.62, 4, r * 0.5, 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.35, r * 0.3, r * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawLamp(ctx: CanvasRenderingContext2D, on: number, time: number): void {
  ctx.save();
  ctx.fillStyle = '#2e1510';
  ctx.beginPath();
  ctx.arc(LAMP.x, LAMP.y, LAMP.r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (on > 0) {
    const flicker = 0.88 + Math.sin(time / 110) * 0.12;
    ctx.shadowBlur = 26 * on;
    ctx.shadowColor = `rgba(255,176,70,${0.9 * on})`;
    const g = ctx.createRadialGradient(LAMP.x, LAMP.y, 1, LAMP.x, LAMP.y, LAMP.r);
    g.addColorStop(0, `rgba(255,246,214,${on})`);
    g.addColorStop(0.5, `rgba(255,185,80,${on * flicker})`);
    g.addColorStop(1, `rgba(214,110,30,${on})`);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#5e2d22';
  }
  ctx.beginPath();
  ctx.arc(LAMP.x, LAMP.y, LAMP.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerButton(ctx: CanvasRenderingContext2D, pressed: number, active: boolean, time: number): void {
  ctx.save();
  const r = POWER.r;
  ctx.translate(POWER.x, POWER.y);
  if (active) {
    const pulse = (Math.sin(time / 280) + 1) / 2;
    ctx.shadowBlur = 10 + pulse * 16;
    ctx.shadowColor = 'rgba(255,120,90,0.85)';
  }
  ctx.fillStyle = '#2b1a0d';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  const depth = 1 - pressed * 0.35;
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, pressed > 0.5 ? '#e2705a' : '#e05a46');
  g.addColorStop(1, '#8c2f20');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * depth, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.34, r * 0.22, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const radioStage: StageModule = {
  def: {
    id: 'radio',
    order: 1,
    title: '古いラジオ',
    subtitle: '物置で眠っていた真空管ラジオ',
    caption: '木のボディに布地のスピーカー。電源を入れると、ランプがあたたかく灯る。',
    accent: '#e3a357',
  },

  build: buildRadioSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const dust = findDust(steps, 'dust');
    const rust = findPolish(steps, 'rust');
    const fit = findFit(steps, 'parts');
    const power = findFinal(steps, 'power');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;

    const dialPlaced = fit?.isPlaced('dial') ?? false;
    const knobPlaced = fit?.isPlaced('knob') ?? false;
    const powered = power?.triggered ?? false;
    const lampOn = powered ? Math.min(1, state.finale * 2.2 + 0.25) : 0;

    drawAntenna(ctx);
    drawBody(ctx);
    drawGrille(ctx);
    drawTuningWindow(ctx, powered, time);
    drawLamp(ctx, lampOn, time);

    // 取り付け穴
    if (!dialPlaced) drawSocket(ctx, DIAL.x, DIAL.y, DIAL.r);
    if (!knobPlaced) drawSocket(ctx, KNOB.x, KNOB.y, KNOB.r);

    // 設置済みの部品
    if (dialPlaced) {
      ctx.save();
      ctx.translate(DIAL.x, DIAL.y);
      drawDialShape(ctx, DIAL.r, powered ? time / 1600 : 0);
      ctx.restore();
    }
    if (knobPlaced) {
      ctx.save();
      ctx.translate(KNOB.x, KNOB.y);
      drawDialShape(ctx, KNOB.r, powered ? -time / 2200 : 0.6);
      ctx.restore();
    }

    drawPowerButton(ctx, power?.press ?? 0, current === power && !powered, time);

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
        drawSlotMarker(ctx, p.targetX, p.targetY, (p.size ?? 20) + 6, time, true, near);
      }
    }
    if (fit && current === fit) {
      for (const p of fit.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          ctx.scale(scale, scale);
          drawDialShape(ctx, p.size ?? 20, 0);
        });
      }
    }
  },
};
