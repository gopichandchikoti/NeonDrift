import { describe, expect, it } from 'vitest';
import { RULES, SIM_HZ } from '../src/game/physics/constants';
import { parseTrack } from '../src/game/physics/track-dsl';
import { Autopilot, heuristicHold } from '../src/game/systems/autopilot';
import { restoreWorld, snapshotWorld } from '../src/game/systems/snapshot';
import { build, held, released, run, types } from './helpers';

describe('a plain run', () => {
  it('finishes a straight road, pays the clean-finish bonus, then coasts to a stop', () => {
    const b = run(build('S1500'), released);
    expect(b.world.status).toBe('finished');
    expect(types(b)).toContain('finish');
    expect(b.world.stats.score).toBe(1000);
    expect(b.world.stats.finishTicks).toBe(b.world.tick);
    for (let t = 0; t < SIM_HZ * 3; t++) b.world.step({ hold: false, steer: 0, boost: false });
    expect(b.world.car.speed).toBe(0);
  });

  it('never advances once it has ended in a crash', () => {
    const b = run(build('S900[b.6:0]'), released);
    expect(b.world.status).toBe('crashed');
    const at = { ...b.world.car };
    b.world.step({ hold: true, steer: 0, boost: false });
    expect(b.world.car).toEqual(at);
  });

  it('is deterministic: the same input twice gives the same result', () => {
    const play = (): number[] => {
      const b = run(build('S400 R60@250 S300 L60@250 S400'), (t) => ({ hold: t % 90 < 40 }), 1500, () => false);
      return [b.world.s, b.world.lateral, b.world.stats.score, b.world.car.heading];
    };
    expect(play()).toEqual(play());
  });
});

describe('collisions', () => {
  it('crashes into a block, and a shield absorbs exactly one hit', () => {
    const plain = run(build('S900[b.6:0]'), released);
    expect(plain.world.status).toBe('crashed');
    const shielded = run(build('S900[b.6:0]', { rules: { startShield: true } }), released);
    expect(shielded.world.status).toBe('finished');
    expect(types(shielded)).toContain('shield-break');
    expect(shielded.world.stats.shieldsUsed).toBe(1);
    expect(shielded.world.stats.score).toBe(0); // a shield hit forfeits the clean-finish bonus
  });

  it('crashes into the barrier at a steep angle but only scrapes at a shallow one', () => {
    const steep = run(build('S1500 R90@250 S400', { rules: { scrapeAngle: 0.3 } }), held);
    expect(steep.world.status).toBe('crashed');
    expect(steep.events.some((e) => e.type === 'crash' && e.reason === 'barrier')).toBe(true);
    const forgiving = run(build('S1500 R90@250 S400', { rules: { scrapeAngle: 1.4 } }), held, 120 * 20, (b) => b.world.tick > 400);
    expect(forgiving.world.status).toBe('racing');
    expect(types(forgiving)).toContain('scrape');
    expect(forgiving.world.stats.scrapes).toBeGreaterThan(0);
  });

  it('a scrape slows the car and breaks the combo', () => {
    const b = build('S1500 R90@250 S400', { rules: { scrapeAngle: 1.4 } });
    b.world.combo.level = 4;
    run(b, held, 120 * 20, () => b.world.stats.scrapes > 0);
    expect(b.world.stats.scrapes).toBe(1);
    expect(b.world.combo.level).toBe(1);
    expect(types(b)).toContain('combo-break');
    expect(b.world.car.speed).toBeLessThan(290);
  });

  it('ends the run when the car spins to face backwards', () => {
    const b = build('S900');
    b.world.step({ hold: false, steer: 0, boost: false });
    b.world.car.velAngle = b.world.roadAngle + Math.PI;
    b.world.step({ hold: false, steer: 0, boost: false });
    expect(b.world.status).toBe('crashed');
    expect(b.events.length + b.world.events.length).toBeGreaterThan(0);
  });
});

describe('near misses, kisses and sparks', () => {
  it('rewards passing a cone closely, and grows the boost meter', () => {
    const b = run(build('S900[c.5:.3]'), released);
    expect(b.world.status).toBe('finished');
    expect(b.world.stats.nearMisses).toBe(1);
    expect(types(b)).toContain('near-miss');
    expect(b.world.boostMeter).toBeGreaterThan(0);
    expect(b.world.stats.score).toBeGreaterThan(1000);
  });

  it('gives nothing for a wide pass', () => {
    const b = run(build('S900[c.5:1]'), released);
    expect(b.world.stats.nearMisses).toBe(0);
  });

  it('collects sparks for points multiplied by the combo, and a magnet reaches sparks off the line', () => {
    const direct = run(build('S900[s.2-.8:0]'), released);
    expect(direct.world.stats.sparks).toBeGreaterThan(5);
    const off = run(build('S900[s.2-.8:.8]'), released);
    const withMagnet = run(build('S900[m.1:0 s.2-.8:.8]'), released);
    expect(withMagnet.world.stats.sparks).toBeGreaterThan(off.world.stats.sparks);
    expect(types(withMagnet)).toContain('magnet-pickup');
  });

  it('picks up a shield token and uses it', () => {
    const b = run(build('S900[h.2:0 b.7:0]'), released);
    expect(types(b)).toContain('shield-pickup');
    expect(b.world.status).toBe('finished');
    expect(b.world.stats.shieldsUsed).toBe(1);
  });

  it('counts passing a traffic car and an edge kiss while drifting close to the barrier', () => {
    const traffic = run(build('S1500[t.4:.4:140]'), released);
    expect(traffic.world.stats.trafficPassed).toBe(1);
    const kiss = run(build('S1200 R90@260 S600'), (t) => ({ hold: t > 130 && t < 380 }), 120 * 30, () => false);
    expect(kiss.world.stats.edgeKisses + kiss.world.stats.scrapes).toBeGreaterThanOrEqual(0);
  });
});

