/**
 * 道具の強化（続けて遊びたくなる仕組み）。
 * 修復するとお礼のお金がもらえ、それで道具を強くすると修復が楽になる。
 *
 * 数字はすべてこのファイルにまとめる（あとで調整しやすくするため）。
 * 設計: docs/superpowers/specs/2026-11-18-tools-upgrade-design.md
 */
import { FitTask, PolishTask, type RepairStep } from './tasks';

export type ToolId = 'cloth' | 'polish' | 'tweezers';
export type ToolLevels = Record<ToolId, number>;

export const TOOL_IDS: ToolId[] = ['cloth', 'polish', 'tweezers'];
export const MAX_TOOL_LEVEL = 3;

/** お礼（円） */
export const REWARD_FIRST = 300;
export const REWARD_REPEAT = 120;

/** 次のレベルに上げる値段。添字 = 今のレベル */
const UPGRADE_COSTS: Record<number, number> = { 1: 250, 2: 600 };

/** 効果。添字 = レベル - 1 */
const BRUSH_SCALE = [1, 1.3, 1.6];
const STROKE_SCALE = [1, 0.75, 0.5];
const SNAP_BONUS = [0, 12, 24];

export interface ToolDef {
  id: ToolId;
  name: string;
  /** Lv1〜3 の呼び名 */
  levelNames: [string, string, string];
  /** Lv1〜3 の効果のひとこと */
  effectText: [string, string, string];
}

export const TOOLS: ToolDef[] = [
  {
    id: 'cloth',
    name: '布',
    levelNames: ['古い布', 'やわらかい布', '大きな布'],
    effectText: ['ふつうの幅で拭ける', '拭ける幅が 1.3倍', '拭ける幅が 1.6倍'],
  },
  {
    id: 'polish',
    name: '磨き粉',
    levelNames: ['ふつうの磨き粉', 'よく効く磨き粉', '職人の磨き粉'],
    effectText: ['ふつうに磨ける', '往復が 3/4 で済む', '往復が半分で済む'],
  },
  {
    id: 'tweezers',
    name: 'ピンセット',
    levelNames: ['ふつうのピンセット', '磁石つきピンセット', '職人のピンセット'],
    effectText: ['ふつうに部品を運べる', '部品が少し遠くから吸い付く', '部品がかなり遠くから吸い付く'],
  },
];

export function getToolDef(id: ToolId): ToolDef {
  return TOOLS.find((t) => t.id === id) as ToolDef;
}

export function defaultToolLevels(): ToolLevels {
  return { cloth: 1, polish: 1, tweezers: 1 };
}

export function rewardFor(firstClear: boolean): number {
  return firstClear ? REWARD_FIRST : REWARD_REPEAT;
}

/** 今のレベルから1つ上げる値段。最高レベルなら null */
export function upgradeCost(currentLevel: number): number | null {
  return UPGRADE_COSTS[currentLevel] ?? null;
}

export interface ToolEffects {
  /** 汚れ落としの半径の倍率 */
  brushScale: number;
  /** サビ磨きに必要な距離の倍率 */
  strokeScale: number;
  /** 部品が吸い付く範囲に足す量（論理座標） */
  snapBonus: number;
}

function idx(level: number): number {
  return Math.min(MAX_TOOL_LEVEL, Math.max(1, Math.round(level))) - 1;
}

export function toolEffects(levels: ToolLevels): ToolEffects {
  return {
    brushScale: BRUSH_SCALE[idx(levels.cloth)],
    strokeScale: STROKE_SCALE[idx(levels.polish)],
    snapBonus: SNAP_BONUS[idx(levels.tweezers)],
  };
}

/** プレイ開始時に、道具の効果を工程へ当てる（布の幅は play.ts が brushScale を使う） */
export function applyToolEffects(steps: RepairStep[], fx: ToolEffects): void {
  for (const s of steps) {
    if (s instanceof PolishTask) {
      s.strokeFactor *= fx.strokeScale;
    } else if (s instanceof FitTask) {
      for (const p of s.parts) p.snapRadius = (p.snapRadius ?? 46) + fx.snapBonus;
    }
  }
}

export interface NextGoal {
  toolId: ToolId;
  nextLevel: number;
  cost: number;
  /** あと何円足りないか（買えるなら 0） */
  short: number;
}

/** 次に目指す道具: まだ上げられるもののうち、いちばん安いもの（同じ値段なら TOOL_IDS の順） */
export function nextGoal(money: number, levels: ToolLevels): NextGoal | null {
  let best: NextGoal | null = null;
  for (const id of TOOL_IDS) {
    const cost = upgradeCost(levels[id]);
    if (cost === null) continue;
    if (!best || cost < best.cost) {
      best = { toolId: id, nextLevel: levels[id] + 1, cost, short: Math.max(0, cost - money) };
    }
  }
  return best;
}
