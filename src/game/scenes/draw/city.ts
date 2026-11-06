import type { DistrictTheme } from '../../levels/districts';
import { Rng } from '../../physics/rng';
import { at, type Track } from '../../physics/track';
import type { Pen } from './objects';

type Pt = [number, number];

interface Building {
  s: number;
  corners: Pt[];
  height: number;
  /** Colour of the neon sign on the roof edge facing the road, or -1 for none. */
  sign: number;
  /** Indices of the two corners on the roof edge nearest the road. */
  near: [number, number];
}

const CELL = 180;
const SPACING = 130;
/** How far the roof of a 100-unit-tall building leans away from the camera focus. */
const LEAN = 0.0019;

export interface CityStyle {
  theme: DistrictTheme;
  /** Draw side walls (off on low quality). */
  walls: boolean;
}

/** Corners of a building footprint, in order: back-left, front-left, front-right, back-right of the road frame. */
function footprint(center: { x: number; y: number; angle: number }, depth: number, width: number): Pt[] {
  const c = Math.cos(center.angle);
  const s = Math.sin(center.angle);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) => [
    center.x + (c * a * depth) / 2 - (s * b * width) / 2,
    center.y + (s * a * depth) / 2 + (c * b * width) / 2,
  ]);
}

const corner = (pts: readonly Pt[], i: number): Pt => pts[i] ?? [0, 0];

/**
 * Procedural rooftops along both sides of the road, built lazily as the road grows. Each building is seen from
 * above: its roof is shifted away from the camera focus in proportion to its height, which gives the cheap
 * parallax that makes the city feel solid without any 3D.
 */
export class City {
  private readonly buildings: Building[] = [];
  private readonly grid = new Map<string, number[]>();
  private builtTo = 0;
  private indexed = 0;
  private readonly rng: Rng;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  }

  private index(track: Track): void {
    for (; this.indexed < track.xs.length; this.indexed += 4) {
      const k = this.key(at(track.xs, this.indexed), at(track.ys, this.indexed));
      const list = this.grid.get(k);
      if (list) list.push(this.indexed);
      else this.grid.set(k, [this.indexed]);
    }
  }

  private clearOfRoad(track: Track, [x, y]: Pt, margin: number): boolean {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const near = this.grid.get(`${cx + dx},${cy + dy}`) ?? [];
        const hit = near.some((i) => {
          const reach = at(track.halfWidths, i) + margin;
          return Math.hypot(at(track.xs, i) - x, at(track.ys, i) - y) < reach;
        });
        if (hit) return false;
      }
    }
    return true;
  }

  /** Builds rooftops for the road up to distance `upTo`. */
  ensure(track: Track, upTo: number, signs: readonly number[]): void {
    this.index(track);
    const end = Math.min(upTo, track.length);
    for (let s = this.builtTo; s < end; s += SPACING) {
      for (const side of [-1, 1]) this.tryPlace(track, { s, side }, signs);
      this.builtTo = s + SPACING;
    }
  }

  private tryPlace(track: Track, spot: { s: number; side: number }, signs: readonly number[]): void {
    const r = this.rng;
    const along = spot.s + r.range(-35, 35);
    const width = r.range(60, 150);
    const depth = r.range(70, 150);
    const lat = spot.side * (track.poseAt(along).halfWidth + 46 + width / 2 + r.range(0, 150));
    const center = track.pointAt(along, lat);
    const corners = footprint(center, depth, width);
    if (!corners.every((p) => this.clearOfRoad(track, p, 30))) return;
    if (!this.clearOfRoad(track, [center.x, center.y], 40)) return;
    // The roof edge nearest the road: for a building on the right (+1) it is the pair with the lower lateral.
    this.buildings.push({
      s: along,
      corners,
      height: r.range(18, 95),
      sign: r.chance(0.4) && signs.length > 0 ? r.pick(signs) : -1,
      near: spot.side > 0 ? [0, 1] : [2, 3],
    });
    this.buildings.sort((x, y) => x.s - y.s);
  }

  /** Draws buildings with s in [range[0], range[1]], leaning away from the focus point. */
  draw(pen: Pen, focus: { x: number; y: number }, range: [number, number], style: CityStyle): void {
    for (const b of this.buildings) {
      if (b.s < range[0]) continue;
      if (b.s > range[1]) break;
      this.drawOne(pen, focus, b, style);
    }
  }

  private drawOne({ g, glow }: Pen, focus: { x: number; y: number }, b: Building, style: CityStyle): void {
    const k = LEAN * b.height;
    const roof = b.corners.map(([x, y]): Pt => [x + (x - focus.x) * k, y + (y - focus.y) * k]);
    if (style.walls) {
      g.fillStyle(style.theme.wall, 1);
      for (let i = 0; i < 4; i++) {
        const [a, c] = [corner(b.corners, i), corner(b.corners, (i + 1) % 4)];
        const [ra, rc] = [corner(roof, i), corner(roof, (i + 1) % 4)];
        g.fillTriangle(a[0], a[1], c[0], c[1], rc[0], rc[1]);
        g.fillTriangle(a[0], a[1], rc[0], rc[1], ra[0], ra[1]);
      }
    }
    const [r0, r1, r2, r3] = [corner(roof, 0), corner(roof, 1), corner(roof, 2), corner(roof, 3)];
    g.fillStyle(style.theme.roof, 1);
    g.fillTriangle(r0[0], r0[1], r1[0], r1[1], r2[0], r2[1]);
    g.fillTriangle(r0[0], r0[1], r2[0], r2[1], r3[0], r3[1]);
    glow.lineStyle(1.8, style.theme.edgeLeft, 0.3);
    glow.strokePoints(roof.map(([x, y]) => ({ x, y })), true);
    if (b.sign >= 0) this.drawSign(glow, b, roof);
  }

  private drawSign(glow: Pen['glow'], b: Building, roof: Pt[]): void {
    const [ax, ay] = corner(roof, b.near[0]);
    const [bx, by] = corner(roof, b.near[1]);
    glow.lineStyle(10, b.sign, 0.12);
    glow.lineBetween(ax, ay, bx, by);
    glow.lineStyle(3, b.sign, 0.85);
    glow.lineBetween(ax, ay, bx, by);
  }

  get count(): number {
    return this.buildings.length;
  }
}
