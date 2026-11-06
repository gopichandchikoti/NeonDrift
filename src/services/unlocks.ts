import type { CarDesign, Palette } from '../game/cosmetics';
import { STAGE_DEFS } from '../game/levels/stages';
import type { Progress } from './progress-model';

export const STARS_PER_STAGE = 3;
export const MAX_STARS = STAGE_DEFS.length * STARS_PER_STAGE;

export function totalStars(progress: Progress): number {
  return Object.values(progress.stages).reduce((sum, r) => sum + r.stars, 0);
}

export function clearedCount(progress: Progress): number {
  return STAGE_DEFS.filter((s) => progress.stages[s.id]?.cleared).length;
}

export function districtCleared(progress: Progress, district: number): boolean {
  const stages = STAGE_DEFS.filter((s) => s.district === district);
  return stages.length > 0 && stages.every((s) => progress.stages[s.id]?.cleared);
}

export function carUnlocked(progress: Progress, design: CarDesign): boolean {
  return totalStars(progress) >= design.stars;
}

export function paletteUnlocked(progress: Progress, palette: Palette): boolean {
  return palette.district === 0 || districtCleared(progress, palette.district);
}

/** A stage is open when the one before it (in play order) has been cleared; the first is always open. */
export function stageUnlocked(progress: Progress, stageId: string): boolean {
  const index = STAGE_DEFS.findIndex((s) => s.id === stageId);
  if (index < 0) return false;
  if (index === 0) return true;
  const previous = STAGE_DEFS[index - 1];
  return previous !== undefined && progress.stages[previous.id]?.cleared === true;
}

/** The first stage that is open but not yet cleared, or the last stage when everything is cleared. */
export function nextToPlay(progress: Progress): string {
  const open = STAGE_DEFS.find((s) => stageUnlocked(progress, s.id) && !progress.stages[s.id]?.cleared);
  return (open ?? STAGE_DEFS[STAGE_DEFS.length - 1])?.id ?? '1-01';
}

/** Endless mode and the daily challenge open once all of Electric Alley is cleared. */
export function endlessUnlocked(progress: Progress): boolean {
  return districtCleared(progress, 1);
}
