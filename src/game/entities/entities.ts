import { CAR, SIM_HZ } from '../physics/constants';
import { clamp } from '../physics/math';
import type { Track } from '../physics/track';
import type { HazardKind, ItemPlacement, PickupKind } from '../physics/track-types';

/** Collision footprint of a hazard: a circle, or a box aligned with the road (half sizes along and across). */
export const SHAPES: Record<HazardKind, { along: number; side: number; circle: boolean }> = {
  cone: { along: 10, side: 10, circle: true },
  block: { along: 12, side: 26, circle: false },
  gate: { along: 7, side: 26, circle: false },
  traffic: { along: CAR.halfLength, side: CAR.halfWidth, circle: false },
};

/** Every side lane beside a swinging gate stays at least this wide at all times, so a gate is always avoidable. */
export const GATE_FREE_LANE = 44;
const BARRIER_PAD = 3;

/** The largest sideways swing (units either way) a gate may have on a road of this half width. */
export function gateSweep(halfWidth: number): number {
  return Math.max(0, halfWidth - BARRIER_PAD - SHAPES.gate.side - GATE_FREE_LANE);
}

export interface Hazard {
  id: number;
  kind: HazardKind;
  /** Distance along the road; for traffic this moves. */
  s: number;
  /** Lateral offset in units (positive = right); for gates and traffic this moves. */
  lat: number;
  x: number;
  y: number;
  angle: number;
  baseLat: number;
  /** gate: swing in units, period in ticks, phase 0..1. traffic: speed (units/s), target lane in units. */
  amp: number;
  period: number;
  phase: number;
  speed: number;
  targetLat: number;
  /** Traffic: lane change progress 0..1 (it signals, then moves), and whether it was triggered. */
  laneT: number;
  /** Smallest gap seen while the car was alongside; Infinity until then. */
  minGap: number;
  /** Already scored as a near miss / overtake, or hit. */
  resolved: boolean;
  hit: boolean;
  index: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  s: number;
  x: number;
  y: number;
  taken: boolean;
}

const MARGIN: Record<ItemPlacement['kind'], number> = {
  cone: SHAPES.cone.side + 4,
  block: SHAPES.block.side + 4,
  gate: SHAPES.gate.side,
  traffic: CAR.halfWidth + 8,
  spark: 14,
  shield: 18,
  magnet: 18,
};

export function itemDistance(track: Track, item: ItemPlacement): number {
  return track.segmentStart(item.segment) + clamp(item.at, 0, 1) * track.segmentLengthAt(item.segment);
}

/** Lateral offset in units for a fraction of the usable half width at distance s. */
export function lateralUnits(track: Track, kind: ItemPlacement['kind'], s: number, fraction: number): number {
  const usable = Math.max(0, track.poseAt(s).halfWidth - MARGIN[kind]);
  return clamp(fraction, -1, 1) * usable;
}

export function placeHazard(track: Track, item: ItemPlacement, id: number): Hazard {
  const kind = item.kind as HazardKind;
  const s = itemDistance(track, item);
  const lat = lateralUnits(track, kind, s, item.lat);
  const point = track.pointAt(s, lat);
  const half = track.poseAt(s).halfWidth;
  return {
    id,
    kind,
    s,
    lat,
    x: point.x,
    y: point.y,
    angle: point.angle,
    baseLat: lat,
    amp: kind === 'gate' ? clamp(item.amp ?? 0.5, 0, 1) * gateSweep(half) : 0,
    period: Math.max(1, (item.period ?? 2) * SIM_HZ),
    phase: item.phase ?? 0,
    speed: item.speed ?? 0,
    targetLat: kind === 'traffic' ? lateralUnits(track, kind, s, item.amp ?? item.lat) : lat,
    laneT: 0,
    minGap: Infinity,
    resolved: false,
    hit: false,
    index: track.indexAt(s),
  };
}

export function placePickup(track: Track, item: ItemPlacement, id: number): Pickup {
  const s = itemDistance(track, item);
  const point = track.pointAt(s, lateralUnits(track, item.kind, s, item.lat));
  return { id, kind: item.kind as PickupKind, s, x: point.x, y: point.y, taken: false };
}

export function isHazardKind(kind: ItemPlacement['kind']): kind is HazardKind {
  return kind === 'cone' || kind === 'block' || kind === 'gate' || kind === 'traffic';
}

/** Gap between a circle and a hazard's footprint (negative when overlapping). */
export function circleGap(hazard: Hazard, x: number, y: number, radius: number): number {
  const shape = SHAPES[hazard.kind];
  const dx = x - hazard.x;
  const dy = y - hazard.y;
  if (shape.circle) return Math.hypot(dx, dy) - shape.side - radius;
  const c = Math.cos(hazard.angle);
  const s = Math.sin(hazard.angle);
  const along = dx * c + dy * s;
  const side = -dx * s + dy * c;
  const qa = Math.abs(along) - shape.along;
  const qs = Math.abs(side) - shape.side;
  const outside = Math.hypot(Math.max(qa, 0), Math.max(qs, 0));
  return outside + Math.min(Math.max(qa, qs), 0) - radius;
}
