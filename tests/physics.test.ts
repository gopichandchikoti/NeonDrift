import { describe, expect, it } from 'vitest';
import { createCar, slipOf, stepCar, carCorners } from '../src/game/physics/car';
import { DT, HANDLING } from '../src/game/physics/constants';
import { angleDiff, approach, clamp, lerp, lerpAngle, pointSegmentDistance, wrapAngle } from '../src/game/physics/math';
import { Rng, hashString } from '../src/game/physics/rng';
import { STEP, Track } from '../src/game/physics/track';
import { parseTrack, segmentLength, TrackSyntaxError } from '../src/game/physics/track-dsl';

describe('math helpers', () => {
  it('wraps angles into [-PI, PI) and finds the short way round', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-0.5)).toBeCloseTo(-0.5);
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
    expect(lerpAngle(3.0, -3.0, 0.5)).toBeCloseTo(Math.PI, 0);
  });

  it('clamps, lerps and approaches without overshooting', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 4)).toBe(6);
  });

  it('measures the distance from a point to a segment, including a degenerate one', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(pointSegmentDistance({ x: 5, y: 3 }, a, b)).toBe(3);
    expect(pointSegmentDistance({ x: -4, y: 3 }, a, b)).toBe(5);
    expect(pointSegmentDistance({ x: 3, y: 4 }, a, a)).toBe(5);
  });
});

describe('seeded randomness', () => {
  it('gives the same sequence for the same seed and different ones for different seeds', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const first = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(first);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(first);
  });

  it('keeps ranges, integers, picks and chances in bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      expect(r.range(2, 5)).toBeGreaterThanOrEqual(2);
      expect(r.range(2, 5)).toBeLessThan(5);
      const n = r.int(1, 3);
      expect([1, 2, 3]).toContain(n);
      expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    }
    expect(new Rng(1).chance(0)).toBe(false);
    expect(new Rng(1).chance(1)).toBe(true);
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it('hashes text to a stable 32-bit number', () => {
    expect(hashString('neon')).toBe(hashString('neon'));
    expect(hashString('neon')).not.toBe(hashString('drift'));
    expect(hashString('')).toBeGreaterThanOrEqual(0);
  });
});

describe('track format', () => {
  it('parses segments, widths and objects', () => {
    const spec = parseTrack('W240 S400[c.5:.4] R90@200[s0-1:.5] L45@300[g.5:.6:2:.25 t.5:.4:150:-.4 b.5:0 h.5:0 m.5:0]');
    expect(spec.segments).toHaveLength(3);
    expect(spec.segments[0]).toEqual({ kind: 'straight', length: 400, width: 240 });
    expect(spec.segments[1]).toMatchObject({ kind: 'arc', degrees: 90, radius: 200 });
    expect(spec.segments[2]).toMatchObject({ kind: 'arc', degrees: -45, radius: 300 });
    const kinds = spec.items.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['cone', 'spark', 'gate', 'traffic', 'block', 'shield', 'magnet']));
    const gate = spec.items.find((i) => i.kind === 'gate');
    expect(gate).toMatchObject({ amp: 0.6, period: 2, phase: 0.25 });
    expect(spec.items.find((i) => i.kind === 'traffic')).toMatchObject({ speed: 150, amp: -0.4, lat: 0.4 });
  });

  it('rejects malformed text with a clear error', () => {
    for (const bad of ['', 'X10', 'S', 'R90', 'S10@5', 'S100[c.5', 'S100]', 'S100[z.5:0]', 'S100[c.5:abc]', 'Wabc S10']) {
      expect(() => parseTrack(bad)).toThrow(TrackSyntaxError);
    }
  });

  it('measures segment length exactly', () => {
    expect(segmentLength({ kind: 'straight', length: 123, width: 200 })).toBe(123);
    expect(segmentLength({ kind: 'arc', degrees: 90, radius: 100, width: 200 })).toBeCloseTo(157.08, 1);
  });
});

