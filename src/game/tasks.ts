/**
 * 修復タスクの中核ロジック。
 * Canvas / DOM に依存させない（= 自動テストできるようにする）。
 * 座標はすべて「論理座標」(DESIGN_W x DESIGN_H) で扱う。
 */

export type StepKind = 'wipe' | 'polish' | 'fit' | 'final' | 'rotate';

export interface RepairStep {
  readonly id: string;
  readonly kind: StepKind;
  readonly title: string;
  readonly hint: string;
  /** 0..1 */
  readonly progress: number;
  readonly isDone: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ */
/* 1) 汚れ落とし: なぞって消す                                          */
/* ------------------------------------------------------------------ */

export interface ScrubMaskOptions {
  id: string;
  title: string;
  hint: string;
  rect: Rect;
  cols?: number;
  rows?: number;
  /** 汚れを置くかどうかの判定（品物の形に合わせて汚れを置く） */
  inside?: (x: number, y: number) => boolean;
  /** この割合まで落としたら完了扱い（残りは演出で消す） */
  doneThreshold?: number;
}

export class ScrubMask implements RepairStep {
  readonly id: string;
  readonly kind = 'wipe' as const;
  readonly title: string;
  readonly hint: string;
  readonly rect: Rect;
  readonly cols: number;
  readonly rows: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly doneThreshold: number;

  /** 0 = きれい, 1 = 汚れている */
  private cells: Float32Array;
  private active: Uint8Array;
  private totalDirt = 0;
  private remainingDirt = 0;
  /** 完了後のフェードアウト用 0..1 */
  fade = 1;

  constructor(opts: ScrubMaskOptions) {
    this.id = opts.id;
    this.title = opts.title;
    this.hint = opts.hint;
    this.rect = opts.rect;
    this.cols = opts.cols ?? 20;
    this.rows = opts.rows ?? 24;
    this.doneThreshold = opts.doneThreshold ?? 0.9;
    this.cellW = this.rect.w / this.cols;
    this.cellH = this.rect.h / this.rows;
    this.cells = new Float32Array(this.cols * this.rows);
    this.active = new Uint8Array(this.cols * this.rows);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const { x, y } = this.cellCenter(c, r);
        const on = opts.inside ? opts.inside(x, y) : true;
        this.active[i] = on ? 1 : 0;
        this.cells[i] = on ? 1 : 0;
        if (on) this.totalDirt += 1;
      }
    }
    this.remainingDirt = this.totalDirt;
  }

  cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.rect.x + (col + 0.5) * this.cellW,
      y: this.rect.y + (row + 0.5) * this.cellH,
    };
  }

  valueAt(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return 0;
    return this.cells[row * this.cols + col];
  }

  isActive(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    return this.active[row * this.cols + col] === 1;
  }

  /**
   * 指でなぞった位置の汚れを減らす。
   * @returns 実際に落ちた量（全体を 1 とした割合）
   */
  brush(px: number, py: number, radius: number, strength = 0.55): number {
    if (this.totalDirt === 0) return 0;
    const c0 = Math.max(0, Math.floor((px - radius - this.rect.x) / this.cellW));
    const c1 = Math.min(this.cols - 1, Math.floor((px + radius - this.rect.x) / this.cellW));
    const r0 = Math.max(0, Math.floor((py - radius - this.rect.y) / this.cellH));
    const r1 = Math.min(this.rows - 1, Math.floor((py + radius - this.rect.y) / this.cellH));
    let removed = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        if (this.active[i] === 0) continue;
        const v = this.cells[i];
        if (v <= 0) continue;
        const { x, y } = this.cellCenter(c, r);
        const d = Math.hypot(x - px, y - py);
        if (d > radius) continue;
        const falloff = 1 - d / radius;
        const next = Math.max(0, v - strength * falloff);
        removed += v - next;
        this.cells[i] = next;
      }
    }
    this.remainingDirt -= removed;
    if (this.remainingDirt < 0) this.remainingDirt = 0;
    return removed / this.totalDirt;
  }

  /** なぞった線分に沿って落とす（速くドラッグしても隙間が開かないように補間する） */
  brushLine(x0: number, y0: number, x1: number, y1: number, radius: number, strength = 0.55): number {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.45)));
    let removed = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      removed += this.brush(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, strength);
    }
    return removed;
  }

  get progress(): number {
    if (this.totalDirt === 0) return 1;
    const cleaned = 1 - this.remainingDirt / this.totalDirt;
    return Math.min(1, cleaned / this.doneThreshold);
  }

  get isDone(): boolean {
    return this.progress >= 1;
  }

  clearAll(): void {
    this.cells.fill(0);
    this.remainingDirt = 0;
  }
}

