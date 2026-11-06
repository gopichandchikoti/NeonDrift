import { describe, expect, it } from 'vitest';
import { DAILY_SEEDS, DAILY_SEEDS_PHYSICS } from '../src/game/levels/daily-seeds';
import { FAIR, hazardProblem, placeAll } from '../src/game/levels/fairness';
import { physicsHash } from '../src/game/levels/fingerprint';
import { TrackGenerator } from '../src/game/levels/generator';
import { LIMITS } from '../src/game/levels/validate';
import { createDailyWorld, createEndlessWorld, dailySpec, dayNumber, ENDLESS, specFromSeed } from '../src/game/levels/modes';
import { Track } from '../src/game/physics/track';
import type { ItemPlacement } from '../src/game/physics/track-types';
import { Autopilot } from '../src/game/systems/autopilot';
import type { World } from '../src/game/systems/world';

type Road = { track: Track; items: ItemPlacement[] };

/** Time budget for tests that simulate minutes of play per seed. They take ~15-40 s on a quiet desktop and
 *  longer under coverage instrumentation or on a small CI runner, so the 60 s default is too tight for them. */
const HEAVY_MS = 240_000;

function generate(seed: number, target = 14000, difficulty: number | null = null): Road {
  const generator = new TrackGenerator({ seed, difficulty, speed: 300 });
  const track = new Track();
  const items = generator.fill(track, target);
  return { track, items };
}

/** True when two stretches of road more than 700 apart in distance overlap. */
function crosses(track: Track): boolean {
  for (let i = 0; i < track.xs.length; i += 3) {
    for (let j = i + 120; j < track.xs.length; j += 3) {
      const d = Math.hypot((track.xs[i] ?? 0) - (track.xs[j] ?? 0), (track.ys[i] ?? 0) - (track.ys[j] ?? 0));
      if (d < (track.halfWidths[i] ?? 0) + (track.halfWidths[j] ?? 0)) return true;
    }
  }
  return false;
}

function drive(world: World, limit: number): void {
  const bot = new Autopilot(world);
  for (let t = 0; t < limit && world.running; t++) {
    world.step({ hold: bot.decide(), steer: 0, boost: false });
    world.events.length = 0;
  }
}

describe('the road generator', () => {
  it('is deterministic: the same seed always builds the same road and objects', () => {
    const a = generate(11, 9000);
    const b = generate(11, 9000);
    expect(b.track.xs).toEqual(a.track.xs);
    expect(b.items).toEqual(a.items);
    expect(generate(12, 9000).track.xs).not.toEqual(a.track.xs);
  });

  it('builds at least the requested length and starts with a clear opening straight', () => {
    const { track, items } = generate(3, 6000);
    expect(track.length).toBeGreaterThanOrEqual(6000);
    const hazards = placeAll(track, items, 300);
    expect(hazards.every((h) => h.s >= 1500)).toBe(true);
    const daily = new Track();
    const dailyItems = new TrackGenerator({ seed: 3, difficulty: 0.5, speed: 300 }).fill(daily, 6000);
    expect(placeAll(daily, dailyItems, 300).every((h) => h.s >= 900)).toBe(true);
    expect(track.poseAt(400).halfWidth * 2).toBe(250);
  });

  it('only builds corners and widths the stages are allowed to use, and never loops back on itself', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { track } = generate(seed, 16000);
      for (const corner of track.corners) {
        expect(corner.radius).toBeGreaterThanOrEqual(LIMITS.minRadius);
        expect(Math.abs(corner.degrees)).toBeLessThanOrEqual(180);
      }
      expect(Math.min(...track.halfWidths) * 2).toBeGreaterThanOrEqual(LIMITS.minWidth);
      expect(Math.max(...track.halfWidths) * 2).toBeLessThanOrEqual(LIMITS.maxWidth);
      expect(crosses(track), `seed ${seed}`).toBe(false);
    }
  });

  it('places every hazard fairly, using the same rules as the 60 stages', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const difficulty of [null, 0.4, 0.9]) {
        const { track, items } = generate(seed, 12000, difficulty);
        const placed = placeAll(track, items, 300);
        for (const p of placed) expect(hazardProblem(placed, p, track), `seed ${seed}`).toBeNull();
        expect(items.every((i) => Math.abs(i.lat) <= 1 && i.at >= 0 && i.at <= 1)).toBe(true);
      }
    }
  });

  it('gets harder as the road goes on: gates and traffic only appear later', () => {
    const { track, items } = generate(5, 30000);
    const kindsBefore = (limit: number): Set<string> =>
      new Set(items.filter((i) => track.segmentStart(i.segment) < limit).map((i) => i.kind));
    expect(kindsBefore(2500).has('gate')).toBe(false);
    expect(kindsBefore(2500).has('traffic')).toBe(false);
    const late = kindsBefore(30000);
    expect(late.has('traffic') || late.has('gate')).toBe(true);
  });

  it('adds more road and objects when asked to extend, and leaves the finish clear when told to', () => {
    const generator = new TrackGenerator({ seed: 9, difficulty: 0.5, speed: 300 });
    const track = new Track();
    generator.fill(track, 3000);
    const before = track.length;
    const more = generator.extend(track);
    expect(track.length).toBeGreaterThan(before + 2000);
    expect(more.length).toBeGreaterThan(0);
    const clear = new Track();
    const items = new TrackGenerator({ seed: 9, difficulty: 0.5, speed: 300 }).fill(clear, 6000, 4000);
    const placed = placeAll(clear, items, 300);
    expect(placed.every((p) => p.s < 4000 + FAIR.trafficWake)).toBe(true);
  });
});

