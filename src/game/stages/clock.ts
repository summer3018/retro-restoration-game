import {
  drawDust,
  drawSlotMarker,
  findDust,
  findFinal,
  findFit,
  roundRect,
  withPartTransform,
  type VisualState,
} from '../art';
import type { StageModule } from '../stage';
import { FinalTask, FitTask, ScrubMask, type RepairStep } from '../tasks';

/* ---------------- 配置 ---------------- */
const C = { x: 180, y: 226 };
const OUTER_R = 112;
const DIAL_R = 92;
const GEAR_WINDOW = { x: 180, y: 280, r: 44 };
const GEARS = [
  { id: 'gear-l', x: 160, y: 276, r: 19 },
  { id: 'gear-m', x: 199, y: 268, r: 14 },
  { id: 'gear-s', x: 197, y: 298, r: 11 },
];
const CROWN = { x: 262, y: 144, r: 15 };

function insideDial(x: number, y: number): boolean {
  return Math.hypot(x - C.x, y - C.y) <= DIAL_R;
}

export function buildClockSteps(): RepairStep[] {
  return [
    new ScrubMask({
      id: 'glass',
      title: 'ガラスの汚れを落とす',
      hint: '文字盤を指でこすって曇りを落とそう',
      rect: { x: C.x - DIAL_R, y: C.y - DIAL_R, w: DIAL_R * 2, h: DIAL_R * 2 },
      cols: 26,
      rows: 26,
      inside: insideDial,
      doneThreshold: 0.86,
    }),
    new FitTask({
      id: 'gears',
      title: '歯車をはめる',
      hint: '大きさの合う穴にドラッグしよう',
      parts: GEARS.map((g, i) => ({
        id: g.id,
        label: ['大歯車', '中歯車', '小歯車'][i],
        hitRadius: Math.max(34, g.r + 18),
        trayX: 76 + i * 104,
        trayY: 498,
        targetX: g.x,
        targetY: g.y,
        size: g.r,
        snapRadius: 42,
      })),
    }),
    new FitTask({
      id: 'hands',
      title: '針を取り付ける',
      hint: '文字盤の中心にドラッグしよう',
      parts: [
        {
          id: 'hour',
          label: '短針',
          hitRadius: 40,
          trayX: 118,
          trayY: 498,
          targetX: C.x,
          targetY: C.y,
          size: 1,
          snapRadius: 52,
        },
        {
          id: 'minute',
          label: '長針',
          hitRadius: 40,
          trayX: 242,
          trayY: 498,
          targetX: C.x,
          targetY: C.y,
          size: 1,
          snapRadius: 52,
        },
      ],
    }),
    new FinalTask({
      id: 'wind',
      title: 'ぜんまいを巻く',
      hint: '右上のつまみをタップ',
      x: CROWN.x,
      y: CROWN.y,
      hitRadius: 34,
      label: 'ぜんまい',
    }),
  ];
}

/* ---------------- 描画 ---------------- */

function drawGear(ctx: CanvasRenderingContext2D, r: number, angle: number, teeth = 10): void {
  ctx.save();
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#e8c87d');
  g.addColorStop(0.5, '#bb9247');
  g.addColorStop(1, '#8a6626');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos((a0 + a1) / 2) * r * 1.22, Math.sin((a0 + a1) / 2) * r * 1.22);
    ctx.lineTo(Math.cos(a1) * r * 1.22, Math.sin(a1) * r * 1.22);
    ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,48,12,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#5d4418';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCase(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(C.x + 4, C.y + OUTER_R + 16, OUTER_R * 0.8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 台座
  ctx.fillStyle = '#6b4a22';
  roundRect(ctx, C.x - 72, C.y + OUTER_R - 22, 144, 32, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,180,0.12)';
  roundRect(ctx, C.x - 72, C.y + OUTER_R - 22, 144, 10, 6);
  ctx.fill();

  // 真鍮ケース
  const ring = ctx.createLinearGradient(C.x - OUTER_R, C.y - OUTER_R, C.x + OUTER_R, C.y + OUTER_R);
  ring.addColorStop(0, '#f3dba0');
  ring.addColorStop(0.35, '#c29a49');
  ring.addColorStop(0.6, '#e8cd8c');
  ring.addColorStop(1, '#8a6a2c');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(C.x, C.y, OUTER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,10,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 文字盤
  const dial = ctx.createRadialGradient(C.x - 30, C.y - 36, 10, C.x, C.y, DIAL_R);
  dial.addColorStop(0, '#fbf3dd');
  dial.addColorStop(0.7, '#f0e3c3');
  dial.addColorStop(1, '#ddcaa0');
  ctx.fillStyle = dial;
  ctx.beginPath();
  ctx.arc(C.x, C.y, DIAL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDialMarks(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(C.x, C.y);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    ctx.strokeStyle = major ? 'rgba(70,48,22,0.85)' : 'rgba(110,86,52,0.45)';
    ctx.lineWidth = major ? 2.2 : 1;
    const r0 = DIAL_R - (major ? 14 : 8);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * (DIAL_R - 3), Math.sin(a) * (DIAL_R - 3));
    ctx.stroke();
  }
  ctx.fillStyle = '#4a3315';
  ctx.font = 'bold 20px "Georgia", "Hiragino Mincho ProN", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const nums: [string, number, number][] = [
    ['12', 0, -DIAL_R + 28],
    ['3', DIAL_R - 28, 0],
    ['9', -DIAL_R + 28, 0],
  ];
  for (const [t, x, y] of nums) ctx.fillText(t, x, y);
  ctx.font = '9px "Georgia", serif';
  ctx.fillStyle = 'rgba(90,64,30,0.75)';
  ctx.fillText('RESTORED', 0, -34);
  ctx.restore();
}

