import { angleDiff } from '../physics/math';
import { restoreWorld, snapshotWorld } from './snapshot';
import type { World } from './world';

/** What the autopilot values in a look-ahead, so it can chase the stage's objective. */
export interface BotWeights {
  progress: number;
  score: number;
  sparks: number;
  scrape: number;
  /** Penalty for hugging a barrier: squared excess beyond 70% of the half width, summed along the look-ahead. */
  edge: number;
}

export const DEFAULT_WEIGHTS: BotWeights = { progress: 1, score: 0.05, sparks: 40, scrape: 450, edge: 400 };

/** A follow-up line: a lateral target relative to the bend (inside +) or absolute (right +), as a fraction. */
export interface Line {
  relative: boolean;
  target: number;
}

const LINES: Line[] = [-0.6, -0.2, 0.2, 0.6].flatMap((target) => [
  { relative: true, target },
  { relative: false, target },
]);

/**
 * Hold-or-release from a simple rule: steer toward the line's lateral target, damped by the sideways velocity. A hold
 * that is latched the wrong way is released first, exactly as a player would lift their thumb. Used for the tail of
 * every look-ahead.
 */
export function heuristicHold(w: World, line: Line): boolean {
  const dir = w.track.assistAt(w.s + 20);
  if (w.holding && w.latched !== dir) return false;
  const lateralVelocity = w.car.speed * Math.sin(angleDiff(w.car.velAngle, w.roadAngle));
  const goal = line.target * w.halfWidth * 0.8 * (line.relative ? 1 : dir);
  const error = dir * w.lateral - goal;
  return error + 0.3 * dir * lateralVelocity < 0;
}

/**
 * A look-ahead planner that only ever uses the real one-thumb input (hold or release). Every `every` ticks it tries
 * both first actions combined with several follow-up lines, simulates each `horizon` ticks ahead on the real world
 * (then restores it exactly), and commits to the best first action. Its recorded input proves a stage is playable.
 */
export class Autopilot {
  private current = false;
  private countdown = 0;

  constructor(
    private readonly world: World,
    private readonly weights: BotWeights = DEFAULT_WEIGHTS,
    private readonly horizon = 240,
    private readonly every = 12,
  ) {}

  /** Call once per tick before world.step(). */
  decide(): boolean {
    if (this.countdown > 0) {
      this.countdown -= 1;
      return this.current;
    }
    this.countdown = this.every - 1;
    this.current = this.plan();
    return this.current;
  }

  private plan(): boolean {
    const w = this.world;
    const snap = snapshotWorld(w);
    const extending = w.extending;
    w.extending = false;
    let best = -Infinity;
    let choice = false;
    for (const first of [true, false]) {
      for (const line of LINES) {
        const value = this.rollout(first, line);
        restoreWorld(w, snap);
        if (value > best) {
          best = value;
          choice = first;
        }
      }
    }
    w.extending = extending;
    return choice;
  }

  private rollout(first: boolean, line: Line): number {
    const w = this.world;
    const start = { s: w.s, score: w.stats.score, sparks: w.stats.sparks, scrapes: w.stats.scrapes, shield: w.shield };
    const k = this.weights;
    let hugging = 0;
    for (let t = 0; t < this.horizon && w.running; t++) {
      const hold = t < this.every ? first : heuristicHold(w, line);
      w.step({ hold, steer: 0, boost: false });
      if (w.status === 'crashed') return -1e6 + t * 100;
      if (t % 6 === 0) hugging += Math.max(0, Math.abs(w.lateral) / w.halfWidth - 0.7) ** 2;
    }
    const lostShield = start.shield && !w.shield ? 900 : 0;
    return (
      (w.s - start.s) * k.progress +
      (w.stats.score - start.score) * k.score +
      (w.stats.sparks - start.sparks) * k.sparks -
      (w.stats.scrapes - start.scrapes) * k.scrape -
      lostShield -
      hugging * k.edge +
      (w.status === 'finished' ? 5000 : 0)
    );
  }
}
