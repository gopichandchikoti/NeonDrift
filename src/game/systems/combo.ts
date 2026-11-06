import { RULES, SIM_HZ } from '../physics/constants';

export interface ComboState {
  /** The score multiplier, 1 to RULES.comboMax. */
  level: number;
  /** Clean maneuvers collected toward the next level (0 to RULES.comboPips - 1). */
  pips: number;
  /** Ticks since the last clean maneuver; at RULES.comboDecay seconds the combo loses a step. */
  idle: number;
  peak: number;
}

export function createCombo(): ComboState {
  return { level: 1, pips: 0, idle: 0, peak: 1 };
}

/** A clean drift, near miss or edge kiss. Returns true when the multiplier went up. */
export function addManeuver(combo: ComboState): boolean {
  combo.idle = 0;
  if (combo.level >= RULES.comboMax) {
    combo.pips = RULES.comboPips - 1;
    return false;
  }
  combo.pips += 1;
  if (combo.pips < RULES.comboPips) return false;
  combo.pips = 0;
  combo.level += 1;
  combo.peak = Math.max(combo.peak, combo.level);
  return true;
}

/** Idle decay: after comboDecay seconds without a maneuver, first the pips empty, then the level drops by one. */
export function tickCombo(combo: ComboState): 'none' | 'pips' | 'level' {
  if (combo.level === 1 && combo.pips === 0) {
    combo.idle = 0;
    return 'none';
  }
  combo.idle += 1;
  if (combo.idle < RULES.comboDecay * SIM_HZ) return 'none';
  combo.idle = 0;
  if (combo.pips > 0) {
    combo.pips = 0;
    return 'pips';
  }
  combo.level -= 1;
  return 'level';
}

/** A collision breaks the combo completely. Returns true if there was anything to lose. */
export function breakCombo(combo: ComboState): boolean {
  const had = combo.level > 1 || combo.pips > 0;
  combo.level = 1;
  combo.pips = 0;
  combo.idle = 0;
  return had;
}

/** 0..1 of the decay timer used, for the HUD ring. */
export function comboHeat(combo: ComboState): number {
  if (combo.level === 1 && combo.pips === 0) return 0;
  return 1 - combo.idle / (RULES.comboDecay * SIM_HZ);
}
