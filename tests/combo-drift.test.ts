import { describe, expect, it } from 'vitest';
import { RULES, SIM_HZ } from '../src/game/physics/constants';
import { addManeuver, breakCombo, comboHeat, createCombo, tickCombo } from '../src/game/systems/combo';
import { createDrift, driftRate, endDrift, resetDrift, updateDrift } from '../src/game/systems/drift';

describe('combo multiplier', () => {
  it('needs three clean moves per step and stops at the maximum', () => {
    const c = createCombo();
    expect(addManeuver(c)).toBe(false);
    expect(addManeuver(c)).toBe(false);
    expect(addManeuver(c)).toBe(true);
    expect(c.level).toBe(2);
    for (let i = 0; i < 200; i++) addManeuver(c);
    expect(c.level).toBe(RULES.comboMax);
    expect(c.peak).toBe(RULES.comboMax);
    expect(addManeuver(c)).toBe(false);
  });

  it('breaks completely on a collision, and only reports a loss when there was something to lose', () => {
    const c = createCombo();
    expect(breakCombo(c)).toBe(false);
    for (let i = 0; i < 4; i++) addManeuver(c);
    expect(breakCombo(c)).toBe(true);
    expect(c).toMatchObject({ level: 1, pips: 0, idle: 0 });
    expect(c.peak).toBe(2);
  });

  it('decays when the player goes quiet: first the pips, then a level', () => {
    const c = createCombo();
    for (let i = 0; i < 4; i++) addManeuver(c); // level 2, one pip
    const idle = RULES.comboDecay * SIM_HZ;
    let result = 'none';
    for (let t = 0; t < idle; t++) result = tickCombo(c);
    expect(result).toBe('pips');
    expect(c.pips).toBe(0);
    for (let t = 0; t < idle; t++) result = tickCombo(c);
    expect(result).toBe('level');
    expect(c.level).toBe(1);
  });

  it('does not tick while at the base level, and reports heat for the HUD', () => {
    const c = createCombo();
    expect(tickCombo(c)).toBe('none');
    expect(comboHeat(c)).toBe(0);
    addManeuver(c);
    expect(comboHeat(c)).toBe(1);
    for (let t = 0; t < (RULES.comboDecay * SIM_HZ) / 2; t++) tickCombo(c);
    expect(comboHeat(c)).toBeCloseTo(0.5, 1);
  });
});

describe('drift scoring', () => {
  it('pays more for a wider slide, within bounds', () => {
    expect(driftRate(0.1)).toBeCloseTo(0.6);
    expect(driftRate(RULES.driftFullSlip)).toBeCloseTo(2.2);
    expect(driftRate(1.5)).toBeCloseTo(2.2);
    expect(driftRate(0.45)).toBeGreaterThan(driftRate(0.25));
  });

  it('banks points for progress while sliding and pays them out when the slide ends', () => {
    const d = createDrift();
    expect(updateDrift(d, 0.5, 1, true).kind).toBe('start');
    for (let t = 0; t < SIM_HZ; t++) updateDrift(d, 0.5, 2, true);
    expect(d.bank).toBeGreaterThan(100);
    let end = updateDrift(d, 0, 2, true);
    for (let t = 0; t < RULES.driftEndGrace * SIM_HZ + 2 && end.kind !== 'end'; t++) end = updateDrift(d, 0, 2, true);
    expect(end.kind).toBe('end');
    if (end.kind === 'end') {
      expect(end.scored).toBe(true);
      expect(end.bank).toBeGreaterThan(100);
    }
    expect(d.active).toBe(false);
  });

  it('cannot be farmed: no progress means no points, and a slow car does not drift at all', () => {
    const d = createDrift();
    for (let t = 0; t < 10 * SIM_HZ; t++) updateDrift(d, 0.7, 0, true);
    expect(d.bank).toBe(0);
    const slow = createDrift();
    for (let t = 0; t < 100; t++) expect(updateDrift(slow, 0.7, 5, false).kind).toBe('none');
  });

  it('caps what one drift can bank', () => {
    const d = createDrift();
    for (let t = 0; t < 30 * SIM_HZ; t++) updateDrift(d, 0.8, 50, true);
    expect(d.bank).toBe(RULES.driftBankCap);
  });

  it('does not score a slide that is too short, and can be thrown away', () => {
    const d = createDrift();
    updateDrift(d, 0.5, 3, true);
    const result = endDrift(d);
    expect(result.kind === 'end' && result.scored).toBe(false);
    updateDrift(d, 0.5, 3, true);
    resetDrift(d);
    expect(d).toMatchObject({ active: false, bank: 0, ticks: 0, lowTicks: 0, kissed: false });
  });
});
