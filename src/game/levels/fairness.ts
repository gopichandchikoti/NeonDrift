import { gateSweep, SHAPES } from '../entities/entities';
import { CAR } from '../physics/constants';
import type { Track } from '../physics/track';
import type { ItemPlacement } from '../physics/track-types';

/** The rules that keep hazards fair. The stage validator and the endless generator both enforce exactly these. */
export const FAIR = {
  /** Hazards this close along the road form a cluster, and a cluster must always leave a gap. */
  clusterReach: 70,
  /** The widest gap a cluster must leave (the car is 18 wide, so this is roughly three car widths). */
  minGap: 52,
  /** A swinging gate needs at least this much sweep to be worth placing, and no other hazard this close. */
  gateMinSweep: 12,
  gateClearance: 90,
  /** Traffic wakes this far ahead of the car (see world-rules). */
  trafficWake: 560,
  startS: 60,
};

export interface Placed {
  item: ItemPlacement;
  /** Where the car will actually meet it (traffic keeps moving, so this differs from where it was placed). */
  s: number;
  lat: number;
  side: number;
}

/** Where the car actually meets a traffic car: it keeps moving away from where it was placed. */
export function meetingPoint(s: number, trafficSpeed: number, carSpeed: number): number {
  const gap = Math.min(FAIR.trafficWake, s - FAIR.startS);
  return s + (trafficSpeed * gap) / Math.max(1, carSpeed - trafficSpeed);
}

export function placeOne(track: Track, item: ItemPlacement, carSpeed: number): Placed | null {
  if (item.kind === 'spark' || item.kind === 'shield' || item.kind === 'magnet') return null;
  const start = track.segmentStart(item.segment) + item.at * track.segmentLengthAt(item.segment);
  const s = item.kind === 'traffic' ? meetingPoint(start, item.speed ?? 0, carSpeed) : start;
  const half = track.poseAt(Math.min(s, track.length)).halfWidth;
  const side = item.kind === 'traffic' ? CAR.halfWidth : SHAPES[item.kind].side;
  return { item, s, lat: item.lat * Math.max(0, half - side - 4), side };
}

export function placeAll(track: Track, items: readonly ItemPlacement[], carSpeed: number): Placed[] {
  const out: Placed[] = [];
  for (const item of items) {
    const placed = placeOne(track, item, carSpeed);
    if (placed) out.push(placed);
  }
  return out.sort((x, y) => x.s - y.s);
}

/** The widest free gap across the road once every non-gate hazard in `cluster` is in place. */
export function largestGap(cluster: readonly Placed[], half: number): number {
  const spans = cluster
    .filter((p) => p.item.kind !== 'gate')
    .map((p) => [p.lat - p.side, p.lat + p.side] as const)
    .sort((x, y) => x[0] - y[0]);
  let cursor = -half + 3;
  let best = 0;
  for (const [from, to] of spans) {
    best = Math.max(best, from - cursor);
    cursor = Math.max(cursor, to);
  }
  return Math.max(best, half - 3 - cursor);
}

/** Why `p` is unfair given the other hazards in `all`, or null when it is fine. */
export function hazardProblem(all: readonly Placed[], p: Placed, track: Track): string | null {
  const half = track.poseAt(Math.min(p.s, track.length)).halfWidth;
  const at = Math.round(p.s);
  if (p.item.kind === 'gate') {
    if (gateSweep(half) < FAIR.gateMinSweep) return `gate at ${at}: road too narrow to swing`;
    const close = all.some((q) => q !== p && Math.abs(q.s - p.s) < FAIR.gateClearance);
    return close ? `gate at ${at} has another hazard within ${FAIR.gateClearance}` : null;
  }
  const cluster = all.filter((q) => Math.abs(q.s - p.s) < FAIR.clusterReach);
  const gap = largestGap(cluster, half);
  return gap >= FAIR.minGap ? null : `hazards near ${at} leave a gap of only ${Math.round(gap)}`;
}

/** True when adding `candidate` to `accepted` keeps the candidate and every hazard near it fair. */
export function stillFair(accepted: readonly Placed[], candidate: Placed, track: Track): boolean {
  const reach = Math.max(FAIR.clusterReach, FAIR.gateClearance);
  const near = accepted.filter((q) => Math.abs(q.s - candidate.s) < reach + 1);
  const all = [...near, candidate];
  return all.every((p) => hazardProblem(all, p, track) === null);
}
