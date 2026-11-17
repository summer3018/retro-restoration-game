import type { FitPart, PolishTask, RepairStep, ScrubMask } from './tasks';
import { FinalTask, FitTask, PolishTask as PolishCls, RotateTask, ScrubMask as ScrubCls } from './tasks';

/** 描画用の共通ヘルパーと、全ステージ共通の「汚れ」「サビ」の見た目。 */

export interface VisualState {
  steps: RepairStep[];
  /** 今の工程（-1 なら強調しない） */
  stepIndex: number;
  /** 完成演出 0..1 */
  finale: number;
  /** ms */
  time: number;
  /** 汚れ落とし完了後のフェードアウト 0..1（1=残っている） */
  dustFade: number;
}

export function findStep<T extends RepairStep>(steps: RepairStep[], id: string): T | null {
  return (steps.find((s) => s.id === id) as T | undefined) ?? null;
}

export function findDust(steps: RepairStep[], id: string): ScrubMask | null {
  const s = steps.find((x) => x.id === id);
  return s instanceof ScrubCls ? s : null;
}

export function findPolish(steps: RepairStep[], id: string): PolishTask | null {
  const s = steps.find((x) => x.id === id);
  return s instanceof PolishCls ? s : null;
}

export function findFit(steps: RepairStep[], id: string): FitTask | null {
  const s = steps.find((x) => x.id === id);
  return s instanceof FitTask ? s : null;
}

export function findRotate(steps: RepairStep[], id: string): RotateTask | null {
  const s = steps.find((x) => x.id === id);
  return s instanceof RotateTask ? s : null;
}

export function findFinal(steps: RepairStep[], id: string): FinalTask | null {
  const s = steps.find((x) => x.id === id);
  return s instanceof FinalTask ? s : null;
}

/** 工程を強制的に完了させる（コレクションの「修復後」表示や、テスト用） */
export function completeStep(step: RepairStep): void {
  if (step instanceof ScrubCls) step.clearAll();
  else if (step instanceof PolishCls) step.finishAll();
  else if (step instanceof FitTask) step.finishAll();
  else if (step instanceof FinalTask) step.triggered = true;
  else if (step instanceof RotateTask) step.finishAll();
}

/* ---------------------------- 図形ヘルパー ---------------------------- */

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function vGradient(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}

