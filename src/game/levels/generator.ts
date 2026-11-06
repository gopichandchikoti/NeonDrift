import { Rng } from '../physics/rng';
import { Track } from '../physics/track';
import { expandSparks } from '../physics/track-dsl';
import type { ItemPlacement, Segment } from '../physics/track-types';
import type { TrackExtender } from '../systems/world-types';
import { placeOne, stillFair, type Placed } from './fairness';
import { buildHazards, type ItemSpec } from './generator-items';
import { crossesOlder } from './generator-geometry';

export interface GeneratorConfig {
  seed: number;
  /** Fixed difficulty 0..1 (daily challenge), or null to ramp up with distance (endless). */
  difficulty: number | null;
  /** The car's cruising speed, used to place traffic fairly. */
  speed: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Distance over which endless difficulty climbs from 0 to 1. */
const RAMP = 24000;
const MAX_HEADING = 95;
const RETRIES = 6;
/** First distance at which a hazard may appear. Endless opens gently; a daily course (fixed difficulty) is tougher. */
const FIRST_HAZARD = { endless: 1500, daily: 900 };

interface Piece {
  segments: Segment[];
  items: ItemSpec[];
}

/**
 * Builds roads from authored-style pieces (bends, S-bends, switchback chains, chicanes, paired hairpins) with
 * hazards placed by the same fairness rules the 60 stages are validated against. Seeded: the same seed always
 * produces the same road, so a run can be replayed and tested.
 */
export class TrackGenerator implements TrackExtender {
  private readonly rng: Rng;
  private readonly accepted: Placed[] = [];
  private width = 250;

  constructor(private readonly config: GeneratorConfig) {
    this.rng = new Rng(config.seed);
  }

  private get firstHazard(): number {
    return this.config.difficulty === null ? FIRST_HAZARD.endless : FIRST_HAZARD.daily;
  }

  difficultyAt(s: number): number {
    return this.config.difficulty ?? Math.min(1, s / RAMP);
  }

  /** Called by the world when the road ahead runs short: appends more road and returns its objects. */
  extend(track: Track): ItemPlacement[] {
    return this.fill(track, track.length + 2600);
  }

  /** Appends pieces until the track is at least `target` long; returns the objects placed on them. */
  fill(track: Track, target: number, keepClearAfter = Infinity): ItemPlacement[] {
    const items: ItemPlacement[] = [];
    if (track.segmentCount === 0) items.push(...this.commit(track, this.opening()));
    while (track.length < target) {
      const piece = this.choosePiece(track);
      const clear = track.length + 900 > keepClearAfter;
      items.push(...this.commit(track, clear ? { ...piece, items: [] } : piece));
    }
    return items;
  }

  private opening(): Piece {
    this.width = 250;
    return { segments: [{ kind: 'straight', length: 800, width: this.width }], items: [] };
  }

  private heading(track: Track): number {
    const turned = ((track.endPose.angle + Math.PI / 2) * 180) / Math.PI;
    return ((turned + 540) % 360) - 180;
  }

  private choosePiece(track: Track): Piece {
    const d = this.difficultyAt(track.length);
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const piece = this.compose(d, this.heading(track));
      if (!crossesOlder(track, piece.segments)) return piece;
    }
    return { segments: [{ kind: 'straight', length: 500, width: this.width }], items: [] };
  }

  private nextWidth(d: number): number {
    const target = lerp(255, 192, d) + this.rng.range(-8, 8);
    this.width = Math.round(Math.min(260, Math.max(190, lerp(this.width, target, 0.6))) / 2) * 2;
    return this.width;
  }

  private radius(d: number): number {
    const min = lerp(300, 170, d);
    return Math.round(this.rng.range(min, min + 170));
  }

