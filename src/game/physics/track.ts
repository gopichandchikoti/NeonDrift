import { segmentLength } from './track-dsl';
import type { Corner, Segment } from './track-types';

/** Distance between centreline samples. Every sample sits exactly at s = index * STEP. */
export const STEP = 6;
/** Width changes blend over this distance so the barriers never jump sideways. */
const WIDTH_BLEND = 80;

/** Reads a sample, treating a missing one as 0 (the arrays are always filled, this only satisfies the checker). */
export const at = (values: readonly number[], index: number): number => values[index] ?? 0;

export interface Pose {
  x: number;
  y: number;
  /** Travel direction in radians; screen coordinates (y down), so +angle turns right. */
  angle: number;
  halfWidth: number;
}

export interface Projection {
  index: number;
  s: number;
  /** Signed distance from the centreline: positive is right of the travel direction. */
  lateral: number;
  angle: number;
  halfWidth: number;
}

interface Placed {
  segment: Segment;
  startS: number;
  length: number;
  x: number;
  y: number;
  angle: number;
  fromHalf: number;
}

interface End {
  x: number;
  y: number;
  angle: number;
  s: number;
  half: number;
}

export interface StartPose {
  x: number;
  y: number;
  angle: number;
  half: number;
}

/**
 * A road centreline built from straights and circular arcs, sampled every STEP units with exact closed-form arcs.
 * It can grow (endless mode appends segments ahead of the car); lookups by distance are O(1).
 */
export class Track {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly angles: number[] = [];
  readonly halfWidths: number[] = [];
  /** Signed curvature (1/radius) at each sample, 0 on straights. */
  readonly curvatures: number[] = [];
  /** Which way "hold" steers at each sample: the current corner, else the next one, else the previous one. */
  readonly assist: number[] = [];
  readonly corners: Corner[] = [];
  private readonly placed: Placed[] = [];
  private end: End = { x: 0, y: 0, angle: -Math.PI / 2, s: 0, half: 0 };

  constructor(segments: readonly Segment[] = [], start?: StartPose) {
    if (start) this.end = { x: start.x, y: start.y, angle: start.angle, s: 0, half: start.half };
    if (segments.length > 0) this.append(segments);
  }

  /** Where the road currently ends: the point and heading a new segment would start from. */
  get endPose(): StartPose {
    return { x: this.end.x, y: this.end.y, angle: this.end.angle, half: this.end.half };
  }

  /** The centreline points a candidate extension would add, without changing this track. */
  preview(segments: readonly Segment[]): Track {
    return new Track(segments, this.endPose);
  }

  get length(): number {
    return this.end.s;
  }

  get segmentCount(): number {
    return this.placed.length;
  }

  segmentStart(index: number): number {
    return this.placed[index]?.startS ?? 0;
  }

  segmentLengthAt(index: number): number {
    return this.placed[index]?.length ?? 0;
  }

  append(segments: readonly Segment[]): void {
    const firstNew = this.xs.length;
    for (const segment of segments) this.place(segment);
    this.sampleFrom(Math.max(0, firstNew - 1));
    this.recomputeAssist(Math.max(0, firstNew - 400));
  }

  private place(segment: Segment): void {
    const length = segmentLength(segment);
    const half = segment.width / 2;
    const fromHalf = this.placed.length === 0 ? half : this.end.half;
    const { x, y, angle, s: startS } = this.end;
    const placed: Placed = { segment, length, fromHalf, startS, x, y, angle };
    this.placed.push(placed);
    const pose = poseInSegment(placed, length);
    if (segment.kind === 'arc') {
      const dir = segment.degrees > 0 ? 1 : -1;
      const startS = this.end.s;
      this.corners.push({ startS, endS: startS + length, dir, radius: segment.radius, degrees: segment.degrees });
    }
    this.end = { x: pose.x, y: pose.y, angle: pose.angle, s: this.end.s + length, half };
  }

  private sampleFrom(fromIndex: number): void {
    let segmentIndex = 0;
    for (let i = fromIndex; i * STEP <= this.end.s + 1e-9; i++) {
      const s = i * STEP;
      while (segmentIndex < this.placed.length - 1 && this.startOf(segmentIndex + 1) <= s) segmentIndex++;
      const p = this.placed[segmentIndex] as Placed;
      const pose = poseInSegment(p, Math.min(p.length, s - p.startS));
      this.xs[i] = pose.x;
      this.ys[i] = pose.y;
      this.angles[i] = pose.angle;
      this.halfWidths[i] = pose.halfWidth;
      this.curvatures[i] = p.segment.kind === 'arc' ? Math.sign(p.segment.degrees) / p.segment.radius : 0;
    }
  }

