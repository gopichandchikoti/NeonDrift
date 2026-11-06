import type Phaser from 'phaser';

type Gfx = Phaser.GameObjects.Graphics;

const TRAIL_POINTS = 150;
const TRAIL_LIFE = 1.7;

/** Glowing tire marks that fade over a couple of seconds. Each wheel is a ring buffer of points. */
export class Trails {
  private readonly xs = [new Float32Array(TRAIL_POINTS), new Float32Array(TRAIL_POINTS)];
  private readonly ys = [new Float32Array(TRAIL_POINTS), new Float32Array(TRAIL_POINTS)];
  private readonly born = [new Float32Array(TRAIL_POINTS), new Float32Array(TRAIL_POINTS)];
  private readonly breaks = [new Uint8Array(TRAIL_POINTS), new Uint8Array(TRAIL_POINTS)];
  private head = 0;
  private count = 0;
  private lastWasMark = false;

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.lastWasMark = false;
  }

  /** Adds a point for each rear wheel, or ends the current mark when the car is not sliding. */
  add(wheels: ReadonlyArray<[number, number]>, sliding: boolean, now: number): void {
    if (!sliding) {
      this.lastWasMark = false;
      return;
    }
    for (let w = 0; w < 2; w++) {
      const [x, y] = wheels[w] as [number, number];
      (this.xs[w] as Float32Array)[this.head] = x;
      (this.ys[w] as Float32Array)[this.head] = y;
      (this.born[w] as Float32Array)[this.head] = now;
      (this.breaks[w] as Uint8Array)[this.head] = this.lastWasMark ? 0 : 1;
    }
    this.head = (this.head + 1) % TRAIL_POINTS;
    this.count = Math.min(TRAIL_POINTS, this.count + 1);
    this.lastWasMark = true;
  }

  draw(glow: Gfx, color: number, now: number): void {
    for (let w = 0; w < 2; w++) {
      const xs = this.xs[w] as Float32Array;
      const ys = this.ys[w] as Float32Array;
      const born = this.born[w] as Float32Array;
      const brk = this.breaks[w] as Uint8Array;
      let previous = -1;
      for (let k = this.count; k > 0; k--) {
        const i = (this.head - k + TRAIL_POINTS) % TRAIL_POINTS;
        const age = (now - (born[i] as number)) / TRAIL_LIFE;
        if (age >= 1) {
          previous = -1;
          continue;
        }
        if (previous >= 0 && !brk[i]) {
          const fresh = 1 - age;
          glow.lineStyle(4, color, 0.5 * fresh * fresh + 0.03);
          glow.lineBetween(xs[previous] as number, ys[previous] as number, xs[i] as number, ys[i] as number);
        }
        previous = i;
      }
    }
  }
}

export interface ParticleSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  size: number;
  drag?: number;
}

export interface Burst {
  count: number;
  color: number;
  speed: number;
  /** Centre direction in radians, and how wide the cone is. Defaults to a full circle. */
  angle?: number;
  spread?: number;
}

const MAX_PARTICLES = 260;

/** A fixed pool of additive sparks, so effects never allocate while the game runs. */
export class Particles {
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly max = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES);
  private readonly drag = new Float32Array(MAX_PARTICLES);
  private readonly color = new Uint32Array(MAX_PARTICLES);
  private cursor = 0;
  /** 0..1: scales how many particles are emitted (quality setting). */
  density = 1;

  clear(): void {
    this.life.fill(0);
  }

  emit(p: ParticleSpec): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    this.x[i] = p.x;
    this.y[i] = p.y;
    this.vx[i] = p.vx;
    this.vy[i] = p.vy;
    this.life[i] = p.life;
    this.max[i] = p.life;
    this.size[i] = p.size;
    this.drag[i] = p.drag ?? 2.2;
    this.color[i] = p.color;
  }

  /** Emits sparks flying outward from a point, within an angular cone around `burst.angle` (default: all round). */
  burst(x: number, y: number, burst: Burst): void {
    const { count, color, speed, angle = 0, spread = Math.PI * 2 } = burst;
    const n = Math.max(1, Math.round(count * this.density));
    for (let k = 0; k < n; k++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.75);
      const life = 0.35 + Math.random() * 0.5;
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, color, size: 1.6 + Math.random() * 2.4 });
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if ((this.life[i] as number) <= 0) continue;
      this.life[i] = (this.life[i] as number) - dt;
      const keep = Math.exp(-(this.drag[i] as number) * dt);
      this.vx[i] = (this.vx[i] as number) * keep;
      this.vy[i] = (this.vy[i] as number) * keep;
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
    }
  }

  draw(glow: Gfx): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life = this.life[i] as number;
      if (life <= 0) continue;
      const f = life / (this.max[i] as number);
      glow.fillStyle(this.color[i] as number, Math.min(1, f * 1.6));
      glow.fillCircle(this.x[i] as number, this.y[i] as number, (this.size[i] as number) * (0.5 + f * 0.5));
    }
  }
}
