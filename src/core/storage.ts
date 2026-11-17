/**
 * 進行状況・設定の保存（localStorage）。
 * テストできるように、保存先は差し替え可能にしてある。
 */

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
}

export function emptySave(): SaveData {
  return { version: 1, collection: {}, settings: { muted: false } };
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
