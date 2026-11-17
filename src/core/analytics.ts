import type { KeyValueStore } from './storage';

/**
 * 市場検証用のプレイ記録。
 * 個人情報・位置情報・連絡先・広告IDは一切集めない。
 * 匿名のローカル識別子（この端末のこのブラウザだけで作る乱数ID）のみ使う。
 */

export type EventName =
  | 'game_start'
  | 'stage_start'
  | 'stage_complete'
  | 'stage_retry'
  | 'session_end'
  | 'next_stage_start';

export interface LoggedEvent {
  event: EventName;
  /** 発生時刻 (ISO8601) */
  ts: string;
  stageId: string | null;
  /** ステージ開始からの経過時間(ms)。該当しない場合は null */
  elapsedMs: number | null;
  /** 匿名のローカル識別子 */
  clientId: string;
  /** ページを開いてから閉じるまでの一時ID */
  sessionId: string;
}

export interface SurveyAnswer {
  ts: string;
  stageId: string;
  /** Q1 面白かったか 1..5 */
  fun: number;
  /** Q2 もう一度遊びたいか */
  playAgain: boolean;
  /** Q3 別の品物も修復したいか */
  wantMore: boolean;
  /** Q4 改善してほしい点（自由入力） */
  comment: string;
  clientId: string;
  sessionId: string;
}

/** 遊びながらその場で残す「気づきメモ」（圏外でも書ける） */
export interface PlayNote {
  ts: string;
  /** どのステージの、どの工程で気づいたか */
  stageId: string | null;
  stageTitle: string | null;
  stepTitle: string | null;
  /** 選んだ分類（複数可） */
  tags: string[];
  text: string;
  clientId: string;
  sessionId: string;
}

export const EVENTS_KEY = 'rrw.events.v1';
export const SURVEY_KEY = 'rrw.surveys.v1';
export const NOTES_KEY = 'rrw.notes.v1';
export const CLIENT_KEY = 'rrw.clientId.v1';

/** localStorage があふれないように上限を決める */
export const MAX_EVENTS = 2000;
export const MAX_SURVEYS = 200;
export const MAX_NOTES = 300;

export function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface AnalyticsOptions {
  store: KeyValueStore;
  /** テストから差し替えられるようにする */
  now?: () => number;
  sessionId?: string;
}

export class Analytics {
  private store: KeyValueStore;
  private now: () => number;
  readonly clientId: string;
  readonly sessionId: string;
  private events: LoggedEvent[];
  private surveys: SurveyAnswer[];
  private notes: PlayNote[];

  constructor(opts: AnalyticsOptions) {
    this.store = opts.store;
    this.now = opts.now ?? (() => Date.now());
    this.sessionId = opts.sessionId ?? randomId();

    let cid = this.store.getItem(CLIENT_KEY);
    if (!cid) {
      cid = randomId();
      this.store.setItem(CLIENT_KEY, cid);
    }
    this.clientId = cid;

    this.events = this.readArray<LoggedEvent>(EVENTS_KEY);
    this.surveys = this.readArray<SurveyAnswer>(SURVEY_KEY);
    this.notes = this.readArray<PlayNote>(NOTES_KEY);
  }

  private readArray<T>(key: string): T[] {
    const raw = this.store.getItem(key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private writeArray(key: string, value: unknown): void {
    try {
      this.store.setItem(key, JSON.stringify(value));
    } catch {
      /* 保存できなくてもゲームは続行する */
    }
  }

  track(event: EventName, detail: { stageId?: string | null; elapsedMs?: number | null } = {}): LoggedEvent {
    const entry: LoggedEvent = {
      event,
      ts: new Date(this.now()).toISOString(),
      stageId: detail.stageId ?? null,
      elapsedMs: detail.elapsedMs ?? null,
      clientId: this.clientId,
      sessionId: this.sessionId,
    };
    this.events.push(entry);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    this.writeArray(EVENTS_KEY, this.events);
    return entry;
  }

  saveSurvey(answer: Omit<SurveyAnswer, 'ts' | 'clientId' | 'sessionId'>): SurveyAnswer {
    const entry: SurveyAnswer = {
      ...answer,
      comment: answer.comment.slice(0, 500),
      ts: new Date(this.now()).toISOString(),
      clientId: this.clientId,
      sessionId: this.sessionId,
    };
    this.surveys.push(entry);
    if (this.surveys.length > MAX_SURVEYS) {
      this.surveys.splice(0, this.surveys.length - MAX_SURVEYS);
    }
    this.writeArray(SURVEY_KEY, this.surveys);
    return entry;
  }

  saveNote(note: Omit<PlayNote, 'ts' | 'clientId' | 'sessionId'>): PlayNote {
    const entry: PlayNote = {
      ...note,
      text: note.text.slice(0, 500),
      tags: note.tags.slice(0, 8),
      ts: new Date(this.now()).toISOString(),
      clientId: this.clientId,
      sessionId: this.sessionId,
    };
    this.notes.push(entry);
    if (this.notes.length > MAX_NOTES) {
      this.notes.splice(0, this.notes.length - MAX_NOTES);
    }
    this.writeArray(NOTES_KEY, this.notes);
    return entry;
  }

  get allNotes(): PlayNote[] {
    return [...this.notes];
  }

  get allEvents(): LoggedEvent[] {
    return [...this.events];
  }

  get allSurveys(): SurveyAnswer[] {
    return [...this.surveys];
  }

  /** 最初の1回だけ game_start を記録する（リロードごとに1回） */
  trackGameStartOnce(): void {
    if (this.events.some((e) => e.event === 'game_start' && e.sessionId === this.sessionId)) return;
    this.track('game_start');
  }

  exportPayload(): {
    app: string;
    appVersion: string;
    exportedAt: string;
    clientId: string;
    sessionId: string;
    note: string;
    events: LoggedEvent[];
    surveys: SurveyAnswer[];
    notes: PlayNote[];
  } {
    return {
      app: 'retro-restoration-game',
      appVersion: '0.1.0',
      exportedAt: new Date(this.now()).toISOString(),
      clientId: this.clientId,
      sessionId: this.sessionId,
      note: 'このファイルにはプレイ記録とアンケート回答のみが含まれます。個人情報・位置情報・連絡先・広告IDは含みません。',
      events: this.allEvents,
      surveys: this.allSurveys,
      notes: this.allNotes,
    };
  }

  clearAll(): void {
    this.events = [];
    this.surveys = [];
    this.notes = [];
    this.writeArray(EVENTS_KEY, this.events);
    this.writeArray(SURVEY_KEY, this.surveys);
    this.writeArray(NOTES_KEY, this.notes);
  }
}