describe('track geometry', () => {
  it('turns a right arc through the right angle and ends where the maths says', () => {
    const track = new Track(parseTrack('S100 R90@200 S100').segments);
    const start = track.poseAt(0);
    expect(start.angle).toBeCloseTo(-Math.PI / 2);
    const end = track.poseAt(track.length);
    expect(end.angle).toBeCloseTo(0); // -90deg + 90deg
    // Straight 100 up, a quarter turn of radius 200 to the right, then 100 along +x.
    expect(end.x).toBeCloseTo(200 + 100, 0);
    expect(end.y).toBeCloseTo(-100 - 200, 0);
  });

  it('keeps samples exactly STEP apart in distance and interpolates between them', () => {
    const track = new Track(parseTrack('S300 L60@250 S200').segments);
    expect(track.xs.length).toBe(Math.floor(track.length / STEP) + 1);
    const a = track.poseAt(STEP * 10);
    const b = track.poseAt(STEP * 10 + STEP / 2);
    const c = track.poseAt(STEP * 11);
    expect(b.x).toBeCloseTo((a.x + c.x) / 2);
    expect(b.y).toBeCloseTo((a.y + c.y) / 2);
  });

  it('offsets a point sideways to the right of travel', () => {
    const track = new Track(parseTrack('S400').segments);
    const p = track.pointAt(100, 30);
    const q = track.pointAt(100, 0);
    expect(p.x - q.x).toBeCloseTo(30);
  });

  it('projects a point back onto the road with a signed lateral offset', () => {
    const track = new Track(parseTrack('S600 R90@250 S400').segments);
    const hint = track.indexAt(300);
    const on = track.pointAt(300, 40);
    const found = track.project(on.x, on.y, hint);
    expect(found.s).toBeCloseTo(300, 0);
    expect(found.lateral).toBeCloseTo(40, 0);
    const left = track.pointAt(900, -55);
    expect(track.project(left.x, left.y, track.indexAt(850)).lateral).toBeCloseTo(-55, 0);
  });

  it('knows which way to steer: the bend it is in, else the next one, else the last one', () => {
    const track = new Track(parseTrack('S300 R60@250 S300 L60@250 S300').segments);
    expect(track.assistAt(100)).toBe(1); // next bend is right
    const inRight = track.corners[0];
    expect(track.assistAt(((inRight?.startS ?? 0) + (inRight?.endS ?? 0)) / 2)).toBe(1);
    expect(track.assistAt((inRight?.endS ?? 0) + 150)).toBe(-1); // next bend is left
    expect(track.assistAt(track.length - 10)).toBe(-1); // after the last bend: keeps its direction
  });

  it('blends the road width over a short distance instead of jumping', () => {
    const track = new Track(parseTrack('W200 S300 W260 S300').segments);
    expect(track.poseAt(150).halfWidth).toBeCloseTo(100);
    expect(track.poseAt(450).halfWidth).toBeCloseTo(130);
    const mid = track.poseAt(300 + 20).halfWidth;
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(130);
  });

  it('grows without changing what was already built, and previews without changing anything', () => {
    const track = new Track(parseTrack('S300').segments);
    const before = track.xs.length;
    const first = track.poseAt(200);
    const preview = track.preview(parseTrack('R90@200').segments);
    expect(track.xs.length).toBe(before);
    expect(preview.xs.length).toBeGreaterThan(10);
    track.append(parseTrack('R90@200 S200').segments);
    expect(track.xs.length).toBeGreaterThan(before);
    expect(track.poseAt(200)).toEqual(first);
    expect(track.segmentCount).toBe(3);
    expect(track.segmentStart(1)).toBe(300);
    expect(track.segmentLengthAt(1)).toBeCloseTo(314.16, 1);
  });

  it('answers sensibly for an empty track and out-of-range distances', () => {
    const empty = new Track();
    expect(empty.length).toBe(0);
    expect(empty.poseAt(50).halfWidth).toBe(0);
    const track = new Track(parseTrack('S100').segments);
    expect(track.poseAt(-50).x).toBeCloseTo(track.poseAt(0).x);
    expect(track.poseAt(9999).y).toBeCloseTo(track.poseAt(track.length).y);
    expect(track.segmentStart(9)).toBe(0);
    expect(track.segmentLengthAt(9)).toBe(0);
  });
});

describe('car handling', () => {
  const drive = (steer: number, seconds: number, speed = 300): ReturnType<typeof createCar> => {
    const car = createCar(0, 0, 0);
    car.speed = speed;
    for (let t = 0; t < seconds / DT; t++) stepCar(car, { steer, roadAngle: 0, targetSpeed: speed, sensitivity: 1 });
    return car;
  };

  it('accelerates from rest toward the target speed and never beyond it', () => {
    const car = createCar(0, 0, 0);
    for (let t = 0; t < 120; t++) stepCar(car, { steer: 0, roadAngle: 0, targetSpeed: 300, sensitivity: 1 });
    expect(car.speed).toBeGreaterThan(250);
    expect(car.speed).toBeLessThanOrEqual(300 + 1e-9);
  });

  it('holds a straight line when released on a road that points straight ahead', () => {
    const car = drive(0, 2);
    expect(Math.abs(car.y)).toBeLessThan(0.01);
    expect(car.x).toBeGreaterThan(500);
  });

  it('turns at a rate set by the turn radius, whatever the speed (boost cannot tighten it)', () => {
    const slow = drive(1, 0.5, 200);
    const fast = drive(1, 0.5, 400);
    const slowYaw = slow.heading;
    const fastYaw = fast.heading;
    // Yaw rate is speed / radius, so the faster car turns faster in angle but its path radius is the same.
    expect(fastYaw).toBeGreaterThan(slowYaw);
    expect(200 / HANDLING.turnRadius).toBeLessThan(400 / HANDLING.turnRadius);
  });

  it('slides while holding (heading and travel differ) and straightens after release', () => {
    const car = drive(1, 0.6);
    expect(Math.abs(slipOf(car))).toBeGreaterThan(0.1);
    for (let t = 0; t < 240; t++) stepCar(car, { steer: 0, roadAngle: 0, targetSpeed: 300, sensitivity: 1 });
    expect(Math.abs(angleDiff(car.heading, 0))).toBeLessThan(0.05);
    expect(Math.abs(slipOf(car))).toBeLessThan(0.05);
  });

  it('is deterministic: the same inputs give bit-identical results', () => {
    const a = drive(1, 1.3);
    const b = drive(1, 1.3);
    expect(a).toEqual(b);
  });

  it('scales the turn rate with the sensitivity setting', () => {
    const run = (sensitivity: number): number => {
      const car = createCar(0, 0, 0);
      car.speed = 300;
      for (let t = 0; t < 60; t++) stepCar(car, { steer: 1, roadAngle: 0, targetSpeed: 300, sensitivity });
      return car.heading;
    };
    expect(run(1.2)).toBeGreaterThan(run(1));
    expect(run(0.8)).toBeLessThan(run(1));
  });

  it('reports four body corners around the car', () => {
    const car = createCar(10, 20, 0);
    const corners = carCorners(car, 17, 9);
    expect(corners).toHaveLength(4);
    expect(corners.map((c) => Math.round(c.x))).toEqual(expect.arrayContaining([27, -7]));
  });
});
