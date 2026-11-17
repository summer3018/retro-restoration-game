import { completeStep, type VisualState } from '../game/art';
import type { StageModule } from '../game/stage';

/** 品物が収まっている範囲（論理座標）。サムネイルはここを切り出す */
const DEFAULT_FOCUS = { x: 16, y: 102, w: 328, h: 268 };

export type ThumbMode = 'before' | 'after';

/**
 * ステージの品物を小さなキャンバスに描く。
 * プレイ画面と同じ描画関数を使うので、図鑑の絵がゲーム本編とずれない。
 */
export function renderThumb(canvas: HTMLCanvasElement, stage: StageModule, mode: ThumbMode, cssSize = 150): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const steps = stage.build();
  if (mode === 'after') for (const s of steps) completeStep(s);

  const FOCUS = stage.def.thumbFocus ?? DEFAULT_FOCUS;
  const scale = Math.min(cssSize / FOCUS.w, cssSize / FOCUS.h);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, cssSize);
  bg.addColorStop(0, mode === 'after' ? '#3e2c1d' : '#241a12');
  bg.addColorStop(1, '#171009');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssSize, cssSize);

  ctx.save();
  ctx.translate((cssSize - FOCUS.w * scale) / 2, (cssSize - FOCUS.h * scale) / 2);
  ctx.scale(scale, scale);
  ctx.translate(-FOCUS.x, -FOCUS.y);

  const state: VisualState = {
    steps,
    stepIndex: -1,
    finale: mode === 'after' ? 1 : 0,
    time: mode === 'after' ? 1200 : 0,
    dustFade: 1,
  };
  stage.draw(ctx, state);
  ctx.restore();

  if (mode === 'before') {
    ctx.fillStyle = 'rgba(20,14,8,0.14)';
    ctx.fillRect(0, 0, cssSize, cssSize);
  }
}

/** 未修復（シルエット）表示。まだ一度もクリアしていない品物の図鑑用 */
export function renderSilhouette(canvas: HTMLCanvasElement, stage: StageModule, cssSize = 150): void {
  renderThumb(canvas, stage, 'before', cssSize);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(14,10,6,0.6)';
  ctx.fillRect(0, 0, cssSize, cssSize);
  ctx.fillStyle = 'rgba(246,234,212,0.5)';
  ctx.font = 'bold 28px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('？', cssSize / 2, cssSize / 2);
}