  /** Net turning (degrees, signed) of a candidate piece, so the road keeps heading forward. */
  private pick(d: number, heading: number): { dir: 1 | -1; kind: string } {
    const kinds = [{ kind: 'bend', w: 3 }, { kind: 's', w: d > 0.05 ? 2 : 0 }, { kind: 'chain', w: d > 0.25 ? 1.5 : 0 },
      { kind: 'chicane', w: d > 0.2 ? 1 : 0 }, { kind: 'hairpin', w: d > 0.45 ? 0.9 : 0 }];
    const total = kinds.reduce((sum, k) => sum + k.w, 0);
    let roll = this.rng.next() * total;
    let kind = 'bend';
    for (const k of kinds) {
      roll -= k.w;
      if (roll <= 0) {
        kind = k.kind;
        break;
      }
    }
    return { dir: this.preferredDirection(heading), kind };
  }

  /** Turn back toward the original heading once the road has swung far to one side. */
  private preferredDirection(heading: number): 1 | -1 {
    if (heading > MAX_HEADING * 0.5) return -1;
    if (heading < -MAX_HEADING * 0.5) return 1;
    return this.rng.chance(0.5) ? 1 : -1;
  }

  private compose(d: number, heading: number): Piece {
    const width = this.nextWidth(d);
    const { dir, kind } = this.pick(d, heading);
    const r = this.radius(d);
    const arc = (degrees: number, radius = r): Segment => ({ kind: 'arc', degrees, radius, width });
    const straight = (length: number): Segment => ({ kind: 'straight', length, width });
    const lead = Math.round(lerp(560, 340, d) + this.rng.range(-60, 60));
    const turn = Math.round(this.rng.range(45, lerp(75, 115, d)));
    const segments: Segment[] = [straight(lead)];
    switch (kind) {
      case 's':
        segments.push(arc(dir * turn), straight(150), arc(-dir * turn));
        break;
      case 'chain':
        for (let i = 0; i < (d > 0.6 ? 4 : 3); i++) {
          segments.push(arc((i % 2 === 0 ? dir : -dir) * 85, Math.max(r, 210)));
        }
        break;
      case 'chicane':
        segments.push(arc(dir * 45, Math.max(r, 220)), arc(-dir * 45, Math.max(r, 220)), straight(220));
        break;
      case 'hairpin':
        segments.push(arc(dir * 165, Math.max(r, 180)), straight(260), arc(-dir * 165, Math.max(r, 180)));
        break;
      default:
        segments.push(arc(dir * turn));
    }
    return { segments, items: buildHazards(this.rng, d, segments) };
  }

  /** Appends the piece and returns its objects, keeping only the hazards that leave the road fair. */
  private commit(track: Track, piece: Piece): ItemPlacement[] {
    const first = track.segmentCount;
    track.append(piece.segments);
    const out: ItemPlacement[] = [];
    for (const spec of piece.items) {
      const item: ItemPlacement = { ...spec.item, segment: first + spec.segment };
      const placed = placeOne(track, item, this.config.speed);
      if (placed && (!stillFair(this.accepted, placed, track) || placed.s < this.firstHazard)) continue;
      if (placed) this.accepted.push(placed);
      out.push(item);
    }
    const sparks = this.sparkTrail(track, first, piece.segments);
    this.accepted.splice(0, Math.max(0, this.accepted.length - 40));
    return [...out, ...sparks];
  }

  private sparkTrail(track: Track, first: number, segments: readonly Segment[]): ItemPlacement[] {
    const d = this.difficultyAt(track.length);
    const out: ItemPlacement[] = [];
    segments.forEach((seg, i) => {
      if (seg.kind !== 'straight' || seg.length < 380 || !this.rng.chance(0.5 - d * 0.25)) return;
      const side = this.rng.chance(0.5) ? 1 : -1;
      const lat = side * 0.5;
      out.push(...expandSparks({ segment: first + i, length: seg.length, from: 0.15, to: 0.85, lat, lat2: -lat }));
      if (!this.rng.chance(0.14)) return;
      out.push({ kind: this.rng.chance(0.6) ? 'shield' : 'magnet', segment: first + i, at: 0.1, lat: 0 });
    });
    return out;
  }
}
