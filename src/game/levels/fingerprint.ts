import { CAR, HANDLING, POINTS, RULES, SIM_HZ } from '../physics/constants';
import { hashString } from '../physics/rng';
import { districtById } from './districts';
import type { StageDef } from './types';

/** Collapses whitespace so reformatting a track string never changes its identity. */
export function normaliseTrack(track: string): string {
  return track.trim().replace(/\s+/g, ' ');
}

const PHYSICS = JSON.stringify({ CAR, HANDLING, POINTS, RULES, SIM_HZ });

/** Identifies the handling, rules and scoring numbers: anything calibrated against them goes stale if they change. */
export function physicsHash(): string {
  return hashString(PHYSICS).toString(16).padStart(8, '0');
}

/**
 * Identifies a stage together with the physics it was calibrated under. If either the stage or any handling, rule or
 * point constant changes, the stored autopilot calibration is stale and `npm run levels:calibrate` must be re-run.
 */
export function stageHash(def: StageDef): string {
  const body = JSON.stringify([
    normaliseTrack(def.track),
    def.speed,
    def.objective,
    def.startShield ?? false,
    districtById(def.district).scrapeAngle,
    PHYSICS,
  ]);
  return hashString(body).toString(16).padStart(8, '0');
}
