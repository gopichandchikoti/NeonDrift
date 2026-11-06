import { SIM_HZ } from '../physics/constants';
import type { RunStats } from '../systems/world-types';
import type { Calibration, ObjectiveKind, ObjectiveSpec, Stage } from './types';

/** The number a player has to reach for an objective, from what the autopilot achieved and the authored `ask`. */
export function objectiveTarget(spec: ObjectiveSpec, cal: Calibration): number {
  const scaled = (value: number, floor: number): number => Math.max(floor, Math.floor(value * spec.ask));
  switch (spec.kind) {
    case 'finish':
      return 0;
    case 'drift':
      return Math.max(100, Math.round((cal.driftPoints * spec.ask) / 10) * 10);
    case 'combo':
      return scaled(cal.peakCombo, 2);
    case 'sparks':
      return scaled(cal.sparks, 3);
    case 'traffic':
      return scaled(cal.trafficPassed, 2);
    case 'time':
      return Math.ceil(cal.ticks / spec.ask);
  }
}

export const OBJECTIVE_TITLES: Record<ObjectiveKind, string> = {
  finish: 'Reach the finish',
  drift: 'Earn drift points',
  combo: 'Reach a combo multiplier',
  sparks: 'Collect sparks',
  traffic: 'Pass traffic cars',
  time: 'Beat the clock',
};

type Goal = Pick<Stage, 'objective' | 'objectiveTarget'>;

export function objectiveSentence(stage: Goal): string {
  const target = stage.objectiveTarget;
  switch (stage.objective.kind) {
    case 'finish':
      return 'Reach the finish line';
    case 'drift':
      return `Earn ${target} drift points`;
    case 'combo':
      return `Reach a x${target} combo`;
    case 'sparks':
      return `Collect ${target} sparks`;
    case 'traffic':
      return `Pass ${target} traffic cars`;
    case 'time':
      return `Finish in ${(target / SIM_HZ).toFixed(1)} s or less`;
  }
}

export interface ObjectiveProgress {
  value: number;
  target: number;
  /** For a time objective this is true while the clock is still inside the limit. */
  met: boolean;
  /** 0..1 for the HUD bar. */
  fraction: number;
}

function measure(value: number, target: number): ObjectiveProgress {
  return { value, target, met: value >= target, fraction: Math.min(1, value / Math.max(1, target)) };
}

export function objectiveProgress(stage: Goal, stats: RunStats): ObjectiveProgress {
  const target = stage.objectiveTarget;
  switch (stage.objective.kind) {
    case 'finish':
      return { value: 0, target: 0, met: true, fraction: 0 };
    case 'drift':
      return measure(stats.driftPoints, target);
    case 'combo':
      return measure(stats.peakCombo, target);
    case 'sparks':
      return measure(stats.sparks, target);
    case 'traffic':
      return measure(stats.trafficPassed, target);
    case 'time': {
      const done = stats.finishTicks ?? stats.ticks;
      return { value: Math.max(0, target - done), target, met: done <= target, fraction: Math.min(1, done / target) };
    }
  }
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** The one-line progress readout for the HUD, such as "Drift points 420 / 1,500" or "Time left 12.4 s". */
export function objectiveHudText(stage: Goal, p: ObjectiveProgress): string {
  switch (stage.objective.kind) {
    case 'finish':
      return 'Reach the finish';
    case 'time':
      return `Time left ${(p.value / SIM_HZ).toFixed(1)} s`;
    case 'drift':
      return `Drift points ${fmt(p.value)} / ${fmt(p.target)}`;
    case 'combo':
      return `Combo x${p.value} / x${p.target}`;
    case 'sparks':
      return `Sparks ${fmt(p.value)} / ${fmt(p.target)}`;
    case 'traffic':
      return `Cars passed ${fmt(p.value)} / ${fmt(p.target)}`;
  }
}

export interface Verdict {
  finished: boolean;
  objectiveMet: boolean;
  /** 0 = not cleared; 1 = cleared; 2 and 3 for the score thresholds. */
  stars: 0 | 1 | 2 | 3;
}

export function judgeRun(stage: Stage, stats: RunStats, finished: boolean): Verdict {
  const objectiveMet = objectiveProgress(stage, stats).met;
  if (!finished || !objectiveMet) return { finished, objectiveMet, stars: 0 };
  if (stats.score >= stage.stars[1]) return { finished, objectiveMet, stars: 3 };
  return { finished, objectiveMet, stars: stats.score >= stage.stars[0] ? 2 : 1 };
}