describe('endless and daily worlds', () => {
  it('start an endless run on a road that keeps growing and speeds up with distance', () => {
    const { world, district } = createEndlessWorld(77);
    expect(district).toBeGreaterThanOrEqual(1);
    expect(world.rules.finishS).toBeNull();
    expect(world.rules.baseSpeed).toBe(ENDLESS.baseSpeed);
    const start = world.track.length;
    drive(world, 120 * 25);
    expect(world.track.length).toBeGreaterThan(start);
    expect(world.s).toBeGreaterThan(3000);
  });

  it('survive a long time under the autopilot on several seeds (the roads are drivable)', () => {
    for (const seed of [101, 202, 303, 404]) {
      const { world } = createEndlessWorld(seed);
      drive(world, 120 * 60);
      expect(world.s, `seed ${seed}`).toBeGreaterThan(6000);
    }
  }, HEAVY_MS);

  it('make the daily challenge from the date alone: stable for a date, different across dates', () => {
    const a = dailySpec('2026-11-04');
    expect(dailySpec('2026-11-04')).toEqual(a);
    expect(dailySpec('2026-11-05').seed).not.toBe(a.seed);
    expect(a.district).toBeGreaterThanOrEqual(1);
    expect(a.district).toBeLessThanOrEqual(6);
    expect(a.length).toBeGreaterThanOrEqual(7000);
    const w1 = createDailyWorld(a).world;
    const w2 = createDailyWorld(a).world;
    expect(w2.track.xs).toEqual(w1.track.xs);
    expect(w1.rules.finishS).toBeCloseTo(w1.track.length - 160);
  });

  it('can be driven most of the way by the autopilot, for a spread of dates', () => {
    for (const key of ['2026-11-04', '2026-12-25', '2027-02-14']) {
      const { world } = createDailyWorld(dailySpec(key));
      drive(world, 120 * 90);
      const finish = world.rules.finishS ?? 0;
      expect(world.s, key).toBeGreaterThan(finish * 0.55);
    }
  }, HEAVY_MS);
});

describe('the validated daily pool', () => {
  it('was built under the current physics, so it is not stale', () => {
    expect(DAILY_SEEDS_PHYSICS).toBe(physicsHash());
  });

  it('holds hundreds of distinct seeds and maps consecutive dates to consecutive courses', () => {
    expect(DAILY_SEEDS.length).toBeGreaterThanOrEqual(365);
    expect(new Set(DAILY_SEEDS).size).toBe(DAILY_SEEDS.length);
    expect(dayNumber('2026-11-05') - dayNumber('2026-11-04')).toBe(1);
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
    const a = dailySpec('2026-11-04');
    const b = dailySpec('2026-11-05');
    expect(a.seed).not.toBe(b.seed);
    expect(dailySpec(`2026-11-04`).seed).toBe(DAILY_SEEDS[dayNumber('2026-11-04') % DAILY_SEEDS.length]);
    expect(specFromSeed('x', a.seed)).toMatchObject({ district: a.district, speed: a.speed, length: a.length });
  });

  it('only contains courses the autopilot can finish (a sample is replayed here; the full pool by the script)', () => {
    for (const index of [0, 97, 213, 399]) {
      const seed = DAILY_SEEDS[index] as number;
      const { world } = createDailyWorld(specFromSeed('2000-01-01', seed));
      drive(world, 120 * 150);
      expect(world.status, `pool entry ${index}`).toBe('finished');
    }
  }, HEAVY_MS);
});