/* ------------------------------------------------------------------ */
/* 2) サビ磨き: 往復させて磨く                                          */
/* ------------------------------------------------------------------ */

export interface RustSpotDef {
  x: number;
  y: number;
  r: number;
}

export interface RustSpot extends RustSpotDef {
  /** 0 = サビだらけ, 1 = ピカピカ */
  wear: number;
}

export interface PolishTaskOptions {
  id: string;
  title: string;
  hint: string;
  spots: RustSpotDef[];
  /** 1スポットを磨き切るのに必要な移動距離 = r * strokeFactor */
  strokeFactor?: number;
  /** 往復（折り返し）1回あたりのボーナス */
  reversalBonus?: number;
}

export class PolishTask implements RepairStep {
  readonly id: string;
  readonly kind = 'polish' as const;
  readonly title: string;
  readonly hint: string;
  readonly spots: RustSpot[];
  /** 道具（磨き粉）で上書きするので readonly にしない */
  strokeFactor: number;
  readonly reversalBonus: number;

  private lastDir: { x: number; y: number } | null = null;
  reversalCount = 0;

  constructor(opts: PolishTaskOptions) {
    this.id = opts.id;
    this.title = opts.title;
    this.hint = opts.hint;
    this.strokeFactor = opts.strokeFactor ?? 9;
    this.reversalBonus = opts.reversalBonus ?? 0.05;
    this.spots = opts.spots.map((s) => ({ ...s, wear: 0 }));
  }

  /** 指を離したときに呼ぶ（方向の記憶をリセット） */
  endStroke(): void {
    this.lastDir = null;
  }

  /**
   * 線分ぶんこする。
   * @returns gained: 進んだ量(全体を1とした割合) / reversed: 往復したか / hit: サビに当たったか
   */
  rub(x0: number, y0: number, x1: number, y1: number): { gained: number; reversed: boolean; hit: boolean } {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return { gained: 0, reversed: false, hit: false };
    const dir = { x: dx / dist, y: dy / dist };

    let reversed = false;
    if (this.lastDir) {
      const dot = this.lastDir.x * dir.x + this.lastDir.y * dir.y;
      if (dot < -0.3) reversed = true;
    }
    this.lastDir = dir;
    if (reversed) this.reversalCount++;

    let gained = 0;
    let hit = false;
    const total = this.spots.length || 1;
    for (const s of this.spots) {
      if (s.wear >= 1) continue;
      const near =
        Math.hypot(x1 - s.x, y1 - s.y) <= s.r ||
        Math.hypot(x0 - s.x, y0 - s.y) <= s.r ||
        Math.hypot((x0 + x1) / 2 - s.x, (y0 + y1) / 2 - s.y) <= s.r;
      if (!near) continue;
      hit = true;
      const need = s.r * this.strokeFactor;
      let add = dist / need;
      if (reversed) add += this.reversalBonus;
      const before = s.wear;
      s.wear = Math.min(1, s.wear + add);
      gained += (s.wear - before) / total;
    }
    return { gained, reversed, hit };
  }

  get progress(): number {
    if (this.spots.length === 0) return 1;
    let sum = 0;
    for (const s of this.spots) sum += s.wear;
    return sum / this.spots.length;
  }

