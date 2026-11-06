import type Phaser from 'phaser';
import { pieceColor, type CarDesign, type Palette } from '../../cosmetics';
import type { Pen } from './objects';

type Gfx = Phaser.GameObjects.Graphics;

export interface CarPose {
  x: number;
  y: number;
  heading: number;
}

/** Which car to draw: its shape and its colours. */
export interface CarLook {
  design: CarDesign;
  palette: Palette;
}

export interface CarFx {
  boosting: boolean;
  shield: boolean;
  magnet: boolean;
  /** Seconds, for flicker and pulses. */
  t: number;
  /** True during the short invulnerable window after a shield break: the car blinks. */
  blink: boolean;
  /** -1 / 0 / 1: the direction the thumb is steering, shown as a lit indicator. */
  steer: number;
}

function fillPolygon(g: Gfx, pts: ReadonlyArray<[number, number]>): void {
  const first = pts[0];
  if (!first) return;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i] as [number, number];
    const b = pts[i + 1] as [number, number];
    g.fillTriangle(first[0], first[1], a[0], a[1], b[0], b[1]);
  }
}

function transformed(pts: readonly number[], pose: CarPose, scale: number): Array<[number, number]> {
  const c = Math.cos(pose.heading);
  const s = Math.sin(pose.heading);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i += 2) {
    const u = (pts[i] ?? 0) * scale;
    const v = (pts[i + 1] ?? 0) * scale;
    out.push([pose.x + c * u - s * v, pose.y + s * u + c * v]);
  }
  return out;
}

function drawFlame(glow: Gfx, pose: CarPose, palette: Palette, t: number): void {
  const len = 22 + Math.sin(t * 60) * 5 + Math.sin(t * 37) * 3;
  const flame = [-16, -4, -16 - len, 0, -16, 4];
  glow.fillStyle(palette.glow, 0.35);
  fillPolygon(glow, transformed([-14, -7, -16 - len * 1.5, 0, -14, 7], pose, 1));
  glow.fillStyle(0xffffff, 0.9);
  fillPolygon(glow, transformed(flame, pose, 1));
}

function drawShield(glow: Gfx, pose: CarPose, palette: Palette, t: number): void {
  const pulse = 1 + Math.sin(t * 7) * 0.05;
  glow.fillStyle(palette.glow, 0.1);
  glow.fillCircle(pose.x, pose.y, 30 * pulse);
  glow.lineStyle(2.4, palette.glow, 0.9);
  glow.strokeCircle(pose.x, pose.y, 27 * pulse);
}

/** Draws one car: soft glow, hull, then glass and trim. Shape differs per design; size and hit box never do. */
export function drawCar({ g, glow }: Pen, pose: CarPose, look: CarLook, fx: CarFx): void {
  const { design, palette } = look;
  if (fx.blink) return;
  if (fx.boosting) drawFlame(glow, pose, palette, fx.t);
  glow.fillStyle(palette.glow, 0.13);
  glow.fillCircle(pose.x, pose.y, 30);
  glow.fillStyle(palette.glow, 0.2);
  for (const piece of design.pieces) {
    if (piece.layer === 'body') fillPolygon(glow, transformed(piece.pts, pose, 1.28));
  }
  for (const piece of design.pieces) {
    g.fillStyle(pieceColor(piece.layer, palette), 1);
    fillPolygon(g, transformed(piece.pts, pose, 1));
  }
  glow.fillStyle(0xff3b5c, 1);
  for (const [x, y] of transformed([-17, -6.5, -17, 6.5], pose, 1)) glow.fillCircle(x, y, 2.2);
  if (fx.steer !== 0) drawIndicator(glow, pose, fx.steer);
  if (fx.shield) drawShield(glow, pose, palette, fx.t);
  if (fx.magnet) {
    glow.lineStyle(1.5, 0xff3fa4, 0.45);
    glow.strokeCircle(pose.x, pose.y, 40 + Math.sin(fx.t * 9) * 3);
  }
}

/** The lit lamp on the side the thumb is steering toward. */
function drawIndicator(glow: Gfx, pose: CarPose, steer: number): void {
  const [x, y] = transformed([14, steer * 8.5], pose, 1)[0] ?? [pose.x, pose.y];
  glow.fillStyle(0xffc13b, 0.9);
  glow.fillCircle(x, y, 2.6);
}
