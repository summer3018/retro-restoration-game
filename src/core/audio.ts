/**
 * 効果音。音源ファイルは使わず WebAudio で合成する。
 * （著作権・ライセンスの問題が起きないようにするため）
 *
 * 初回のユーザー操作（タップ／クリック）まで AudioContext を作らない。
 */

type NodeLike = AudioNode;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastAt: Record<string, number> = {};
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  /** 初回のユーザー操作で呼ぶ */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 1.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // 少しだけ低域寄りにして「ざらっ」とした布の音に近づける
      last = (last + 0.16 * white) / 1.16;
      data[i] = last * 2.6;
    }
    return buf;
  }

  private ready(): boolean {
    return !!this.ctx && !!this.master && !this._muted;
  }

  /** 同じ音が鳴りすぎないように間引く */
  private throttle(key: string, intervalMs: number): boolean {
    const now = performance.now();
    if ((this.lastAt[key] ?? -Infinity) + intervalMs > now) return false;
    this.lastAt[key] = now;
    return true;
  }

  private env(node: NodeLike, peak: number, attack: number, decay: number): GainNode {
    const ctx = this.ctx as AudioContext;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    g.connect(this.master as GainNode);
    return g;
  }

  private noiseBurst(opts: {
    type: BiquadFilterType;
    freq: number;
    q: number;
    peak: number;
    attack: number;
    decay: number;
    sweepTo?: number;
  }): void {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.setValueAtTime(opts.freq, ctx.currentTime);
    if (opts.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, ctx.currentTime + opts.attack + opts.decay);
    }
    filter.Q.value = opts.q;
    src.connect(filter);
    this.env(filter, opts.peak, opts.attack, opts.decay);
    src.start();
    src.stop(ctx.currentTime + opts.attack + opts.decay + 0.05);
  }

  private tone(opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    peak: number;
    attack: number;
    decay: number;
    delay?: number;
  }): void {
    const ctx = this.ctx as AudioContext;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.attack + opts.decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.peak), t0 + opts.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.attack + opts.decay);
    osc.connect(g);
    g.connect(this.master as GainNode);
    osc.start(t0);
    osc.stop(t0 + opts.attack + opts.decay + 0.05);
  }

  /** 布で拭く音 */
  wipe(): void {
    if (!this.ready() || !this.throttle('wipe', 90)) return;
    this.noiseBurst({ type: 'bandpass', freq: 900, q: 0.8, peak: 0.1, attack: 0.012, decay: 0.1 });
  }

  /** 金属を磨く音 */
  polish(): void {
    if (!this.ready() || !this.throttle('polish', 80)) return;
    this.noiseBurst({ type: 'bandpass', freq: 2200, q: 2.4, peak: 0.075, attack: 0.01, decay: 0.12, sweepTo: 3600 });
  }

  /** 部品がはまる音 */
  snap(): void {
    if (!this.ready()) return;
    this.tone({ type: 'triangle', from: 520, to: 880, peak: 0.22, attack: 0.005, decay: 0.09 });
    this.noiseBurst({ type: 'highpass', freq: 2000, q: 0.7, peak: 0.08, attack: 0.004, decay: 0.05 });
  }

  /** 部品を持ち上げる音 */
  pick(): void {
    if (!this.ready() || !this.throttle('pick', 60)) return;
    this.tone({ type: 'sine', from: 660, to: 880, peak: 0.1, attack: 0.004, decay: 0.05 });
  }

  /** 置き場所が違ったときの音（きつくない低音） */
  miss(): void {
    if (!this.ready() || !this.throttle('miss', 180)) return;
    this.tone({ type: 'sine', from: 260, to: 170, peak: 0.16, attack: 0.008, decay: 0.16 });
  }

  /** ダイヤルを回す / 秒針のカチッ */
  tick(): void {
    if (!this.ready() || !this.throttle('tick', 70)) return;
    this.noiseBurst({ type: 'bandpass', freq: 3200, q: 6, peak: 0.07, attack: 0.002, decay: 0.03 });
  }

  /** 画面のボタン */
  ui(): void {
    if (!this.ready() || !this.throttle('ui', 60)) return;
    this.tone({ type: 'sine', from: 440, to: 620, peak: 0.12, attack: 0.005, decay: 0.07 });
  }

  /** 工程が1つ終わったとき */
  stepClear(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sine', from: 660, peak: 0.14, attack: 0.008, decay: 0.12 });
    this.tone({ type: 'sine', from: 880, peak: 0.12, attack: 0.008, decay: 0.16, delay: 0.09 });
  }

  /** 修復完成 */
  complete(): void {
    if (!this.ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone({ type: 'sine', from: f, peak: 0.16, attack: 0.01, decay: 0.5, delay: i * 0.11 });
      this.tone({ type: 'triangle', from: f * 2, peak: 0.05, attack: 0.01, decay: 0.3, delay: i * 0.11 });
    });
  }

  /** ラジオの電源 / カメラのシャッター前の「ブーン」 */
  power(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sawtooth', from: 110, to: 220, peak: 0.1, attack: 0.03, decay: 0.45 });
    this.noiseBurst({ type: 'bandpass', freq: 1400, q: 1.2, peak: 0.05, attack: 0.02, decay: 0.4 });
  }

  /** カメラのシャッター */
  shutter(): void {
    if (!this.ready()) return;
    this.noiseBurst({ type: 'bandpass', freq: 2600, q: 3, peak: 0.2, attack: 0.002, decay: 0.05 });
    this.noiseBurst({ type: 'bandpass', freq: 1500, q: 3, peak: 0.16, attack: 0.002, decay: 0.07 });
    this.tone({ type: 'square', from: 300, to: 180, peak: 0.08, attack: 0.003, decay: 0.08, delay: 0.05 });
  }
}

export const sfx = new Sfx();
