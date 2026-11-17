import type { VisualState } from './art';
import type { RepairStep } from './tasks';

export type StageId = 'radio' | 'clock' | 'camera';

export interface StageDef {
  id: StageId;
  order: number;
  /** ステージ選択・図鑑に出す名前 */
  title: string;
  /** 一言説明 */
  subtitle: string;
  /** 図鑑の解説文 */
  caption: string;
  /** 画面のアクセント色 */
  accent: string;
}

export interface StageModule {
  def: StageDef;
  /** 毎回あたらしい工程一式を作る（再プレイで状態を持ち越さない） */
  build(): RepairStep[];
  /** 品物を描く。工程の進み具合は steps から読む */
  draw(ctx: CanvasRenderingContext2D, state: VisualState): void;
}

/** 品物を置く場所（論理座標） */
export const ITEM_AREA = { x: 20, y: 44, w: 320, h: 390 };
/** 部品トレイ */
export const TRAY_AREA = { x: 14, y: 448, w: 332, h: 100 };
