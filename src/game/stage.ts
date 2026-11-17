import type { VisualState } from './art';
import type { RepairStep } from './tasks';

export type StageId = 'radio' | 'clock' | 'camera' | 'lamp' | 'robot' | 'record' | 'phone';

/**
 * 最後に「動いた！」となる瞬間の効果音と演出。
 * - power: ブーンと通電（ラジオ）
 * - clock: カチッ＋通電（時計）
 * - shutter: シャッター音＋画面が白く光る（カメラ）
 * - flame: 火が灯る音（ランプ）
 * - walk: ぜんまいが回ってカシャカシャ歩く音（ロボット）
 * - music: 短いメロディ（レコード）
 * - bell: ベルが鳴る（黒電話）
 */
export type FinalCue = 'power' | 'clock' | 'shutter' | 'flame' | 'walk' | 'music' | 'bell';

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
  /** 最後の工程が終わった瞬間の効果音と演出 */
  finalCue: FinalCue;
  /** 図鑑のサムネイルで切り出す範囲（縦長の品物だけ指定。省略時は共通の範囲） */
  thumbFocus?: { x: number; y: number; w: number; h: number };
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