  get isDone(): boolean {
    return this.progress >= 0.999;
  }

  finishAll(): void {
    for (const s of this.spots) s.wear = 1;
  }
}

/* ------------------------------------------------------------------ */
/* 3) 部品の取り付け: ドラッグ＆ドロップ                                */
/* ------------------------------------------------------------------ */

export interface FitPartDef {
  id: string;
  label: string;
  /** 当たり判定の半径（見た目より大きめにして押しやすくする） */
  hitRadius: number;
  /** トレイ（画面下の部品置き場）での位置 */
  trayX: number;
  trayY: number;
  /** 取り付け先 */
  targetX: number;
  targetY: number;
  /** 吸い付く距離 */
  snapRadius?: number;
  /** 描画用の大きさ */
  size?: number;
}

export interface FitPart extends FitPartDef {
  x: number;
  y: number;
  placed: boolean;
  dragging: boolean;
  /** 失敗フィードバック用の残り時間(ms) */
  shake: number;
}

export interface FitTaskOptions {
  id: string;
  title: string;
  hint: string;
  parts: FitPartDef[];
  defaultSnapRadius?: number;
}

export class FitTask implements RepairStep {
  readonly id: string;
  readonly kind = 'fit' as const;
  readonly title: string;
  readonly hint: string;
  readonly parts: FitPart[];

  constructor(opts: FitTaskOptions) {
    const snap = opts.defaultSnapRadius ?? 46;
    this.id = opts.id;
    this.title = opts.title;
    this.hint = opts.hint;
    this.parts = opts.parts.map((p) => ({
      ...p,
      snapRadius: p.snapRadius ?? snap,
      size: p.size ?? 1,
      x: p.trayX,
      y: p.trayY,
      placed: false,
      dragging: false,
      shake: 0,
    }));
  }

