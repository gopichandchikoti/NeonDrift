import { RULES } from '../physics/constants';
import { hashString } from '../physics/rng';
import { Track } from '../physics/track';
import { World } from '../systems/world';
import { DAILY_SEEDS } from './daily-seeds';
import { districtById } from './districts';
import { TrackGenerator } from './generator';

export interface DailySpec {
  /** Local calendar date, YYYY-MM-DD. The whole course comes from it: same date, same road, on any device. */
  key: string;
  seed: number;
  district: number;
  speed: number;
  difficulty: number;
  length: number;
}

/** The course parameters that follow from a seed. Validating a seed therefore validates all of them. */
export function specFromSeed(key: string, seed: number): DailySpec {
  return {
    key,
    seed,
    district: 1 + (seed % 6),
    speed: 310 + ((seed >>> 6) % 4) * 10,
    difficulty: 0.35 + ((seed >>> 3) % 5) * 0.08,
    length: 7000 + ((seed >>> 9) % 3) * 800,
  };
}

/** Whole days since 1970 for a YYYY-MM-DD date (calendar arithmetic only: no time zone is involved). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Everything about a day's challenge, derived only from the date text. No server is involved. The seed comes from a
 * pool of courses that were each played through by the autopilot (`npm run levels:daily-seeds`), so every day's
 * course is known to be completable. Consecutive dates use consecutive pool entries.
 */
export function dailySpec(key: string): DailySpec {
  const pool = DAILY_SEEDS;
  const seed = pool.length > 0 ? (pool[dayNumber(key) % pool.length] as number) : hashString(`neon-drift-daily-${key}`);
  return specFromSeed(key, seed);
}

export interface ModeWorld {
  world: World;
  district: number;
  seed: number;
}

export function createDailyWorld(spec: DailySpec, sensitivity = 1): ModeWorld {
  const generator = new TrackGenerator({ seed: spec.seed, difficulty: spec.difficulty, speed: spec.speed });
  const track = new Track();
  const items = generator.fill(track, spec.length, spec.length - 700);
  track.append([{ kind: 'straight', length: 450, width: track.endPose.half * 2 }]);
  const world = new World({
    track,
    items,
    rules: {
      baseSpeed: spec.speed,
      scrapeAngle: districtById(spec.district).scrapeAngle,
      finishS: track.length - RULES.finishRunout,
      sensitivity,
    },
  });
  return { world, district: spec.district, seed: spec.seed };
}

export const ENDLESS = { baseSpeed: 290, speedRamp: 6, maxSpeed: 380 };

export function createEndlessWorld(seed: number, sensitivity = 1): ModeWorld {
  const district = 1 + (seed % 6);
  const generator = new TrackGenerator({ seed, difficulty: null, speed: ENDLESS.baseSpeed + 20 });
  const track = new Track();
  const items = generator.fill(track, 3600);
  const world = new World({
    track,
    items,
    extender: generator,
    rules: {
      baseSpeed: ENDLESS.baseSpeed,
      scrapeAngle: districtById(district).scrapeAngle,
      finishS: null,
      speedRamp: ENDLESS.speedRamp,
      maxSpeed: ENDLESS.maxSpeed,
      sensitivity,
    },
  });
  return { world, district, seed };
}
