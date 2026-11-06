export type ObjectiveKind = 'finish' | 'drift' | 'combo' | 'sparks' | 'traffic' | 'time';

/**
 * What a stage asks for, on top of reaching the finish. `ask` is the authored difficulty: the share of what the
 * validation autopilot achieved that the player must match (for `time`, the autopilot's time divided by `ask`).
 */
export interface ObjectiveSpec {
  kind: ObjectiveKind;
  ask: number;
}

/** A contextual coaching hint, shown when the car reaches distance `s`. */
export interface TutorialCue {
  s: number;
  text: string;
}

export interface StageDef {
  /** Stable id, e.g. "1-01". Saves are keyed by it, so never renumber. */
  id: string;
  district: number;
  index: number;
  name: string;
  /** The road, in the track format of src/game/physics/track-dsl.ts (it sets its own width with W tokens). */
  track: string;
  /** Cruising speed (units per second). */
  speed: number;
  objective: ObjectiveSpec;
  /** One-line authored note on what this stage teaches or tests (shown in the stage list). */
  note: string;
  startShield?: boolean;
  tutorial?: TutorialCue[];
}

/** Frozen numbers from the autopilot calibration run (src/game/levels/calibration.ts is generated). */
export interface Calibration {
  score: number;
  ticks: number;
  driftPoints: number;
  peakCombo: number;
  sparks: number;
  trafficPassed: number;
  /** The autopilot's input as run lengths, starting with released: [released, held, released, ...]. */
  input: number[];
  /** Fingerprint of the stage data and physics this was recorded with. */
  hash: string;
}

/** A stage with its objective target and star thresholds resolved from the calibration. */
export interface Stage extends StageDef {
  objectiveTarget: number;
  /** Score for two and three stars. One star is clearing the stage (finish + objective). */
  stars: [number, number];
  calibration: Calibration | null;
}
