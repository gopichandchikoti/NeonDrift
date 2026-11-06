import type { ItemPlacement } from '../physics/track-types';
import type { Track } from '../physics/track';

export interface InputFrame {
  /** One-thumb control: hold anywhere to steer into the coming bend. */
  hold: boolean;
  /** Alternate controls (left/right buttons, A/D, arrows): -1, 0 or +1. Takes priority over hold. */
  steer: number;
  /** True on the step the boost control was pressed. */
  boost: boolean;
}

export const NO_INPUT: InputFrame = { hold: false, steer: 0, boost: false };

export interface StageRules {
  baseSpeed: number;
  /** Barrier impacts shallower than this angle (rad) are scrapes, steeper ones are crashes. */
  scrapeAngle: number;
  /** Distance of the finish line; null in endless mode. */
  finishS: number | null;
  /** Endless: extra speed per 1000 units travelled, up to maxSpeed. */
  speedRamp?: number;
  maxSpeed?: number;
  /** Steering sensitivity from settings, 0.8 - 1.2. */
  sensitivity?: number;
  /** Start with a shield (some later stages and the daily challenge). */
  startShield?: boolean;
}

/** Endless mode grows the road ahead of the car. */
export interface TrackExtender {
  extend(track: Track): ItemPlacement[];
}

export type RunStatus = 'racing' | 'finished' | 'crashed';

export interface RunStats {
  score: number;
  driftPoints: number;
  nearMisses: number;
  edgeKisses: number;
  sparks: number;
  scrapes: number;
  peakCombo: number;
  longestDrift: number;
  trafficPassed: number;
  boosts: number;
  shieldsUsed: number;
  distance: number;
  ticks: number;
  finishTicks: number | null;
}

export function createStats(): RunStats {
  return {
    score: 0,
    driftPoints: 0,
    nearMisses: 0,
    edgeKisses: 0,
    sparks: 0,
    scrapes: 0,
    peakCombo: 1,
    longestDrift: 0,
    trafficPassed: 0,
    boosts: 0,
    shieldsUsed: 0,
    distance: 0,
    ticks: 0,
    finishTicks: null,
  };
}

interface At {
  x: number;
  y: number;
}

export type WorldEvent =
  | ({ type: 'drift-start' } & At)
  | ({ type: 'drift-end'; points: number; seconds: number } & At)
  | ({ type: 'near-miss'; points: number; hazard: string } & At)
  | ({ type: 'edge-kiss'; points: number } & At)
  | ({ type: 'spark'; points: number } & At)
  | ({ type: 'shield-pickup' } & At)
  | ({ type: 'magnet-pickup' } & At)
  | ({ type: 'scrape'; side: number } & At)
  | ({ type: 'shield-break' } & At)
  | ({ type: 'crash'; reason: 'barrier' | 'hazard' | 'spin' } & At)
  | ({ type: 'traffic-pass'; points: number } & At)
  | { type: 'combo-up'; level: number }
  | { type: 'combo-drop'; level: number }
  | { type: 'combo-break' }
  | { type: 'boost-ready' }
  | { type: 'boost-start' }
  | { type: 'finish'; clean: boolean };

export type WorldEventType = WorldEvent['type'];
