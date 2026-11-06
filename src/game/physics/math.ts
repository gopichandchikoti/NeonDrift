export const TAU = Math.PI * 2;

/** Wraps an angle into [-PI, PI). */
export function wrapAngle(angle: number): number {
  return angle - TAU * Math.floor((angle + Math.PI) / TAU);
}

/** The signed smallest rotation that takes `from` to `to`. */
export function angleDiff(to: number, from: number): number {
  return wrapAngle(to - from);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Moves `value` toward `target` by at most `maxStep`. */
export function approach(value: number, target: number, maxStep: number): number {
  if (value < target) return Math.min(target, value + maxStep);
  return Math.max(target, value - maxStep);
}

/** Interpolates angles along the short way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(b, a) * t;
}

export interface Vec {
  x: number;
  y: number;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Distance from point p to segment a-b. */
export function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