  private startOf(index: number): number {
    return (this.placed[index] as Placed).startS;
  }

  private recomputeAssist(fromIndex: number): void {
    let next = 0;
    const nextDir: number[] = [];
    for (let i = this.xs.length - 1; i >= fromIndex; i--) {
      const c = at(this.curvatures, i);
      if (c !== 0) next = Math.sign(c);
      nextDir[i] = next;
    }
    let previous = fromIndex > 0 ? at(this.assist, fromIndex - 1) || 1 : 1;
    for (let i = fromIndex; i < this.xs.length; i++) {
      const own = Math.sign(at(this.curvatures, i));
      previous = own || at(nextDir, i) || previous;
      this.assist[i] = previous;
    }
  }

  indexAt(s: number): number {
    return Math.max(0, Math.min(this.xs.length - 1, Math.round(s / STEP)));
  }

  assistAt(s: number): number {
    return at(this.assist, this.indexAt(s)) || 1;
  }

  /** Interpolated centreline pose at distance s (clamped to the track). */
  poseAt(s: number): Pose {
    const clamped = Math.max(0, Math.min(this.end.s, s));
    const i = Math.min(this.xs.length - 2, Math.floor(clamped / STEP));
    if (i < 0) return { x: this.end.x, y: this.end.y, angle: this.end.angle, halfWidth: this.end.half };
    const t = clamped / STEP - i;
    const mix = (values: readonly number[]): number => at(values, i) + (at(values, i + 1) - at(values, i)) * t;
    return { x: mix(this.xs), y: mix(this.ys), angle: mix(this.angles), halfWidth: mix(this.halfWidths) };
  }

  /** World position at distance s and signed lateral offset (positive = right). */
  pointAt(s: number, lateral: number): { x: number; y: number; angle: number } {
    const pose = this.poseAt(s);
    const x = pose.x - Math.sin(pose.angle) * lateral;
    const y = pose.y + Math.cos(pose.angle) * lateral;
    return { x, y, angle: pose.angle };
  }

  private distSq(i: number, x: number, y: number): number {
    const dx = at(this.xs, i) - x;
    const dy = at(this.ys, i) - y;
    return dx * dx + dy * dy;
  }

  /** Walks from `hint` to the nearest centreline sample (the car only ever moves a few samples between steps). */
  private nearest(x: number, y: number, hint: number): number {
    const last = this.xs.length - 1;
    let i = Math.max(0, Math.min(last, hint));
    let best = this.distSq(i, x, y);
    for (let guard = 0; guard < 200; guard++) {
      const forward = i < last ? this.distSq(i + 1, x, y) : Infinity;
      const back = i > 0 ? this.distSq(i - 1, x, y) : Infinity;
      if (forward >= best && back >= best) break;
      i += forward < back ? 1 : -1;
      best = Math.min(forward, back);
    }
    return i;
  }

  /** Projects a point onto the centreline, searching locally from `hint` (the previous index for this object). */
  project(x: number, y: number, hint: number): Projection {
    const i = this.nearest(x, y, hint);
    const angle = at(this.angles, i);
    const dx = x - at(this.xs, i);
    const dy = y - at(this.ys, i);
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const lateral = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return { index: i, s: i * STEP + along, lateral, angle, halfWidth: at(this.halfWidths, i) };
  }
}

/** The centreline pose `u` units into a placed segment (closed form for both straights and arcs). */
function poseInSegment(p: Placed, u: number): Pose {
  const t = Math.min(1, u / WIDTH_BLEND);
  const halfWidth = p.fromHalf + (p.segment.width / 2 - p.fromHalf) * t;
  if (p.segment.kind === 'straight') {
    return { x: p.x + Math.cos(p.angle) * u, y: p.y + Math.sin(p.angle) * u, angle: p.angle, halfWidth };
  }
  const sigma = p.segment.degrees > 0 ? 1 : -1;
  const r = p.segment.radius;
  // The arc's centre sits on the inside of the turn; the position is the centre minus the inside normal.
  const cx = p.x - Math.sin(p.angle) * r * sigma;
  const cy = p.y + Math.cos(p.angle) * r * sigma;
  const angle = p.angle + (sigma * u) / r;
  return { x: cx + Math.sin(angle) * r * sigma, y: cy - Math.cos(angle) * r * sigma, angle, halfWidth };
}
