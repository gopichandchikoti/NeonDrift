import { RULES, SIM_HZ } from '../physics/constants';
import { clamp } from '../physics/math';

export interface DriftState {
  active: boolean;
  /** Points banked by the current drift (before the multiplier). Lost on a collision. */
  bank: number;
  ticks: number;
  lowTicks: number;
  /** The current drift already earned its one edge kiss. */
  kissed: boolean;
}

export function createDrift(): DriftState {
  return { active: false, bank: 0, ticks: 0, lowTicks: 0, kissed: false };
}

/** Points per unit of forward progress at this slip angle: wider angles pay more, up to driftFullSlip. */
export function driftRate(slip: number): number {
  const t = clamp((slip - RULES.driftMinSlip) / (RULES.driftFullSlip - RULES.driftMinSlip), 0, 1);
  return 0.6 + 1.6 * t;
}

export type DriftUpdate = { kind: 'none' } | { kind: 'start' } | { kind: 'end'; bank: number; ticks: number; scored: boolean };

/**
 * Feeds one step of slip and forward progress into the drift tracker. Points accrue per unit of *progress* along the
 * road (never per second), so a car that stops making progress earns nothing: there is no stationary farming.
 */
export function updateDrift(drift: DriftState, slip: number, progress: number, fastEnough: boolean): DriftUpdate {
  const drifting = fastEnough && Math.abs(slip) > RULES.driftMinSlip;
  if (drifting) {
    const started = !drift.active;
    drift.active = true;
    drift.lowTicks = 0;
    drift.ticks += 1;
    drift.bank = Math.min(RULES.driftBankCap, drift.bank + Math.max(0, progress) * driftRate(Math.abs(slip)));
    return started ? { kind: 'start' } : { kind: 'none' };
  }
  if (!drift.active) return { kind: 'none' };
  drift.lowTicks += 1;
  if (drift.lowTicks < RULES.driftEndGrace * SIM_HZ) return { kind: 'none' };
  return endDrift(drift);
}

export function endDrift(drift: DriftState): DriftUpdate {
  const result = {
    kind: 'end' as const,
    bank: Math.round(drift.bank),
    ticks: drift.ticks,
    scored: drift.ticks >= RULES.driftMinTime * SIM_HZ,
  };
  resetDrift(drift);
  return result;
}

/** Throws the current drift away (after a collision). */
export function resetDrift(drift: DriftState): void {
  drift.active = false;
  drift.bank = 0;
  drift.ticks = 0;
  drift.lowTicks = 0;
  drift.kissed = false;
}
