import { Track } from '../physics/track';
import { parseTrack, TrackSyntaxError } from '../physics/track-dsl';
import type { Segment, TrackSpec } from '../physics/track-types';
import { FAIR, hazardProblem, placeAll } from './fairness';
import { districtById } from './districts';
import { normaliseTrack } from './fingerprint';
import type { StageDef } from './types';

export interface Issue {
  stage: string;
  message: string;
}

export const LIMITS = {
  minWidth: 170,
  maxWidth: 270,
  /** Corners must be wider than this: the car can always get round a bend this open (see HANDLING.turnRadius). */
  minRadius: 150,
  minSpeed: 250,
  maxSpeed: 400,
  minLength: 3000,
  maxLength: 16000,
  /** Nothing is placed in the first stretch of road, so the player can settle in. */
  clearStart: 300,
};

function check(stage: string, ok: boolean, message: string, out: Issue[]): void {
  if (!ok) out.push({ stage, message });
}

function segmentIssues(id: string, segments: readonly Segment[], out: Issue[]): void {
  for (const [i, seg] of segments.entries()) {
    const where = `segment ${i + 1}`;
    check(id, seg.width >= LIMITS.minWidth && seg.width <= LIMITS.maxWidth, `${where}: width ${seg.width}`, out);
    if (seg.kind === 'straight') {
      check(id, seg.length >= 60, `${where}: straight shorter than 60`, out);
      continue;
    }
    check(id, seg.radius >= LIMITS.minRadius, `${where}: radius ${seg.radius} under ${LIMITS.minRadius}`, out);
    check(id, seg.radius > seg.width / 2 + 60, `${where}: radius ${seg.radius} folds the inside edge`, out);
    check(id, Math.abs(seg.degrees) >= 10 && Math.abs(seg.degrees) <= 180, `${where}: ${seg.degrees} degrees`, out);
  }
}

/** True when two non-adjacent stretches of road overlap, which would make the course cross itself. */
function crossesItself(track: Track): { a: number; b: number } | null {
  const gap = Math.ceil(700 / 6);
  for (let i = 0; i < track.xs.length; i += 2) {
    for (let j = i + gap; j < track.xs.length; j += 2) {
      const d = Math.hypot((track.xs[i] ?? 0) - (track.xs[j] ?? 0), (track.ys[i] ?? 0) - (track.ys[j] ?? 0));
      if (d < (track.halfWidths[i] ?? 0) + (track.halfWidths[j] ?? 0) + 12) return { a: i * 6, b: j * 6 };
    }
  }
  return null;
}

interface PlacementCheck {
  id: string;
  track: Track;
  spec: TrackSpec;
  carSpeed: number;
}

function placementIssues({ id, track, spec, carSpeed }: PlacementCheck, out: Issue[]): void {
  const placed = placeAll(track, spec.items, carSpeed);
  for (const item of spec.items) {
    check(id, item.at >= 0 && item.at <= 1, `object ${item.kind}: position ${item.at} outside the segment`, out);
    check(id, Math.abs(item.lat) <= 1, `object ${item.kind}: lateral ${item.lat} outside the road`, out);
  }
  for (const p of placed) {
    check(id, p.s >= FAIR.startS + LIMITS.clearStart, `${p.item.kind} at ${Math.round(p.s)} is too near the start`, out);
    check(id, p.s <= track.length - 200, `${p.item.kind} at ${Math.round(p.s)} is too near the finish`, out);
    const problem = hazardProblem(placed, p, track);
    if (problem) out.push({ stage: id, message: problem });
  }
}

/** Static checks on one stage: syntax, ranges, geometry, object placement and fairness of clusters. */
export function validateStage(def: StageDef): Issue[] {
  const out: Issue[] = [];
  const id = def.id;
  check(id, /^[1-6]-\d\d$/.test(id), `bad id "${id}"`, out);
  check(id, id === `${def.district}-${String(def.index).padStart(2, '0')}`, 'id does not match district/index', out);
  check(id, def.speed >= LIMITS.minSpeed && def.speed <= LIMITS.maxSpeed, `speed ${def.speed}`, out);
  check(id, def.objective.ask > 0 && def.objective.ask <= 1, `objective ask ${def.objective.ask}`, out);
  check(id, def.name.trim().length > 0 && def.note.trim().length > 0, 'missing name or note', out);
  check(id, districtById(def.district) !== undefined, 'unknown district', out);
  let spec: TrackSpec;
  try {
    spec = parseTrack(def.track);
  } catch (error) {
    if (!(error instanceof TrackSyntaxError)) throw error;
    out.push({ stage: id, message: `track syntax: ${error.message}` });
    return out;
  }
  segmentIssues(id, spec.segments, out);
  const track = new Track(spec.segments);
  check(id, track.length >= LIMITS.minLength && track.length <= LIMITS.maxLength, `length ${Math.round(track.length)}`, out);
  const cross = crossesItself(track);
  check(id, cross === null, `the road crosses itself near ${cross?.a} and ${cross?.b}`, out);
  placementIssues({ id, track, spec, carSpeed: def.speed }, out);
  return out;
}

/** The corner pattern alone (ignoring objects), used to prove no two stages share a road. */
export function shapeSignature(def: StageDef): string {
  return parseTrack(def.track)
    .segments.map((s) => (s.kind === 'straight' ? `S${s.length}` : `${s.degrees}@${s.radius}`))
    .join(',');
}

/** Checks across the whole set: unique ids, names, tracks and road shapes, and ten stages per district. */
export function validateSet(defs: readonly StageDef[]): Issue[] {
  const out: Issue[] = [];
  const seen = {
    id: new Map<string, string>(),
    name: new Map<string, string>(),
    track: new Map<string, string>(),
    shape: new Map<string, string>(),
  };
  const note = (map: Map<string, string>, key: string, stage: string, what: string): void => {
    const first = map.get(key);
    if (first) out.push({ stage, message: `${what} duplicates ${first}` });
    else map.set(key, stage);
  };
  for (const def of defs) {
    note(seen.id, def.id, def.id, 'id');
    note(seen.name, def.name.toLowerCase(), def.id, 'name');
    note(seen.track, normaliseTrack(def.track), def.id, 'track');
    note(seen.shape, shapeSignature(def), def.id, 'road shape');
  }
  for (let district = 1; district <= 6; district++) {
    const count = defs.filter((d) => d.district === district).length;
    check(`district ${district}`, count === 10, `has ${count} stages, expected 10`, out);
  }
  check('set', defs.length === 60, `has ${defs.length} stages, expected 60`, out);
  return out;
}
