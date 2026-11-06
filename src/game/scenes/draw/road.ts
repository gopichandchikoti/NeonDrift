import type Phaser from 'phaser';
import type { DistrictTheme } from '../../levels/districts';
import { at, STEP, type Track } from '../../physics/track';

type Gfx = Phaser.GameObjects.Graphics;

export interface RoadStyle {
  /** Samples skipped between drawn points: 1 is finest. */
  stride: number;
  /** Number of glow passes on the barrier neon (1-3). */
  glow: number;
}

export interface Edge {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

type Edges = Array<[number, Edge]>;

function edgeAt(track: Track, i: number): Edge {
  const a = at(track.angles, i);
  const hw = at(track.halfWidths, i);
  const x = at(track.xs, i);
  const y = at(track.ys, i);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  return { lx: x - nx * hw, ly: y - ny * hw, rx: x + nx * hw, ry: y + ny * hw };
}

export function visibleRange(track: Track, s0: number, s1: number): [number, number] {
  const last = track.xs.length - 1;
  return [Math.max(0, Math.floor(s0 / STEP)), Math.min(last, Math.ceil(s1 / STEP))];
}

/** The road's left and right edge points for samples i0..i1, `stride` apart (always including the last one). */
export function roadEdges(track: Track, range: [number, number], stride: number): Edges {
  const [i0, i1] = range;
  const out: Edges = [];
  for (let i = i0; i <= i1; i += stride) out.push([i, edgeAt(track, i)]);
  if (out.length > 0 && out[out.length - 1]?.[0] !== i1) out.push([i1, edgeAt(track, i1)]);
  return out;
}

const pair = (edges: Edges, k: number): [number, Edge] => edges[k] ?? [0, { lx: 0, ly: 0, rx: 0, ry: 0 }];

/** Asphalt, with a faint banding that streams past as the car moves, so speed reads even on a plain straight. */
export function drawAsphalt(g: Gfx, edges: Edges, theme: DistrictTheme): void {
  for (let k = 1; k < edges.length; k++) {
    const [ia, a] = pair(edges, k - 1);
    const [, b] = pair(edges, k);
    const band = Math.floor((ia * STEP) / 96) % 2 === 0;
    g.fillStyle(band ? theme.road : theme.road + 0x050407, 1);
    g.fillTriangle(a.lx, a.ly, a.rx, a.ry, b.lx, b.ly);
    g.fillTriangle(a.rx, a.ry, b.rx, b.ry, b.lx, b.ly);
  }
}

const GLOW_WIDTHS = [16, 8, 3];
const GLOW_ALPHAS = [0.07, 0.2, 1];

function strokeEdge(g: Gfx, edges: Edges, side: 'l' | 'r', look: { color: number; style: RoadStyle }): void {
  for (let pass = 3 - look.style.glow; pass < 3; pass++) {
    g.lineStyle(GLOW_WIDTHS[pass] ?? 3, look.color, GLOW_ALPHAS[pass] ?? 1);
    g.beginPath();
    edges.forEach(([, e], k) => {
      const x = side === 'l' ? e.lx : e.rx;
      const y = side === 'l' ? e.ly : e.ry;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.strokePath();
  }
}

/** The neon barriers: left is one colour and right the other, so the car's orientation is never in doubt. */
export function drawBarriers(g: Gfx, edges: Edges, theme: DistrictTheme, style: RoadStyle): void {
  strokeEdge(g, edges, 'l', { color: theme.edgeLeft, style });
  strokeEdge(g, edges, 'r', { color: theme.edgeRight, style });
}

/** A thin flat rectangle (used for dashes) centred on (x, y), `length` along the angle and `width` across. */
function strip(g: Gfx, c: { x: number; y: number; angle: number }, length: number, width: number): void {
  const cos = Math.cos(c.angle);
  const sin = Math.sin(c.angle);
  const [l, w] = [length / 2, width / 2];
  const p = (u: number, v: number): [number, number] => [c.x + cos * u - sin * v, c.y + sin * u + cos * v];
  const [a, b, d, e] = [p(-l, -w), p(l, -w), p(l, w), p(-l, w)];
  g.fillTriangle(a[0], a[1], b[0], b[1], d[0], d[1]);
  g.fillTriangle(a[0], a[1], d[0], d[1], e[0], e[1]);
}

/** A "V" lying on the road whose tip points toward the side the corner turns to. */
function drawChevron(g: Gfx, p: { x: number; y: number; angle: number }, dir: number): void {
  const tx = Math.cos(p.angle);
  const ty = Math.sin(p.angle);
  const nx = -ty * dir;
  const ny = tx * dir;
  const tip = { x: p.x + nx * 8, y: p.y + ny * 8 };
  for (const side of [-1, 1]) {
    g.lineBetween(tip.x, tip.y, p.x - nx * 2 + tx * 9 * side, p.y - ny * 2 + ty * 9 * side);
  }
}

function drawChevrons(g: Gfx, track: Track, range: [number, number], theme: DistrictTheme): void {
  g.lineStyle(4, theme.chevron, 0.5);
  for (const corner of track.corners) {
    const start = Math.max(corner.startS, range[0] * STEP);
    const end = Math.min(corner.endS, range[1] * STEP);
    for (let s = Math.ceil(start / 80) * 80; s < end; s += 80) {
      const half = track.poseAt(s).halfWidth;
      drawChevron(g, track.pointAt(s, -corner.dir * half * 0.58), corner.dir);
    }
  }
}

/** Dashed centre line and chevrons that point the way through each corner. */
export function drawMarkings(g: Gfx, track: Track, range: [number, number], theme: DistrictTheme): void {
  g.fillStyle(theme.paint, 1);
  for (let i = Math.ceil(range[0] / 12) * 12; i <= range[1]; i += 12) {
    strip(g, { x: at(track.xs, i), y: at(track.ys, i), angle: at(track.angles, i) }, 28, 3.2);
  }
  drawChevrons(g, track, range, theme);
}

/** A chequered line across the road at distance s. */
export function drawLine(g: Gfx, track: Track, s: number, glow: number): void {
  const half = track.poseAt(s).halfWidth;
  const cells = 12;
  const size = (half * 2) / cells;
  for (let k = 0; k < cells; k++) {
    for (let row = 0; row < 2; row++) {
      const p = track.pointAt(s + row * 8 - 4, -half + (k + 0.5) * size);
      g.fillStyle((k + row) % 2 === 0 ? 0xffffff : 0x14111c, 1);
      strip(g, p, 8, size);
    }
  }
  g.lineStyle(10, glow, 0.16);
  const a = track.pointAt(s, -half);
  const b = track.pointAt(s, half);
  g.lineBetween(a.x, a.y, b.x, b.y);
}
