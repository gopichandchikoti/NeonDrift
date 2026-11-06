import type Phaser from 'phaser';
import { SHAPES, type Hazard, type Pickup } from '../../entities/entities';

type Gfx = Phaser.GameObjects.Graphics;
type Pt = [number, number];

/** The two layers everything draws on: solid shapes, and additive glow on top. */
export interface Pen {
  g: Gfx;
  glow: Gfx;
}

const ORANGE = 0xff8a2b;
const RED = 0xff3b5c;
const AMBER = 0xffc13b;
const TRAFFIC = 0x2a2740;

/** Rotates local (u forward, v right) into world coordinates around (x, y) for the angle. */
function local(x: number, y: number, angle: number): (u: number, v: number) => Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (u, v) => [x + c * u - s * v, y + s * u + c * v];
}

const pt = (pts: readonly Pt[], i: number): Pt => pts[i] ?? [0, 0];

/** Fills a convex polygon as a triangle fan. */
function fillPoly(g: Gfx, pts: readonly Pt[]): void {
  const [x0, y0] = pt(pts, 0);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pt(pts, i);
    const [x2, y2] = pt(pts, i + 1);
    g.fillTriangle(x0, y0, x1, y1, x2, y2);
  }
}

function outline(g: Gfx, pts: readonly Pt[]): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.strokePath();
}

/** The four corners of a box centred on (0, 0) in the hazard's own frame, grown by `pad`. */
function box(at: (u: number, v: number) => Pt, along: number, side: number, pad = 0): Pt[] {
  const a = along + pad;
  const s = side + pad;
  return [at(-a, -s), at(a, -s), at(a, s), at(-a, s)];
}

function drawCone({ g, glow }: Pen, h: Hazard): void {
  const at = local(h.x, h.y, h.angle);
  const tri: Pt[] = [at(-9, 0), at(5, -9), at(5, 9)];
  glow.fillStyle(ORANGE, 0.16);
  glow.fillCircle(h.x, h.y, 22);
  g.fillStyle(ORANGE, 1);
  fillPoly(g, tri);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(h.x, h.y, 2.6);
  glow.lineStyle(2, 0xffd9a8, 0.9);
  outline(glow, tri);
}

function drawBlock({ g, glow }: Pen, h: Hazard): void {
  const at = local(h.x, h.y, h.angle);
  const { along, side } = SHAPES.block;
  const corners = box(at, along, side);
  glow.fillStyle(RED, 0.14);
  fillPoly(glow, box(at, along, side, 7));
  g.fillStyle(0x3a0f1c, 1);
  fillPoly(g, corners);
  glow.lineStyle(2.4, RED, 1);
  outline(glow, corners);
  // Diagonal hatching: a shape cue that does not rely on colour.
  glow.lineStyle(2.2, 0xffd0d8, 0.85);
  for (let v = -side + 8; v < side; v += 14) {
    const [ax, ay] = at(-along, v - 4);
    const [bx, by] = at(along, v + 4);
    glow.lineBetween(ax, ay, bx, by);
  }
}

function drawGate({ g, glow }: Pen, h: Hazard, t: number): void {
  const at = local(h.x, h.y, h.angle);
  const { along, side } = SHAPES.gate;
  const corners = box(at, along, side);
  // The rail the gate slides on: centred on its resting position, as wide as its swing.
  const guide = h.amp + side + 6;
  const shift = h.baseLat - h.lat;
  glow.lineStyle(1.5, AMBER, 0.22);
  const [ra, rb] = [at(0, shift - guide), at(0, shift + guide)];
  glow.lineBetween(ra[0], ra[1], rb[0], rb[1]);
  glow.fillStyle(AMBER, 0.14);
  glow.fillCircle(h.x, h.y, 34);
  g.fillStyle(0x3a2a08, 1);
  fillPoly(g, corners);
  glow.lineStyle(2.6, AMBER, 1);
  outline(glow, corners);
  // Chevrons that blink along the bar say "this one moves".
  const lit = Math.floor(t * 6) % 3;
  for (let k = 0; k < 3; k++) {
    glow.lineStyle(2.4, 0xffffff, k === lit ? 0.95 : 0.35);
    const u = -side + 10 + k * ((side * 2 - 20) / 2);
    const [a, b, c] = [at(-4, u - 4), at(0, u), at(4, u - 4)];
    glow.lineBetween(a[0], a[1], b[0], b[1]);
    glow.lineBetween(b[0], b[1], c[0], c[1]);
  }
}

