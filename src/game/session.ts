import { DT } from './physics/constants';
import { judgeRun, type Verdict } from './levels/objectives';
import type { Stage, TutorialCue } from './levels/types';
import type { World } from './systems/world';
import { NO_INPUT, type InputFrame, type RunStats, type WorldEvent } from './systems/world-types';

export type RunMode = 'stage' | 'endless' | 'daily';
export type InputSource = 'pointer' | 'key' | 'left-button' | 'right-button' | 'key-left' | 'key-right';

export interface RunResult {
  mode: RunMode;
  stage: Stage | null;
  outcome: 'finished' | 'crashed';
  stats: RunStats;
  verdict: Verdict;
  /** Seconds of play. */
  seconds: number;
}

const DT_MS = DT * 1000;
const MAX_STEPS_PER_FRAME = 8;
/** Time between the crash or the finish and the results appearing, so the moment can play out. */
const END_DELAY_MS = { crashed: 900, finished: 1500 };

export interface SessionOptions {
  world: World;
  mode: RunMode;
  stage?: Stage | null;
  cues?: readonly TutorialCue[];
}

/**
 * One attempt at a stage or an endless run: advances the world in fixed steps from real elapsed time, gathers input
 * from every source (touch, keyboard, on-screen buttons), and reports the result once the end has played out.
 */
export class Session {
  readonly world: World;
  readonly mode: RunMode;
  readonly stage: Stage | null;
  paused = false;
  /** Fraction (0..1) of a step not yet simulated: lets the renderer interpolate between two states. */
  alpha = 0;
  result: RunResult | null = null;
  /** The car as it was one step ago, for interpolation. */
  prev: { x: number; y: number; heading: number };
  cue: TutorialCue | null = null;
  /** A recorded hold/release per tick (the attract-mode demo). When set it replaces every other input. */
  script: readonly boolean[] | null = null;
  private readonly cues: readonly TutorialCue[];
  private cueIndex = 0;
  private acc = 0;
  private endClock = 0;
  private boostQueued = false;
  private readonly sources = new Set<InputSource>();

  constructor(options: SessionOptions) {
    this.world = options.world;
    this.mode = options.mode;
    this.stage = options.stage ?? null;
    this.cues = options.cues ?? [];
    const car = this.world.car;
    this.prev = { x: car.x, y: car.y, heading: car.heading };
  }

  setSource(source: InputSource, down: boolean): void {
    if (down) this.sources.add(source);
    else this.sources.delete(source);
  }

  clearInput(): void {
    this.sources.clear();
  }

  queueBoost(): void {
    this.boostQueued = true;
  }

  get holding(): boolean {
    return this.sources.has('pointer') || this.sources.has('key');
  }

  private frame(): InputFrame {
    if (this.paused) return NO_INPUT;
    const right = this.sources.has('right-button') || this.sources.has('key-right');
    const left = this.sources.has('left-button') || this.sources.has('key-left');
    const boost = this.boostQueued;
    this.boostQueued = false;
    if (this.script) return { hold: this.script[this.world.tick] ?? false, steer: 0, boost: false };
    return { hold: this.holding, steer: Number(right) - Number(left), boost };
  }

  /** Advances by `ms` of real time and returns the world events produced. Safe to call while paused or ended. */
  advance(ms: number): WorldEvent[] {
    const events: WorldEvent[] = [];
    if (this.paused) return events;
    if (this.world.running) this.simulate(ms, events);
    else this.waitForEnd(ms);
    this.updateCue();
    return events;
  }

  private simulate(ms: number, events: WorldEvent[]): void {
    this.acc += Math.min(ms, 100);
    let steps = 0;
    while (this.acc >= DT_MS && steps < MAX_STEPS_PER_FRAME && this.world.running) {
      const car = this.world.car;
      this.prev = { x: car.x, y: car.y, heading: car.heading };
      // Read per step, not per frame: a recorded script is indexed by tick, and a boost press fires exactly once.
      this.world.step(this.frame());
      this.acc -= DT_MS;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    this.alpha = this.world.running ? this.acc / DT_MS : 0;
    events.push(...this.world.events);
    this.world.events.length = 0;
  }

  private waitForEnd(ms: number): void {
    const status = this.world.status;
    if (status === 'racing' || this.result) return;
    // A finished car keeps rolling to a stop while the finish plays out.
    if (status === 'finished') {
      for (let i = Math.round(ms / DT_MS); i > 0; i--) this.world.step(NO_INPUT);
    }
    this.endClock += ms;
    if (this.endClock < END_DELAY_MS[status]) return;
    const stats = this.world.stats;
    const stage = this.stage;
    const finished = status === 'finished';
    const verdict = stage
      ? judgeRun(stage, stats, finished)
      : { finished, objectiveMet: true, stars: 0 as const };
    this.result = { mode: this.mode, stage, outcome: status, stats, verdict, seconds: stats.ticks * DT };
  }

  private updateCue(): void {
    const next = this.cues[this.cueIndex];
    if (next && this.world.s >= next.s) {
      this.cue = next;
      this.cueIndex += 1;
    } else if (this.cue && this.world.s > this.cue.s + 500) {
      this.cue = null;
    }
  }

  /** Time since the run ended (ms), for the renderer's crash and finish effects. */
  get sinceEnd(): number {
    return this.endClock;
  }
}
