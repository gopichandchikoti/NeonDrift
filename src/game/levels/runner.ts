import { RULES } from '../physics/constants';
import { Track } from '../physics/track';
import { parseTrack } from '../physics/track-dsl';
import type { ItemPlacement } from '../physics/track-types';
import { World } from '../systems/world';
import { districtById } from './districts';
import type { StageDef } from './types';

export interface BuiltStage {
  track: Track;
  items: ItemPlacement[];
}

export function buildStage(def: Pick<StageDef, 'track'>): BuiltStage {
  const spec = parseTrack(def.track);
  return { track: new Track(spec.segments), items: spec.items };
}

export interface WorldTuning {
  sensitivity?: number;
}

/** A fresh world for a stage. The same call is used by the game, the validator and the tests. */
export function createStageWorld(def: StageDef, tuning: WorldTuning = {}): World {
  const { track, items } = buildStage(def);
  return new World({
    track,
    items,
    rules: {
      baseSpeed: def.speed,
      scrapeAngle: districtById(def.district).scrapeAngle,
      finishS: track.length - RULES.finishRunout,
      sensitivity: tuning.sensitivity ?? 1,
      startShield: def.startShield ?? false,
    },
  });
}

/** Run-length encodes a per-tick hold recording as [released, held, released, ...]. */
export function encodeInput(holds: readonly boolean[]): number[] {
  const runs: number[] = [];
  let current = false;
  let length = 0;
  for (const hold of holds) {
    if (hold === current) {
      length += 1;
      continue;
    }
    runs.push(length);
    current = hold;
    length = 1;
  }
  runs.push(length);
  return runs;
}

export function decodeInput(runs: readonly number[]): boolean[] {
  const holds: boolean[] = [];
  runs.forEach((length, i) => {
    for (let t = 0; t < length; t++) holds.push(i % 2 === 1);
  });
  return holds;
}
