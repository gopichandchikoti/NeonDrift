/**
 * Plays the daily challenge for a run of dates with the hold/release autopilot and reports how far it gets.
 *
 *   npm run levels:daily            the next 30 days
 *   npm run levels:daily -- 90      the next 90 days
 *
 * A daily course must be completable, so any date the autopilot cannot finish is listed with where it failed.
 */
import { createDailyWorld, dailySpec } from '../../src/game/levels/modes';
import { dateKey } from '../../src/services/progress';
import { Autopilot } from '../../src/game/systems/autopilot';
import { SIM_HZ } from '../../src/game/physics/constants';

export interface DailyOutcome {
  key: string;
  finished: boolean;
  reached: number;
  of: number;
  difficulty: number;
}

export function playDaily(key: string): DailyOutcome {
  const spec = dailySpec(key);
  const { world } = createDailyWorld(spec);
  const bot = new Autopilot(world);
  for (let t = 0; t < SIM_HZ * 150 && world.running; t++) {
    world.step({ hold: bot.decide(), steer: 0, boost: false });
    world.events.length = 0;
  }
  const of = Math.round(world.rules.finishS ?? 0);
  return { key, finished: world.status === 'finished', reached: Math.round(world.s), of, difficulty: spec.difficulty };
}

export function nextDays(count: number, from = new Date(2026, 10, 4)): string[] {
  const day = (i: number): Date => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
  return Array.from({ length: count }, (_, i) => dateKey(day(i)));
}

if (process.argv[1]?.endsWith('daily-check.ts')) {
  const days = Number(process.argv[2] ?? 30);
  const outcomes = nextDays(days).map(playDaily);
  const failed = outcomes.filter((o) => !o.finished);
  for (const o of failed) console.log(`  ✗ ${o.key}: reached ${o.reached} of ${o.of} (difficulty ${o.difficulty.toFixed(2)})`);
  console.log(`daily: ${outcomes.length - failed.length} of ${outcomes.length} dates finished by the autopilot.`);
  process.exit(failed.length > 0 ? 1 : 0);
}
