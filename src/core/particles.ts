/** 達成感の演出用の、ごく軽いパーティクル。 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  kind: 'spark' | 'dust' | 'ring';
}

export class Particles {
  readonly items: Particle[] = [];
  private max = 220;

  burst(x: number, y: number, count: number, kind: Particle['kind'] = 'spark', spread = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 2.4) * spread;
      const life = 520 + Math.random() * 700;
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'spark' ? 0.6 : 0),
        life,
        maxLife: life,
        size: kind === 'dust' ? 1.5 + Math.random() * 2.5 : 1.6 + Math.random() * 3,
        hue: kind === 'dust' ? 32 : 38 + Math.random() * 20,
        kind,
      });
    }
  }

  /** 拭いたときに出る細かいホコリ */
  dust(x: number, y: number, count = 3): void {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 0.3 + Math.random() * 0.9;
      const life = 320 + Math.random() * 380;
      this.items.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.25,
        life,
        maxLife: life,
        size: 1.2 + Math.random() * 2,
        hue: 30,
        kind: 'dust',
      });
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 16.6667;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dtMs;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'spark' ? 0.035 : 0.012) * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, t));
      if (p.kind === 'dust') {
        ctx.fillStyle = `hsl(${p.hue} 25% 72%)`;
      } else {
        ctx.fillStyle = `hsl(${p.hue} 92% ${62 + (1 - t) * 20}%)`;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.items.length = 0;
  }
}
