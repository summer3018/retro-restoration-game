/**
 * 進行状況・設定の保存（localStorage）。
 * テストできるように、保存先は差し替え可能にしてある。
 */
import {
  defaultToolLevels,
  MAX_TOOL_LEVEL,
  rewardFor,
  TOOL_IDS,
  upgradeCost,
  type ToolId,
  type ToolLevels,
} from '../game/tools';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage が使えない環境（プライベートモード等）でも落ちないようにする */
export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function detectStore(): KeyValueStore {
  try {
    const probe = '__rrw_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStore();
  }
}

export const SAVE_KEY = 'rrw.save.v1';

export interface StageRecord {
  cleared: boolean;
  clearCount: number;
  /** 最短クリア時間(ms) */
  bestMs: number | null;
  /** 初回クリア日時(ISO) */
  firstClearedAt: string | null;
}

export interface SaveData {
  version: 1;
  collection: Record<string, StageRecord>;
  settings: {
    muted: boolean;
  };
  /** お礼でもらったお金（円） */
  money: number;
  /** 道具のレベル（1〜3） */
  tools: ToolLevels;
}

export function emptySave(): SaveData {
  return { version: 1, collection: {}, settings: { muted: false }, money: 0, tools: defaultToolLevels() };
}

export type BuyResult =
  | { ok: true; toolId: ToolId; level: number; cost: number }
  | { ok: false; reason: 'max' | 'short' };

/** 所持金を 0 以上の整数に直す（道具が入る前のデータ・壊れたデータ用） */
function sanitizeMoney(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** 道具レベルを 1〜3 の整数に直す */
function sanitizeTools(v: unknown): ToolLevels {
  const out = defaultToolLevels();
  if (!v || typeof v !== 'object') return out;
  const src = v as Record<string, unknown>;
  for (const id of TOOL_IDS) {
    const n = src[id];
    if (typeof n === 'number' && Number.isFinite(n)) {
      out[id] = Math.min(MAX_TOOL_LEVEL, Math.max(1, Math.floor(n)));
    }
  }
  return out;
}

function emptyRecord(): StageRecord {
  return { cleared: false, clearCount: 0, bestMs: null, firstClearedAt: null };
}

export class SaveStore {
  private data: SaveData;

  constructor(private store: KeyValueStore) {
    this.data = this.read();
  }

  private read(): SaveData {
    const raw = this.store.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed || parsed.version !== 1 || typeof parsed.collection !== 'object' || parsed.collection === null) {
        return emptySave();
      }
      return {
        version: 1,
        collection: parsed.collection as Record<string, StageRecord>,
        settings: { muted: Boolean(parsed.settings?.muted) },
        // 道具が入る前のデータには無いので、初期値で補う（図鑑の記録はそのまま）
        money: sanitizeMoney(parsed.money),
        tools: sanitizeTools(parsed.tools),
      };
    } catch {
      // 壊れたデータでも遊べなくならないようにする
      return emptySave();
    }
  }

  private flush(): void {
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* 保存できなくてもゲームは続行する */
    }
  }

  get snapshot(): SaveData {
    return JSON.parse(JSON.stringify(this.data)) as SaveData;
  }

  record(stageId: string): StageRecord {
    return this.data.collection[stageId] ?? emptyRecord();
  }

  isCleared(stageId: string): boolean {
    return this.record(stageId).cleared;
  }

  get clearedCount(): number {
    return Object.values(this.data.collection).filter((r) => r.cleared).length;
  }

  /** クリアを記録する。@returns 今回が初クリアなら true */
  recordClear(stageId: string, elapsedMs: number, nowIso: string): boolean {
    const prev = this.record(stageId);
    const firstTime = !prev.cleared;
    this.data.collection[stageId] = {
      cleared: true,
      clearCount: prev.clearCount + 1,
      bestMs: prev.bestMs === null ? elapsedMs : Math.min(prev.bestMs, elapsedMs),
      firstClearedAt: prev.firstClearedAt ?? nowIso,
    };
    this.flush();
    return firstTime;
  }

  /**
   * クリアを記録して、お礼を受け取る。プレイ画面からはこれだけを呼ぶ（お礼の二重取りを防ぐ）。
   */
  completeStage(stageId: string, elapsedMs: number, nowIso: string): { firstClear: boolean; reward: number } {
    const firstClear = this.recordClear(stageId, elapsedMs, nowIso);
    const reward = rewardFor(firstClear);
    this.data.money += reward;
    this.flush();
    return { firstClear, reward };
  }

  get money(): number {
    return this.data.money;
  }

  get toolLevels(): ToolLevels {
    return { ...this.data.tools };
  }

  /** 道具を1段階上げる。足りない・最高のときは何も変えない */
  buyUpgrade(toolId: ToolId): BuyResult {
    const level = this.data.tools[toolId];
    const cost = upgradeCost(level);
    if (cost === null) return { ok: false, reason: 'max' };
    if (this.data.money < cost) return { ok: false, reason: 'short' };
    this.data.money -= cost;
    this.data.tools[toolId] = level + 1;
    this.flush();
    return { ok: true, toolId, level: level + 1, cost };
  }

  get muted(): boolean {
    return this.data.settings.muted;
  }

  setMuted(muted: boolean): void {
    this.data.settings.muted = muted;
    this.flush();
  }

  resetAll(): void {
    this.data = emptySave();
    this.flush();
  }
}
