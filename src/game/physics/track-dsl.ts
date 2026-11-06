import type { ItemPlacement, Segment, TrackSpec } from './track-types';

/**
 * The compact text format the 60 stages are written in. Tokens are separated by spaces:
 *
 *   W180            road width (units) for the following segments
 *   S400            straight, 400 units long
 *   L90@200 R45@160 arc turning left/right by the given degrees with the given radius
 *
 * A segment may carry objects in brackets, positioned by fraction of the segment (`f`) and lateral fraction of the
 * half width (`lat`, -1 = left barrier, +1 = right barrier):
 *
 *   c f:lat   cone          b f:lat     barrier block    h f:lat   shield     m f:lat   magnet
 *   g f:amp:period[:phase]  sliding gate across the road
 *   t f:lat:speed[:lat2]    traffic car (optionally drifting toward lane lat2)
 *   s f-f2:lat[:lat2]       a trail of energy sparks from f to f2, lateral lat (to lat2)
 *
 * Example: `W200 S500[s.2-.8:0] R90@220[c.5:.4] S300`.
 */

const SEGMENT = /^([SLR])(\d+(?:\.\d+)?)(?:@(\d+(?:\.\d+)?))?$/;
const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const SPARK_SPACING = 46;

export class TrackSyntaxError extends Error {}

function num(text: string | undefined, token: string): number {
  if (text === undefined || !NUMBER.test(text)) throw new TrackSyntaxError(`bad number "${text}" in "${token}"`);
  return Number(text);
}

function optional(text: string | undefined, token: string): number | undefined {
  return text === undefined ? undefined : num(text, token);
}

function parseSegment(text: string, width: number): Segment {
  const match = SEGMENT.exec(text);
  if (!match) throw new TrackSyntaxError(`unknown segment "${text}"`);
  const [, letter, amount, radius] = match;
  if (letter === 'S') {
    if (radius !== undefined) throw new TrackSyntaxError(`a straight has no radius: "${text}"`);
    return { kind: 'straight', length: Number(amount), width };
  }
  if (radius === undefined) throw new TrackSyntaxError(`a corner needs a radius: "${text}"`);
  const sign = letter === 'L' ? -1 : 1;
  return { kind: 'arc', degrees: sign * Number(amount), radius: Number(radius), width };
}

const SIMPLE: Record<string, ItemPlacement['kind']> = { c: 'cone', b: 'block', h: 'shield', m: 'magnet' };

export interface SparkTrail {
  segment: number;
  /** Length of the segment in units, to space the sparks evenly. */
  length: number;
  /** Fractions of the segment where the trail starts and ends. */
  from: number;
  to: number;
  /** Lateral fraction at the start, and at the end (defaults to the same, a straight line). */
  lat: number;
  lat2?: number;
}

/** Evenly spaced sparks along a segment, sweeping from `lat` to `lat2` across the road. */
export function expandSparks(trail: SparkTrail): ItemPlacement[] {
  const { segment, length, from, to, lat } = trail;
  const lat2 = trail.lat2 ?? lat;
  const count = Math.max(1, Math.round(((to - from) * length) / SPARK_SPACING) + 1);
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    return { kind: 'spark' as const, segment, at: from + (to - from) * t, lat: lat + (lat2 - lat) * t };
  });
}

function sparkTrail(body: string, segment: number, token: string, length: number): ItemPlacement[] {
  const [range, latText, lat2Text] = body.split(':');
  const [fromText, toText] = (range ?? '').split('-');
  const lat = num(latText, token);
  const lat2 = optional(lat2Text, token) ?? lat;
  return expandSparks({ segment, length, from: num(fromText, token), to: num(toText, token), lat, lat2 });
}

function parseItem(token: string, segment: number, segmentLength: number): ItemPlacement[] {
  const code = token[0] ?? '';
  const body = token.slice(1);
  if (code === 's') return sparkTrail(body, segment, token, segmentLength);
  const parts = body.split(':');
  const at = num(parts[0], token);
  const simple = SIMPLE[code];
  if (simple) return [{ kind: simple, segment, at, lat: num(parts[1], token) }];
  if (code === 'g') {
    const phase = optional(parts[3], token) ?? 0;
    return [{ kind: 'gate', segment, at, lat: 0, amp: num(parts[1], token), period: num(parts[2], token), phase }];
  }
  if (code === 't') {
    const lat = num(parts[1], token);
    const amp = optional(parts[3], token) ?? lat;
    return [{ kind: 'traffic', segment, at, lat, speed: num(parts[2], token), amp }];
  }
  throw new TrackSyntaxError(`unknown object "${token}"`);
}

export function segmentLength(segment: Segment): number {
  return segment.kind === 'straight' ? segment.length : (Math.abs(segment.degrees) * Math.PI * segment.radius) / 180;
}

const BRACKET_DEPTH: Record<string, number> = { '[': 1, ']': -1 };

/** Splits on spaces that are not inside brackets. */
function tokens(source: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of source.trim()) {
    depth += BRACKET_DEPTH[char] ?? 0;
    if (depth < 0) throw new TrackSyntaxError('unbalanced "]"');
    const split = depth === 0 && /\s/.test(char);
    if (!split) current += char;
    else if (current) out.push(current);
    if (split) current = '';
  }
  if (depth !== 0) throw new TrackSyntaxError('unbalanced "["');
  if (current) out.push(current);
  return out;
}

/** One bracketed object list, like `[c.5:.4 b.8:-.5]`, parsed into placements on `segment`. */
function parseObjects(token: string, open: number, segment: number, length: number): ItemPlacement[] {
  if (!token.endsWith(']')) throw new TrackSyntaxError(`objects must end with "]": "${token}"`);
  const body = token.slice(open + 1, -1).trim();
  return body.split(/\s+/).filter(Boolean).flatMap((item) => parseItem(item, segment, length));
}

export function parseTrack(source: string, initialWidth = 200): TrackSpec {
  const segments: Segment[] = [];
  const items: ItemPlacement[] = [];
  let width = initialWidth;
  for (const token of tokens(source)) {
    if (token.startsWith('W')) {
      width = num(token.slice(1), token);
      continue;
    }
    const open = token.indexOf('[');
    const segment = parseSegment(open < 0 ? token : token.slice(0, open), width);
    segments.push(segment);
    if (open >= 0) items.push(...parseObjects(token, open, segments.length - 1, segmentLength(segment)));
  }
  if (segments.length === 0) throw new TrackSyntaxError('a track needs at least one segment');
  return { segments, items };
}