function drawGearWindow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(GEAR_WINDOW.x, GEAR_WINDOW.y, GEAR_WINDOW.r, 0, Math.PI * 2);
  ctx.fillStyle = '#2b2014';
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,150,80,0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawHand(ctx: CanvasRenderingContext2D, len: number, width: number, angle: number): void {
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = '#3d2a12';
  ctx.beginPath();
  ctx.moveTo(-width, 8);
  ctx.lineTo(0, -len);
  ctx.lineTo(width, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, active: boolean, pressed: number, time: number): void {
  ctx.save();
  ctx.translate(CROWN.x, CROWN.y);
  if (active) {
    const pulse = (Math.sin(time / 280) + 1) / 2;
    ctx.shadowBlur = 10 + pulse * 16;
    ctx.shadowColor = 'rgba(255,210,120,0.9)';
  }
  ctx.rotate(pressed * 1.6);
  const g = ctx.createLinearGradient(-CROWN.r, -CROWN.r, CROWN.r, CROWN.r);
  g.addColorStop(0, '#f6e2ab');
  g.addColorStop(1, '#8e6c2c');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = i % 2 === 0 ? CROWN.r : CROWN.r * 0.82;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,10,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export const clockStage: StageModule = {
  def: {
    id: 'clock',
    order: 2,
    title: 'アンティーク時計',
    subtitle: '止まったままの真鍮の置き時計',
    caption: '曇ったガラスの奥で歯車が噛み合い、長く止まっていた時間がまた動き出す。',
    accent: '#d9b25c',
    finalCue: 'clock',
  },

  build: buildClockSteps,

  draw(ctx, state: VisualState) {
    const { steps, time } = state;
    const glass = findDust(steps, 'glass');
    const gears = findFit(steps, 'gears');
    const hands = findFit(steps, 'hands');
    const wind = findFinal(steps, 'wind');
    const current = state.stepIndex >= 0 ? steps[state.stepIndex] : null;
    const running = wind?.triggered ?? false;
    const spin = running ? time / 420 : 0;

    drawCase(ctx);
    drawDialMarks(ctx);
    drawGearWindow(ctx);

    // 設置済みの歯車（窓の内側だけに見えるようにする）
    if (gears) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(GEAR_WINDOW.x, GEAR_WINDOW.y, GEAR_WINDOW.r - 2, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < gears.parts.length; i++) {
        const p = gears.parts[i];
        if (!p.placed) {
          // 空の軸穴
          ctx.save();
          ctx.fillStyle = '#17110a';
          ctx.beginPath();
          ctx.arc(p.targetX, p.targetY, (p.size ?? 16) * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.translate(p.targetX, p.targetY);
        drawGear(ctx, p.size ?? 16, spin * (i % 2 === 0 ? 1 : -1.6) + i, 10 + i * 2);
        ctx.restore();
      }
      ctx.restore();
    }

    // 針
    const t = running ? time / 1000 : 0;
    if (hands?.isPlaced('hour')) {
      ctx.save();
      ctx.translate(C.x, C.y);
      drawHand(ctx, DIAL_R * 0.52, 5, (-Math.PI * 2 * 0.18) + t * 0.12);
      ctx.restore();
    }
    if (hands?.isPlaced('minute')) {
      ctx.save();
      ctx.translate(C.x, C.y);
      drawHand(ctx, DIAL_R * 0.76, 3.6, (Math.PI * 2 * 0.3) + t * 1.4);
      ctx.restore();
    }
    if (hands?.isDone) {
      ctx.save();
      ctx.translate(C.x, C.y);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawCrown(ctx, current === wind && !running, wind?.press ?? 0, time);

    // ガラスの反射
    ctx.save();
    ctx.beginPath();
    ctx.arc(C.x, C.y, DIAL_R, 0, Math.PI * 2);
    ctx.clip();
    const sheen = ctx.createLinearGradient(C.x - DIAL_R, C.y - DIAL_R, C.x + DIAL_R * 0.3, C.y + DIAL_R);
    sheen.addColorStop(0, 'rgba(255,255,255,0.26)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(C.x - DIAL_R, C.y - DIAL_R, DIAL_R * 2, DIAL_R * 2);
    ctx.restore();

    if (glass) drawDust(ctx, glass, state.dustFade, '96,92,78');

    // 取り付け先の目印 + トレイの部品
    for (const task of [gears, hands]) {
      if (!task) continue;
      if (current === task) {
        for (const p of task.parts) {
          if (p.placed) continue;
          const near = p.dragging && Math.hypot(p.x - p.targetX, p.y - p.targetY) <= (p.snapRadius ?? 46);
          drawSlotMarker(ctx, p.targetX, p.targetY, task === hands ? 26 : (p.size ?? 16) + 6, time, true, near);
        }
      }
      if (current !== task) continue;
      for (const p of task.parts) {
        if (p.placed) continue;
        withPartTransform(ctx, p, time, (scale) => {
          ctx.scale(scale, scale);
          if (task === gears) {
            drawGear(ctx, p.size ?? 16, time / 2600, 10);
          } else {
            drawHand(ctx, p.id === 'minute' ? 40 : 28, p.id === 'minute' ? 3.6 : 5, Math.PI);
          }
        });
      }
    }
  },
};
