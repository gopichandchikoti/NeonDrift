import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioKit } from '../src/services/audio';
import { AudioEngine, defaultContextFactory } from '../src/services/audio/engine';
import { DriveSound } from '../src/services/audio/drive-sound';
import { Music } from '../src/services/audio/music';
import { Sfx, type SfxName } from '../src/services/audio/sfx';
import { midi, noise, tone } from '../src/services/audio/synth';
import { DEFAULT_SETTINGS } from '../src/services/settings';
import { asContext, FakeContext } from './fake-audio';

afterEach(() => vi.useRealTimers());

function engineWith(ctx: FakeContext): AudioEngine {
  const engine = new AudioEngine(() => asContext(ctx));
  engine.unlock();
  ctx.state = 'running';
  return engine;
}

describe('the audio engine', () => {
  it('stays silent until a gesture unlocks it, then builds one context and resumes it', () => {
    const ctx = new FakeContext();
    const engine = new AudioEngine(() => asContext(ctx));
    expect(engine.context).toBeNull();
    engine.resume();
    engine.suspend();
    engine.unlock();
    expect(engine.context).not.toBeNull();
    expect(ctx.resumed).toBe(1);
    engine.unlock();
    expect(ctx.nodes.length).toBe(3); // master, sfx, music: never rebuilt
    ctx.state = 'running';
    engine.suspend();
    expect(ctx.suspended).toBe(1);
  });

  it('applies the volumes and the mute switch to the right buses', () => {
    const ctx = new FakeContext();
    const engine = engineWith(ctx);
    engine.setLevels({ musicVolume: 0.5, sfxVolume: 0.25, muted: false });
    const [master, sfx, music] = ctx.nodes;
    expect(master?.gain.value).toBe(1);
    expect(sfx?.gain.value).toBe(0.25);
    expect(music?.gain.value).toBeCloseTo(0.275);
    engine.setLevels({ musicVolume: 0.5, sfxVolume: 0.25, muted: true });
    expect(master?.gain.value).toBe(0);
  });

  it('copes with a browser that has no Web Audio at all', () => {
    const none = new AudioEngine(() => null);
    none.unlock();
    none.setLevels({ musicVolume: 1, sfxVolume: 1, muted: false });
    expect(none.context).toBeNull();
    expect(defaultContextFactory()).toBeNull(); // jsdom/node have none
  });

  it('gives the kit one place to apply settings and unlock', () => {
    const ctx = new FakeContext();
    const kit = new AudioKit(() => asContext(ctx));
    kit.apply({ ...DEFAULT_SETTINGS, muted: true });
    kit.unlock();
    kit.suspend();
    kit.resume();
    expect(ctx.nodes[0]?.gain.value).toBe(0);
  });
});

describe('synthesis helpers', () => {
  it('make tones and noise that clean themselves up', () => {
    const ctx = new FakeContext();
    const out = new FakeContext().destination;
    tone(asContext(ctx), out as never, { type: 'sine', freq: 440, freqEnd: 220, duration: 0.1, gain: 0.2 });
    noise(asContext(ctx), out as never, { filter: 'lowpass', freq: 1000, freqEnd: 100, duration: 0.2, gain: 0.3 });
    noise(asContext(ctx), out as never, { filter: 'highpass', freq: 1000, duration: 0.2, gain: 0.3, delay: 0.1 });
    expect(ctx.nodes.filter((n) => n.started)).toHaveLength(3);
    expect(midi(69)).toBeCloseTo(440);
    expect(midi(81)).toBeCloseTo(880);
  });
});

describe('sound effects', () => {
  const names: SfxName[] = [
    'tap', 'confirm', 'back', 'spark', 'near-miss', 'edge-kiss', 'drift-end', 'combo-up', 'combo-drop', 'scrape',
    'crash', 'shield-pickup', 'shield-break', 'magnet', 'boost-ready', 'boost-start', 'finish', 'star', 'achievement', 'beep',
  ];

  it('play every named effect without error', () => {
    const ctx = new FakeContext();
    const sfx = new Sfx(engineWith(ctx));
    for (const name of names) {
      const before = ctx.nodes.length;
      sfx.play(name, 2);
      expect(ctx.nodes.length, name).toBeGreaterThan(before);
    }
    const before = ctx.nodes.length;
    sfx.play('beep', 1);
    sfx.play('spark', 99);
    expect(ctx.nodes.length).toBeGreaterThan(before);
  });

  it('make no sound before audio is unlocked or while it is suspended', () => {
    const ctx = new FakeContext();
    const idle = new AudioEngine(() => asContext(ctx));
    new Sfx(idle).play('crash');
    expect(ctx.nodes).toHaveLength(0);
    const suspended = new AudioEngine(() => asContext(ctx));
    suspended.unlock();
    ctx.state = 'suspended';
    const before = ctx.nodes.length;
    new Sfx(suspended).play('crash');
    expect(ctx.nodes.length).toBe(before);
  });
});

describe('engine and tire sound', () => {
  it('builds once, follows speed and slip, goes quiet when not racing, and tears down', () => {
    const ctx = new FakeContext();
    const drive = new DriveSound(engineWith(ctx));
    drive.update(300, 0.5, false, true); // not started: ignored
    drive.start();
    drive.start();
    const built = ctx.nodes.length;
    drive.update(300, 0.5, true, true);
    const mine = ctx.nodes.slice(3); // after the master, effects and music buses
    const driven = mine.filter((n) => n.gain.calls.includes('target'));
    expect(driven.some((n) => n.gain.value > 0.1)).toBe(true); // the tire hiss at a wide slip
    drive.update(0, 0, false, false);
    expect(driven.every((n) => n.gain.value === 0)).toBe(true);
    drive.stop();
    drive.stop();
    expect(ctx.nodes.length).toBe(built);
    expect(ctx.nodes.filter((n) => n.stopped).length).toBe(3);
  });

  it('does nothing without an audio context', () => {
    const drive = new DriveSound(new AudioEngine(() => null));
    drive.start();
    drive.update(1, 1, true, true);
    drive.stop();
  });
});

describe('music', () => {
  it('schedules notes ahead of the clock only while running, and stops cleanly', () => {
    vi.useFakeTimers();
    const ctx = new FakeContext();
    const music = new Music(engineWith(ctx));
    music.start(3);
    expect(music.playing).toBe(true);
    const before = ctx.nodes.length;
    ctx.currentTime = 0.5;
    vi.advanceTimersByTime(60);
    expect(ctx.nodes.length).toBeGreaterThan(before);
    ctx.state = 'suspended';
    const during = ctx.nodes.length;
    ctx.currentTime = 5;
    vi.advanceTimersByTime(60);
    expect(ctx.nodes.length).toBe(during);
    music.setIntensity(1);
    ctx.state = 'running';
    vi.advanceTimersByTime(60);
    music.start(99);
    music.stop();
    expect(music.playing).toBe(false);
    music.stop();
  });

  it('does nothing without audio', () => {
    const music = new Music(new AudioEngine(() => null));
    music.start(1);
    expect(music.playing).toBe(false);
  });
});
