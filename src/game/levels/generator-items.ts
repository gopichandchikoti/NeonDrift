import type { Rng } from '../physics/rng';
import type { ItemPlacement, Segment } from '../physics/track-types';

/** A candidate object on a piece, with `segment` local to the piece. */
export interface ItemSpec {
  segment: number;
  item: Omit<ItemPlacement, 'segment'>;
}

type Kind = 'cones' | 'block' | 'gate' | 'traffic';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function available(d: number): Kind[] {
  const kinds: Kind[] = ['cones'];
  if (d >= 0.12) kinds.push('block');
  if (d >= 0.22) kinds.push('traffic', 'traffic');
  if (d >= 0.4) kinds.push('gate');
  return kinds;
}

function group(rng: Rng, kind: Kind, d: number, segment: number): ItemSpec[] {
  const spec = (item: Omit<ItemPlacement, 'segment'>): ItemSpec => ({ segment, item });
  switch (kind) {
    case 'cones': {
      const n = 1 + Math.round(d * 2 * rng.next());
      return Array.from({ length: n }, (_, i) =>
        spec({ kind: 'cone', at: (i + 1) / (n + 1), lat: (i % 2 === 0 ? 1 : -1) * rng.range(0.3, 0.6) * (rng.chance(0.5) ? 1 : -1) }),
      );
    }
    case 'block':
      return [spec({ kind: 'block', at: 0.5, lat: (rng.chance(0.5) ? 1 : -1) * rng.range(0.35, 0.6) })];
    case 'gate':
      return [spec({ kind: 'gate', at: 0.5, lat: 0, amp: rng.range(0.6, 1), period: rng.range(1.9, 2.6), phase: rng.next() })];
    case 'traffic': {
      const side = rng.chance(0.5) ? 1 : -1;
      const change = rng.chance(0.25 + d * 0.45);
      const cars: ItemSpec[] = [spec({
        kind: 'traffic', at: 0.3, lat: side * 0.45, speed: Math.round(rng.range(130, 165)), amp: change ? -side * 0.45 : side * 0.45,
      })];
      if (d > 0.5 && rng.chance(0.5)) cars.push(spec({ kind: 'traffic', at: 0.75, lat: -side * 0.45, speed: 150, amp: -side * 0.45 }));
      return cars;
    }
  }
}

/** Candidate hazards for a piece: at most one group per long straight, plus the odd cone on a bend's inside line. */
export function buildHazards(rng: Rng, d: number, segments: readonly Segment[]): ItemSpec[] {
  const out: ItemSpec[] = [];
  const chance = lerp(0.4, 0.85, d);
  segments.forEach((seg, i) => {
    if (seg.kind === 'straight' && seg.length >= 380 && rng.chance(chance)) {
      out.push(...group(rng, rng.pick(available(d)), d, i));
    } else if (seg.kind === 'arc' && d > 0.45 && rng.chance(0.25 * d)) {
      out.push({ segment: i, item: { kind: 'cone', at: 0.5, lat: Math.sign(seg.degrees) * 0.6 } });
    }
  });
  return out;
}