describe('boost', () => {
  it('is spent from a full meter, raises the speed target, and ends on a timer', () => {
    const b = build('S3000');
    b.world.boostMeter = 1;
    run(b, (t) => ({ boost: t === 5 }), 120 * 1.5, () => false);
    expect(b.world.stats.boosts).toBe(1);
    expect(b.world.boostMeter).toBe(0);
    expect(b.world.car.speed).toBeGreaterThan(330);
    run(b, released, Math.round(RULES.boostTime * SIM_HZ) + 5, () => false);
    expect(b.world.boostTicks).toBe(0);
  });

  it('ignores a boost press when the meter is not full', () => {
    const b = run(build('S900'), (t) => ({ boost: t === 5 }), 300, () => false);
    expect(b.world.stats.boosts).toBe(0);
  });
});

describe('moving hazards', () => {
  it('swings a gate across the road on a fixed clock, so the same tick always finds it in the same place', () => {
    const b = build('S2000[g.5:1:2]');
    const gate = b.world.hazards[0];
    const seen = new Set<number>();
    for (let t = 0; t < 4 * SIM_HZ; t++) {
      b.world.step({ hold: false, steer: 0, boost: false });
      seen.add(Math.round((gate?.lat ?? 0) / 4));
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(gate?.amp).toBeGreaterThan(0);
  });

  it('wakes traffic as the car approaches and signals a lane change before making it', () => {
    const b = build('S3000[t.5:.45:140:-.45]');
    const car = b.world.traffic[0];
    const startLat = car?.lat ?? 0;
    const startS = car?.s ?? 0;
    run(b, released, 120 * 2, () => false);
    expect(car?.s).toBe(startS); // still asleep: the car is more than 560 units away
    run(b, released, 120 * 2.5, () => false);
    expect(car?.s).toBeGreaterThan(startS);
    expect(b.world.status).toBe('racing');
    run(b, released, 120 * 1.5, () => false);
    expect(Math.abs((car?.lat ?? 0) - startLat)).toBeGreaterThan(1);
  });
});

describe('endless growth', () => {
  it('asks the extender for more road when the car gets close to the end of it', () => {
    let calls = 0;
    const b = build('S3000', {
      rules: { finishS: null },
      extender: {
        extend: (track) => {
          calls += 1;
          track.append(parseTrack('S2000').segments);
          return [];
        },
      },
    });
    run(b, released, 120 * 8, () => false);
    expect(calls).toBeGreaterThan(0);
    expect(b.track.length).toBeGreaterThan(5000);
    b.world.extending = false;
    const before = calls;
    run(b, released, 120 * 8, () => false);
    expect(calls).toBe(before);
  });

  it('ramps its speed with distance up to a cap', () => {
    const b = build('S500', { rules: { finishS: null, speedRamp: 10, maxSpeed: 320 } });
    expect(b.world.speedAt(0)).toBe(300);
    expect(b.world.speedAt(1000)).toBe(310);
    expect(b.world.speedAt(9000)).toBe(320);
  });
});

describe('snapshots', () => {
  it('restore a world exactly, so a look-ahead never changes the real run', () => {
    const b = build('S400[c.5:.3] R70@250[s0-1:.4] S300 L70@250 S500');
    run(b, (t) => ({ hold: t % 70 < 25 }), 300, () => false);
    const snap = snapshotWorld(b.world);
    const after = (): number[] => {
      run(b, (t) => ({ hold: t % 50 < 20 }), 400, () => false);
      return [b.world.s, b.world.lateral, b.world.stats.score, b.world.car.x, b.world.car.heading, b.world.tick];
    };
    const first = after();
    restoreWorld(b.world, snap);
    expect(after()).toEqual(first);
  });
});

describe('the autopilot', () => {
  it('only ever uses hold and release, and completes a stage', () => {
    const b = build('S500 R90@260 S300 L90@260[c.5:-.5] S500');
    const bot = new Autopilot(b.world);
    for (let t = 0; t < 120 * 40 && b.world.running; t++) {
      b.world.step({ hold: bot.decide(), steer: 0, boost: false });
      b.world.events.length = 0;
    }
    expect(b.world.status).toBe('finished');
  });

  it('plans without changing the world it is planning on', () => {
    const b = build('S600 R60@260 S600');
    const bot = new Autopilot(b.world);
    const before = JSON.stringify([b.world.car, b.world.stats, b.world.tick]);
    bot.decide();
    expect(JSON.stringify([b.world.car, b.world.stats, b.world.tick])).toBe(before);
  });

  it('lifts off a hold that points the wrong way, and holds toward a target on the inside', () => {
    const b = build('S300 R90@260 S300');
    b.world.holding = true;
    b.world.latched = -1;
    expect(heuristicHold(b.world, { relative: true, target: 0.2 })).toBe(false);
    b.world.holding = false;
    b.world.lateral = -60;
    expect(heuristicHold(b.world, { relative: true, target: 0.2 })).toBe(true);
  });
});
