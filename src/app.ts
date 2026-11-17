import { Analytics } from './core/analytics';
import { sfx } from './core/audio';
import { detectStore, SaveStore } from './core/storage';
import type { StageId } from './game/stage';

export type ScreenName = 'title' | 'select' | 'play' | 'complete' | 'collection' | 'data';

export interface ScreenParams {
  stageId?: StageId;
  /** クリアにかかった時間(ms) */
  clearedMs?: number;
  /** 今回が初クリアか */
  firstClear?: boolean;
  /** 「もう一度」から来たか（stage_retry の記録用） */
  retry?: boolean;
  /** 「次の品物へ」から来たか（next_stage_start の記録用） */
  fromNext?: boolean;
  /** クリアで受け取ったお礼（円） */
  reward?: number;
}

export type Unmount = () => void;
export type ScreenFactory = (app: App, params: ScreenParams) => Unmount;

export class App {
  readonly root: HTMLElement;
  readonly save: SaveStore;
  readonly analytics: Analytics;
  private screens = new Map<ScreenName, ScreenFactory>();
  private unmount: Unmount | null = null;
  private sessionEndSent = false;
  current: ScreenName = 'title';

  constructor(root: HTMLElement) {
    this.root = root;
    const store = detectStore();
    this.save = new SaveStore(store);
    this.analytics = new Analytics({ store });
    sfx.setMuted(this.save.muted);

    // 音は「初回のユーザー操作」まで鳴らさない（ブラウザの自動再生制限にも合わせる）
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // プレイ終了は「実際に検出できたときだけ」記録する。
    // 検出できない閉じ方もあるため、推測では記録しない。
    const end = () => {
      if (this.sessionEndSent) return;
      this.sessionEndSent = true;
      this.analytics.track('session_end');
    };
    window.addEventListener('pagehide', end);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') end();
    });
  }

  register(name: ScreenName, factory: ScreenFactory): void {
    this.screens.set(name, factory);
  }

  go(name: ScreenName, params: ScreenParams = {}): void {
    const factory = this.screens.get(name);
    if (!factory) throw new Error(`画面が登録されていません: ${name}`);
    if (this.unmount) {
      this.unmount();
      this.unmount = null;
    }
    this.root.replaceChildren();
    this.current = name;
    this.unmount = factory(this, params);
  }

  get muted(): boolean {
    return this.save.muted;
  }

  toggleMute(): boolean {
    const next = !this.save.muted;
    this.save.setMuted(next);
    sfx.setMuted(next);
    if (!next) sfx.ui();
    return next;
  }
}

/* ---------------- DOM の小さなヘルパー ---------------- */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

export function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}分${String(s).padStart(2, '0')}秒`;
}

/** 音量ボタン（全画面共通） */
export function muteButton(app: App): HTMLButtonElement {
  const btn = el('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': '効果音のオン・オフ',
  }) as HTMLButtonElement;
  const render = () => {
    btn.textContent = app.muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', app.muted ? 'true' : 'false');
  };
  render();
  btn.addEventListener('click', () => {
    app.toggleMute();
    render();
  });
  return btn;
}

export function backButton(app: App, to: ScreenName, params: ScreenParams = {}): HTMLButtonElement {
  const btn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'もどる' }, ['←']) as HTMLButtonElement;
  btn.addEventListener('click', () => {
    sfx.ui();
    app.go(to, params);
  });
  return btn;
}
