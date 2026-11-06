import type { WorldEvent } from '../game/systems/world-types';
import type { HapticKind } from '../platform/haptics';
import type { SfxName } from '../services/audio/sfx';

export interface Feedback {
  sfx?: SfxName;
  /** Argument for the sound (combo level, etc.). */
  level?: number;
  haptic?: HapticKind;
  flash?: boolean;
  pulse?: boolean;
  /** Message for screen readers. */
  say?: string;
}

/** Feedback that does not depend on the event's details. */
const FIXED: Partial<Record<WorldEvent['type'], Feedback>> = {
  'near-miss': { sfx: 'near-miss', haptic: 'medium', pulse: true },
  'edge-kiss': { sfx: 'edge-kiss', haptic: 'light', pulse: true },
  'combo-drop': { sfx: 'combo-drop' },
  'combo-break': { sfx: 'combo-drop' },
  scrape: { sfx: 'scrape', haptic: 'medium' },
  crash: { sfx: 'crash', haptic: 'heavy', flash: true, say: 'Crashed' },
  'shield-pickup': { sfx: 'shield-pickup', haptic: 'light', say: 'Shield' },
  'shield-break': { sfx: 'shield-break', haptic: 'heavy', flash: true, say: 'Shield absorbed the hit' },
  'magnet-pickup': { sfx: 'magnet', haptic: 'light', say: 'Magnet' },
  'boost-ready': { sfx: 'boost-ready', haptic: 'light', say: 'Boost ready' },
  'boost-start': { sfx: 'boost-start', haptic: 'medium' },
  finish: { sfx: 'finish', haptic: 'success', say: 'Finish' },
};

/**
 * What the player should hear, feel and see for each world event. A table, not scattered conditionals, so the whole
 * feedback design can be read, tested and tuned in one place.
 */
export function feedbackFor(event: WorldEvent, comboLevel: number): Feedback | null {
  switch (event.type) {
    case 'spark':
      return { sfx: 'spark', level: comboLevel - 1 };
    case 'drift-end':
      return { sfx: 'drift-end', level: comboLevel, haptic: 'light' };
    case 'combo-up':
      return { sfx: 'combo-up', level: event.level, haptic: 'light', pulse: true };
    default:
      return FIXED[event.type] ?? null;
  }
}

/** How busy the music should be: calm in menus, driving in a run, full on at a high combo or boost. */
export function musicIntensity(comboLevel: number, boosting: boolean): number {
  if (boosting) return 1;
  if (comboLevel >= 5) return 0.85;
  return comboLevel >= 3 ? 0.7 : 0.55;
}