function drawBlinkers({ glow }: Pen, h: Hazard, t: number): void {
  const signalling = h.targetLat !== h.baseLat && h.laneT > 0 && h.laneT < 1;
  if (!signalling || Math.floor(t * 6) % 2 === 0) return;
  const at = local(h.x, h.y, h.angle);
  const dir = Math.sign(h.targetLat - h.baseLat);
  for (const u of [14, -14]) {
    const [x, y] = at(u, dir * 10);
    glow.fillStyle(AMBER, 0.28);
    glow.fillCircle(x, y, 11);
    glow.fillStyle(AMBER, 1);
    glow.fillCircle(x, y, 3.4);
  }
}

function drawTraffic(pen: Pen, h: Hazard, t: number): void {
  const { g, glow } = pen;
  const at = local(h.x, h.y, h.angle);
  const body: Pt[] = [at(17, 0), at(8, -8), at(-14, -9), at(-17, -5), at(-17, 5), at(-14, 9), at(8, 8)];
  glow.fillStyle(0xffffff, 0.07);
  glow.fillCircle(h.x, h.y, 26);
  g.fillStyle(TRAFFIC, 1);
  fillPoly(g, body);
  glow.lineStyle(2, 0xdad4ff, 0.8);
  outline(glow, body);
  glow.fillStyle(RED, 1);
  for (const v of [-6.5, 6.5]) {
    const [x, y] = at(-17, v);
    glow.fillCircle(x, y, 2.4);
  }
  drawBlinkers(pen, h, t);
}

export function drawHazard(pen: Pen, h: Hazard, t: number): void {
  if (h.hit && h.kind !== 'traffic') return;
  switch (h.kind) {
    case 'cone':
      return drawCone(pen, h);
    case 'block':
      return drawBlock(pen, h);
    case 'gate':
      return drawGate(pen, h, t);
    case 'traffic':
      return drawTraffic(pen, h, t);
  }
}

const SPARK = 0xfff36b;
const SHIELD = 0x37e2ff;
const MAGNET = 0xff3fa4;

function drawSpark(glow: Gfx, p: Pickup, t: number): void {
  const r = 6.5 + Math.sin(t * 5 + p.s * 0.05) * 0.6;
  glow.fillStyle(SPARK, 0.22);
  glow.fillCircle(p.x, p.y, 13);
  glow.fillStyle(SPARK, 1);
  const w = Math.abs(Math.cos(t * 3 + p.s * 0.02)) * r + 1.5;
  glow.fillTriangle(p.x, p.y - r, p.x + w, p.y, p.x, p.y + r);
  glow.fillTriangle(p.x, p.y - r, p.x - w, p.y, p.x, p.y + r);
}

function drawShieldToken(glow: Gfx, p: Pickup): void {
  const hex: Pt[] = Array.from({ length: 6 }, (_, i): Pt => {
    const a = (i * Math.PI) / 3;
    return [p.x + Math.cos(a) * 13, p.y + Math.sin(a) * 13];
  });
  glow.lineStyle(2.4, SHIELD, 1);
  outline(glow, hex);
  glow.fillStyle(SHIELD, 0.35);
  glow.fillCircle(p.x, p.y, 7);
}

function drawMagnetToken(glow: Gfx, p: Pickup): void {
  glow.lineStyle(2.4, MAGNET, 1);
  glow.beginPath();
  glow.arc(p.x, p.y, 10, Math.PI, 0, false);
  glow.moveTo(p.x - 10, p.y);
  glow.lineTo(p.x - 10, p.y + 9);
  glow.moveTo(p.x + 10, p.y);
  glow.lineTo(p.x + 10, p.y + 9);
  glow.strokePath();
  glow.fillStyle(0xffffff, 1);
  glow.fillRect(p.x - 12, p.y + 7, 5, 4);
  glow.fillRect(p.x + 7, p.y + 7, 5, 4);
}

export function drawPickup(glow: Gfx, p: Pickup, t: number): void {
  if (p.taken) return;
  if (p.kind === 'spark') return drawSpark(glow, p, t);
  const color = p.kind === 'shield' ? SHIELD : MAGNET;
  glow.fillStyle(color, 0.16);
  glow.fillCircle(p.x, p.y, 24 + Math.sin(t * 5 + p.s * 0.05) * 1.5);
  if (p.kind === 'shield') drawShieldToken(glow, p);
  else drawMagnetToken(glow, p);
}
