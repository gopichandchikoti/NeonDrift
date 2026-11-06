import { describe, expect, it } from 'vitest';
import { stageById } from '../src/game/levels/catalog';
import { createStageWorld, decodeInput } from '../src/game/levels/runner';
import { Session } from '../src/game/session';
import { build } from './helpers';

const stage = (id: string) => {
  const s = stageById(id);
  if (!s) throw new Error(id);
  return s;
};

function session(track = 'S4000', extra: Partial<ConstructorParameters<typeof Session>[0]> = {}): Session {
  return new Session({ world: build(track).world, mode: 'endless', ...extra });
}

describe('the fixed-step loop', () => {
  it('simulates the same amount whatever the display refresh rate', () => {
    const slow = session();
    const fast = session();
    for (let i = 0; i < 60; i++) slow.advance(1000 / 60);
    for (let i = 0; i < 144; i++) fast.advance(1000 / 144);
    for (const s of [slow, fast]) expect(Math.abs(s.world.tick - 120)).toBeLessThanOrEqual(2);
    // Same number of steps means exactly the same state: the frame rate never leaks into the physics.
    while (slow.world.tick < fast.world.tick) slow.world.step({ hold: false, steer: 0, boost: false });
    while (fast.world.tick < slow.world.tick) fast.world.step({ hold: false, steer: 0, boost: false });
    expect(fast.world.car.x).toBeCloseTo(slow.world.car.x, 6);
    expect(fast.world.car.y).toBeCloseTo(slow.world.car.y, 6);
  });

  it('keeps a fraction of a step for interpolation and never spirals after a long stall', () => {
    const s = session();
    s.advance(10);
    expect(s.alpha).toBeGreaterThan(0);
    expect(s.alpha).toBeLessThan(1);
    s.advance(60000);
    expect(s.world.tick).toBeLessThanOrEqual(8 + 13);
  });

  it('does nothing while paused, and drops held input so the car does not lurch on resume', () => {
    const s = session();
    s.setSource('pointer', true);
    s.advance(100);
    const tick = s.world.tick;
    s.paused = true;
    s.clearInput();
    s.advance(500);
    expect(s.world.tick).toBe(tick);
    expect(s.holding).toBe(false);
    s.paused = false;
    s.advance(100);
    expect(s.world.tick).toBeGreaterThan(tick);
  });
});

describe('input sources', () => {
  it('treat a finger and a key the same, and release only when every one is up', () => {
    const s = session('S900 R90@250 S2000');
    s.setSource('pointer', true);
    s.setSource('key', true);
    s.setSource('pointer', false);
    expect(s.holding).toBe(true);
    s.setSource('key', false);
    expect(s.holding).toBe(false);
  });

  it('steer explicitly with the buttons and keys, and boost once per press', () => {
    const s = session('S3000');
    s.world.boostMeter = 1;
    s.setSource('left-button', true);
    s.queueBoost();
    s.advance(300);
    expect(s.world.car.heading).toBeLessThan(-Math.PI / 2);
    expect(s.world.stats.boosts).toBe(1);
    s.queueBoost();
    s.advance(50);
    expect(s.world.stats.boosts).toBe(1);
    s.setSource('left-button', false);
    s.setSource('key-right', true);
    s.advance(100);
    expect(s.world.holding).toBe(false);
  });

  it('can be driven entirely by a recorded script (the menu demo)', () => {
    const def = stage('1-02');
    const s = new Session({ world: createStageWorld(def), mode: 'stage', stage: def });
    s.script = decodeInput(def.calibration?.input ?? []);
    for (let i = 0; i < 60 * 60 && !s.result; i++) s.advance(1000 / 60);
    expect(s.world.status).toBe('finished');
    expect(s.result).not.toBeNull();
    // The player's own input is ignored while a script is playing.
    const other = new Session({ world: createStageWorld(def), mode: 'stage', stage: def });
    other.script = [false];
    other.setSource('pointer', true);
    other.advance(200);
    expect(other.world.holding).toBe(false);
  });
});

describe('finishing a run', () => {
  it('reports a crash after a short beat, with the verdict for the stage', () => {
    const def = stage('1-01');
    const s = new Session({ world: createStageWorld(def), mode: 'stage', stage: def });
    s.setSource('pointer', true);
    let frames = 0;
    while (s.world.running && frames++ < 6000) s.advance(1000 / 60);
    expect(s.world.status).toBe('crashed');
    expect(s.result).toBeNull();
    s.advance(300);
    expect(s.result).toBeNull();
    s.advance(700);
    expect(s.result).toMatchObject({ outcome: 'crashed', mode: 'stage' });
    expect(s.result?.verdict.stars).toBe(0);
    const again = s.result;
    s.advance(500);
    expect(s.result).toBe(again);
  });

  it('gives a free-play run no stars to judge, and keeps the time in seconds', () => {
    const s = session('S900[b.6:0]');
    while (s.world.running) s.advance(1000 / 60);
    s.advance(2000);
    expect(s.result?.verdict).toMatchObject({ finished: false, stars: 0 });
    expect(s.result?.seconds).toBeCloseTo(s.world.tick / 120);
  });
});

describe('coaching hints', () => {
  it('appear as the car passes them and fade once it is well beyond', () => {
    const s = session('S4000', { cues: [{ s: 300, text: 'first' }, { s: 1200, text: 'second' }] });
    expect(s.cue).toBeNull();
    while (s.world.s < 320) s.advance(1000 / 60);
    expect(s.cue?.text).toBe('first');
    while (s.world.s < 1250) s.advance(1000 / 60);
    expect(s.cue?.text).toBe('second');
    while (s.world.s < 1800) s.advance(1000 / 60);
    expect(s.cue).toBeNull();
  });

  it('report how long ago the run ended', () => {
    const s = session('S900[b.6:0]');
    while (s.world.running) s.advance(1000 / 60);
    s.advance(250);
    expect(s.sinceEnd).toBeGreaterThanOrEqual(250);
  });
});
