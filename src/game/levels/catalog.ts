import { CALIBRATION } from './calibration';
import { objectiveTarget } from './objectives';
import { STAGE_DEFS } from './stages';
import type { Calibration, Stage, StageDef } from './types';

const round10 = (value: number): number => Math.round(value / 10) * 10;

/** Share of the autopilot's score that earns two and three stars. */
export const STAR_SHARES: readonly [number, number] = [0.5, 0.8];

export function resolveStage(def: StageDef, cal: Calibration | null): Stage {
  if (!cal) return { ...def, objectiveTarget: 0, stars: [0, 0], calibration: null };
  return {
    ...def,
    objectiveTarget: objectiveTarget(def.objective, cal),
    stars: [round10(cal.score * STAR_SHARES[0]), round10(cal.score * STAR_SHARES[1])],
    calibration: cal,
  };
}

export const STAGES: readonly Stage[] = STAGE_DEFS.map((def) => resolveStage(def, CALIBRATION[def.id] ?? null));

export function stageById(id: string): Stage | undefined {
  return STAGES.find((s) => s.id === id);
}

export function stagesOfDistrict(district: number): Stage[] {
  return STAGES.filter((s) => s.district === district);
}

/** The stage after `id` in play order, if any. */
export function nextStage(id: string): Stage | undefined {
  const i = STAGES.findIndex((s) => s.id === id);
  return i >= 0 ? STAGES[i + 1] : undefined;
}
