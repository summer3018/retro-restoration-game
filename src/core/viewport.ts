/**
 * 論理座標 <-> 画面座標 の変換。
 * タッチ位置と絵がずれないように、変換は必ずここを通す。
 */

/** 設計上の基準サイズ（縦長） */
export const DESIGN_W = 360;
export const DESIGN_H = 560;

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** 画面に収まるように等倍で拡大縮小し、中央に置く（contain） */
export function computeTransform(cssW: number, cssH: number, designW = DESIGN_W, designH = DESIGN_H): ViewTransform {
  const scale = Math.min(cssW / designW, cssH / designH);
  return {
    scale,
    offsetX: (cssW - designW * scale) / 2,
    offsetY: (cssH - designH * scale) / 2,
  };
}

/** 画面上の座標（canvas の左上を原点とした CSS px）を論理座標へ */
export function toLogical(t: ViewTransform, canvasX: number, canvasY: number): { x: number; y: number } {
  return {
    x: (canvasX - t.offsetX) / t.scale,
    y: (canvasY - t.offsetY) / t.scale,
  };
}

/** 論理座標を画面座標へ */
export function toScreen(t: ViewTransform, x: number, y: number): { x: number; y: number } {
  return {
    x: x * t.scale + t.offsetX,
    y: y * t.scale + t.offsetY,
  };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  const u = clamp(t, 0, 1) - 1;
  return u * u * u + 1;
}

export function easeInOutQuad(t: number): number {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}