  /** その座標で掴める部品（未設置のもののみ）。重なりは最も近いものを返す */
  grabAt(x: number, y: number): FitPart | null {
    let best: FitPart | null = null;
    let bestD = Infinity;
    for (const p of this.parts) {
      if (p.placed) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.hitRadius && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  drag(part: FitPart, x: number, y: number): void {
    if (part.placed) return;
    part.dragging = true;
    part.x = x;
    part.y = y;
  }

  /** 指を離したとき。近ければ吸い付いて設置、遠ければトレイに戻す */
  drop(part: FitPart): 'placed' | 'missed' {
    part.dragging = false;
    if (part.placed) return 'placed';
    const d = Math.hypot(part.x - part.targetX, part.y - part.targetY);
    if (d <= (part.snapRadius ?? 46)) {
      part.x = part.targetX;
      part.y = part.targetY;
      part.placed = true;
      return 'placed';
    }
    part.x = part.trayX;
    part.y = part.trayY;
    part.shake = 420;
    return 'missed';
  }

  isPlaced(id: string): boolean {
    return this.parts.some((p) => p.id === id && p.placed);
  }

  get progress(): number {
    if (this.parts.length === 0) return 1;
    return this.parts.filter((p) => p.placed).length / this.parts.length;
  }

  get isDone(): boolean {
    return this.progress >= 1;
  }

  finishAll(): void {
    for (const p of this.parts) {
      p.placed = true;
      p.dragging = false;
      p.x = p.targetX;
      p.y = p.targetY;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4) 最終動作確認: タップ                                              */
/* ------------------------------------------------------------------ */

export interface FinalTaskOptions {
  id: string;
  title: string;
  hint: string;
  x: number;
  y: number;
  hitRadius: number;
  label: string;
}

export class FinalTask implements RepairStep {
  readonly id: string;
  readonly kind = 'final' as const;
  readonly title: string;
  readonly hint: string;
  readonly x: number;
  readonly y: number;
  readonly hitRadius: number;
  readonly label: string;
  triggered = false;
  /** 押し込み演出 0..1 */
  press = 0;

  constructor(opts: FinalTaskOptions) {
    this.id = opts.id;
    this.title = opts.title;
    this.hint = opts.hint;
    this.x = opts.x;
    this.y = opts.y;
    this.hitRadius = opts.hitRadius;
    this.label = opts.label;
  }

  hitTest(x: number, y: number): boolean {
    return Math.hypot(x - this.x, y - this.y) <= this.hitRadius;
  }

  tap(x: number, y: number): boolean {
    if (this.triggered) return false;
    if (!this.hitTest(x, y)) return false;
    this.triggered = true;
    return true;
  }

  get progress(): number {
    return this.triggered ? 1 : 0;
  }

  get isDone(): boolean {
    return this.triggered;
  }
}

/* ------------------------------------------------------------------ */
/* 5) 回す: 中心のまわりを指でぐるっと回す（黒電話のダイヤルなど）     */
/* ------------------------------------------------------------------ */

export interface RotateTaskOptions {
  id: string;
  title: string;
  hint: string;
  /** 回転の中心 */
  x: number;
  y: number;
  /** 指を置いて回せる範囲の半径（見た目より大きめにする） */
  hitRadius: number;
  /** 何周ぶん回したら完了か（向きは問わない） */
  turns?: number;
  label: string;
}

/**
 * 回した角度の合計で進む工程。右回り・左回りのどちらでも進む（間違いをつくらない）。
 * 指を離すと、表示上の角度だけが元に戻る（ダイヤルが戻る動き）。進み具合は戻らない。
 */
export class RotateTask implements RepairStep {
  readonly id: string;
  readonly kind = 'rotate' as const;
  readonly title: string;
  readonly hint: string;
  readonly x: number;
  readonly y: number;
  readonly hitRadius: number;
  readonly label: string;
  readonly target: number;
  /** 回した角度の合計(rad) */
  swept = 0;
  /** 表示用の角度(rad)。指を離すと 0 に戻っていく */
  angle = 0;
  private lastA: number | null = null;

  constructor(opts: RotateTaskOptions) {
    this.id = opts.id;
    this.title = opts.title;
    this.hint = opts.hint;
    this.x = opts.x;
    this.y = opts.y;
    this.hitRadius = opts.hitRadius;
    this.label = opts.label;
    this.target = Math.PI * 2 * (opts.turns ?? 1.5);
  }

  hitTest(x: number, y: number): boolean {
    return Math.hypot(x - this.x, y - this.y) <= this.hitRadius;
  }

  get turning(): boolean {
    return this.lastA !== null;
  }

  /** 指を置いたとき。範囲内なら true */
  begin(x: number, y: number): boolean {
    if (!this.hitTest(x, y)) return false;
    this.lastA = Math.atan2(y - this.y, x - this.x);
    return true;
  }

  /**
   * 指を動かしたとき。
   * @returns この動きで回った角度(rad, 0以上)
   */
  move(x: number, y: number): number {
    if (this.lastA === null) return 0;
    // 中心に近すぎると角度がぶれるので数えない
    if (Math.hypot(x - this.x, y - this.y) < 10) return 0;
    const a = Math.atan2(y - this.y, x - this.x);
    let d = a - this.lastA;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.lastA = a;
    const gained = Math.abs(d);
    this.swept = Math.min(this.target, this.swept + gained);
    this.angle += d;
    return gained;
  }

  end(): void {
    this.lastA = null;
  }

  /** 毎フレーム呼ぶ。指を離している間、表示の角度を 0 に戻す */
  relax(dtMs: number): void {
    if (this.lastA !== null) return;
    this.angle *= Math.exp(-dtMs / 140);
    if (Math.abs(this.angle) < 0.002) this.angle = 0;
  }

  get progress(): number {
    return Math.min(1, this.swept / this.target);
  }

  get isDone(): boolean {
    return this.progress >= 1;
  }

  finishAll(): void {
    this.swept = this.target;
    this.lastA = null;
  }
}