/** 座標から決まる疑似乱数（毎フレーム同じ模様になるように） */
export function hashNoise(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function shadowed(ctx: CanvasRenderingContext2D, blur: number, color: string, fn: () => void): void {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  fn();
  ctx.restore();
}

/* ---------------------------- 汚れ ---------------------------- */

/** 汚れマスクを「グリメ（油汚れ・ホコリ）」として描く */
export function drawDust(ctx: CanvasRenderingContext2D, mask: ScrubMask, fade = 1, tint = '70,58,42'): void {
  if (fade <= 0.001) return;
  ctx.save();
  const rx = mask.cellW * 0.78;
  const ry = mask.cellH * 0.78;
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const v = mask.valueAt(c, r);
      if (v <= 0.03) continue;
      if (!mask.isActive(c, r)) continue;
      const { x, y } = mask.cellCenter(c, r);
      const n = hashNoise(c, r);
      const n2 = hashNoise(r + 7, c + 3);
      const alpha = Math.min(0.58, v * (0.34 + n * 0.3)) * fade;
      ctx.fillStyle = `rgba(${tint},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(
        x + (n - 0.5) * mask.cellW * 0.5,
        y + (n2 - 0.5) * mask.cellH * 0.5,
        rx * (0.95 + n * 0.45),
        ry * (0.95 + n2 * 0.45),
        n * 3.14,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // 粒っぽさ
      if (v > 0.45 && n2 > 0.72) {
        ctx.fillStyle = `rgba(48,38,26,${(0.3 * v * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + (n2 - 0.5) * mask.cellW, y + (n - 0.5) * mask.cellH, 1.1 + n * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* ---------------------------- サビ ---------------------------- */

export function drawRust(ctx: CanvasRenderingContext2D, task: PolishTask, time: number): void {
  ctx.save();
  for (let i = 0; i < task.spots.length; i++) {
    const s = task.spots[i];
    const left = 1 - s.wear;
    if (left > 0.02) {
      // ざらついたサビの塊
      for (let k = 0; k < 9; k++) {
        const n = hashNoise(i * 13 + k, k * 5 + 1);
        const n2 = hashNoise(k * 9 + 3, i * 7 + 2);
        const a = (k / 9) * Math.PI * 2 + n * 1.6;
        const rad = s.r * (0.18 + n2 * 0.55);
        const px = s.x + Math.cos(a) * s.r * 0.45 * n;
        const py = s.y + Math.sin(a) * s.r * 0.45 * n2;
        ctx.fillStyle = `rgba(${132 - k * 4},${70 - k * 2},${28 + k},${(left * (0.42 + n * 0.3)).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(px, py, rad, rad * (0.7 + n * 0.5), n * 6.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(92,44,18,${(left * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    // 磨けたところのツヤ
    if (s.wear > 0.08) {
      const shine = Math.min(1, s.wear);
      const g = ctx.createRadialGradient(
        s.x - s.r * 0.3,
        s.y - s.r * 0.3,
        s.r * 0.05,
        s.x,
        s.y,
        s.r * 0.95,
      );
      g.addColorStop(0, `rgba(255,248,230,${(0.5 * shine).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,248,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      if (s.wear >= 1) {
        const tw = (Math.sin(time / 420 + i) + 1) / 2;
        ctx.strokeStyle = `rgba(255,255,255,${(0.25 + tw * 0.35).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.55, -1.1, -0.2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** レンズの「くもり」。サビと同じ PolishTask を、白っぽい曇りとして描く */
export function drawHaze(ctx: CanvasRenderingContext2D, task: PolishTask, time: number): void {
  ctx.save();
  for (let i = 0; i < task.spots.length; i++) {
    const s = task.spots[i];
    const left = 1 - s.wear;
    if (left > 0.02) {
      for (let k = 0; k < 7; k++) {
        const n = hashNoise(i * 17 + k, k * 3 + 5);
        const n2 = hashNoise(k * 11 + 2, i * 5 + 9);
        const a = (k / 7) * Math.PI * 2 + n * 2;
        ctx.fillStyle = `rgba(226,230,224,${(left * (0.2 + n * 0.22)).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(
          s.x + Math.cos(a) * s.r * 0.4 * n,
          s.y + Math.sin(a) * s.r * 0.4 * n2,
          s.r * (0.35 + n2 * 0.55),
          s.r * (0.3 + n * 0.5),
          n * 6.28,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      // 細かい傷
      ctx.strokeStyle = `rgba(255,255,255,${(left * 0.25).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - s.r * 0.5, s.y + s.r * 0.2);
      ctx.lineTo(s.x + s.r * 0.4, s.y - s.r * 0.45);
      ctx.stroke();
    }
    if (s.wear > 0.1) {
      const shine = Math.min(1, s.wear);
      const tw = (Math.sin(time / 500 + i * 1.3) + 1) / 2;
      ctx.strokeStyle = `rgba(255,255,255,${(0.2 + tw * 0.3) * shine})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.5, -1.3, -0.3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** サビの場所を分かりやすくする目印（未着手のうちだけ出す） */
export function drawRustMarkers(ctx: CanvasRenderingContext2D, task: PolishTask, time: number): void {
  const pulse = (Math.sin(time / 320) + 1) / 2;
  ctx.save();
  ctx.lineWidth = 2;
  for (const s of task.spots) {
    if (s.wear >= 1) continue;
    ctx.strokeStyle = `rgba(255,214,140,${(0.25 + pulse * 0.4) * (1 - s.wear)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------- 取り付け先の目印 ---------------------------- */

export function drawSlotMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  time: number,
  active: boolean,
  near = false,
): void {
  const pulse = (Math.sin(time / 300) + 1) / 2;
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeStyle = near
    ? `rgba(255,226,150,${0.85})`
    : `rgba(255,222,160,${active ? 0.35 + pulse * 0.4 : 0.18})`;
  ctx.beginPath();
  ctx.arc(x, y, r + (near ? 4 : 0) + pulse * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 掴んでいる部品の持ち上がり表現 */
export function withPartTransform(
  ctx: CanvasRenderingContext2D,
  part: FitPart,
  time: number,
  fn: (scale: number) => void,
): void {
  ctx.save();
  let dx = 0;
  if (part.shake > 0) {
    dx = Math.sin(time / 18) * (part.shake / 420) * 5;
  }
  ctx.translate(part.x + dx, part.y);
  const scale = part.dragging ? 1.12 : 1;
  if (part.dragging) {
    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
  }
  fn(scale);
  ctx.restore();
}
