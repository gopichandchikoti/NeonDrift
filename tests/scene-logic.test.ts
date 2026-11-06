import { describe, expect, it, vi } from 'vitest';
import { PALETTES } from '../src/game/cosmetics';
import { ChaseCamera, VIEW, VIEW_LIMITS, anchor, viewHeightFor } from '../src/game/scenes/camera';
import { Particles, Trails } from '../src/game/scenes/draw/effects';
import { applyEvent, type EffectTargets } from '../src/game/scenes/event-effects';
import { QualityMonitor, styleFor } from '../src/game/scenes/quality';
import type { WorldEvent } from '../src/game/systems/world-types';
import { feedbackFor, musicIntensity } from '../src/app/run-effects';

describe('camera', () => {
  it('fits the play field to the screen within limits', () => {
    expect(viewHeightFor(390, 844)).toBe(1169);
    expect(viewHeightFor(1920, 1080)).toBe(VIEW_LIMITS.minHeight);
    expect(viewHeightFor(300, 2000)).toBe(VIEW_LIMITS.maxHeight);
    expect(anchor().x).toBe(VIEW.width / 2);
    expect(anchor().y).toBeGreaterThan(VIEW.height / 2);
  });

  it('turns smoothly toward the road ahead and puts the car at the anchor', () => {
    const cam = new ChaseCamera();
    cam.reset(-Math.PI / 2);
    for (let i = 0; i < 300; i++) cam.update(1 / 60, 0, false, false);
    expect(cam.angle).toBeCloseTo(0, 1);
    const t = cam.transform(100, 50);
    // The car at world (100, 50) must land on the anchor whatever the rotation.
    const sx = t.x + t.scale * (Math.cos(t.rotation) * 100 - Math.sin(t.rotation) * 50);
    const sy = t.y + t.scale * (Math.sin(t.rotation) * 100 + Math.cos(t.rotation) * 50);
    expect(sx).toBeCloseTo(anchor().x);
    expect(sy).toBeCloseTo(anchor().y);
  });

  it('zooms out on boost unless motion is reduced, and shake decays and is capped', () => {
    const cam = new ChaseCamera();
    cam.reset(0);
    const base = cam.zoom;
    for (let i = 0; i < 120; i++) cam.update(1 / 60, 0, true, false);
    expect(cam.zoom).toBeLessThan(base);
    const calm = new ChaseCamera();
    calm.reset(0);
    for (let i = 0; i < 120; i++) calm.update(1 / 60, 0, true, true);
    expect(calm.zoom).toBeCloseTo(base, 1);
    cam.addShake(100);
    expect(cam.shake).toBe(14);
    cam.update(1, 0, false, false);
    expect(cam.shake).toBeLessThan(14);
  });
});

describe('quality', () => {
  it('has three levels, from full bloom down to a minimal one', () => {
    expect(styleFor('high').bloom).toBe(true);
    expect(styleFor('medium').bloom).toBe(false);
    expect(styleFor('low').walls).toBe(false);
    expect(styleFor('low').particles).toBeLessThan(styleFor('high').particles);
  });

  it('steps down when frames are slow, never up, and ignores long stalls', () => {
    const monitor = new QualityMonitor();
    for (let i = 0; i < 400; i++) monitor.sample(40);
    expect(monitor.level).toBe('low');
    for (let i = 0; i < 400; i++) monitor.sample(8);
    expect(monitor.level).toBe('low');
    const calm = new QualityMonitor();
    for (let i = 0; i < 300; i++) calm.sample(500);
    for (let i = 0; i < 400; i++) calm.sample(8);
    expect(calm.level).toBe('high');
    calm.resetWindow();
    expect(calm.level).toBe('high');
  });
});

function fakeGraphics(): { calls: string[]; g: Record<string, (...a: number[]) => unknown> } {
  const calls: string[] = [];
  const g = new Proxy({} as Record<string, (...a: number[]) => unknown>, {
    get: (_t, name: string) => (...args: number[]) => {
      calls.push(`${name}:${args.length}`);
      return undefined;
    },
  });
  return { calls, g };
}

describe('particles and trails', () => {
  it('emit, move, age and expire particles, scaled by density', () => {
    const p = new Particles();
    p.burst(0, 0, { count: 10, color: 0xffffff, speed: 100 });
    const { g, calls } = fakeGraphics();
    p.draw(g as never);
    expect(calls.filter((c) => c.startsWith('fillCircle')).length).toBe(10);
    p.update(0.1);
    calls.length = 0;
    p.draw(g as never);
    expect(calls.filter((c) => c.startsWith('fillCircle')).length).toBe(10);
    for (let i = 0; i < 30; i++) p.update(0.1);
    calls.length = 0;
    p.draw(g as never);
    expect(calls.filter((c) => c.startsWith('fillCircle')).length).toBe(0);
    p.density = 0.4;
    p.burst(0, 0, { count: 10, color: 1, speed: 1, angle: 1, spread: 1 });
    calls.length = 0;
    p.draw(g as never);
    expect(calls.filter((c) => c.startsWith('fillCircle')).length).toBe(4);
    p.clear();
    calls.length = 0;
    p.draw(g as never);
    expect(calls).toHaveLength(0);
  });

  it('wraps around instead of growing without limit', () => {
    const p = new Particles();
    for (let i = 0; i < 1000; i++) p.emit({ x: 0, y: 0, vx: 0, vy: 0, life: 1, color: 1, size: 1 });
    const { g, calls } = fakeGraphics();
    p.draw(g as never);
    expect(calls.filter((c) => c.startsWith('fillCircle')).length).toBe(260);
  });

  it('draw a fading mark only while sliding, and break it when the slide stops', () => {
    const t = new Trails();
    const wheels: Array<[number, number]> = [[0, 0], [5, 0]];
    t.add(wheels, true, 0);
    t.add([[1, 1], [6, 1]], true, 0.1);
    t.add([[2, 2], [7, 2]], false, 0.2);
    t.add([[3, 3], [8, 3]], true, 0.3);
    const { g, calls } = fakeGraphics();
    t.draw(g as never, 0xffffff, 0.35);
    expect(calls.filter((c) => c.startsWith('lineBetween')).length).toBe(2); // one segment per wheel, none across the gap
    calls.length = 0;
    t.draw(g as never, 0xffffff, 99);
    expect(calls.filter((c) => c.startsWith('lineBetween')).length).toBe(0);
    t.clear();
  });
});

describe('effects and feedback for world events', () => {
  const targets = (): EffectTargets & { popups: string[]; bursts: number } => {
    const state = { popups: [] as string[], bursts: 0 };
    const particles = new Particles();
    const burst = particles.burst.bind(particles);
    vi.spyOn(particles, 'burst').mockImplementation((...a) => {
      state.bursts += 1;
      burst(...a);
    });
    return Object.assign(state, {
      particles,
      cam: new ChaseCamera(),
      reduced: false,
      popup: (text: string) => state.popups.push(text),
      roadAngle: 0,
      palette: PALETTES[0] as (typeof PALETTES)[number],
    });
  };
  const at = { x: 1, y: 2 };

  it('turns scoring events into floating labels and sparks', () => {
    const t = targets();
    applyEvent({ type: 'near-miss', points: 150, hazard: 'cone', ...at }, t);
    applyEvent({ type: 'edge-kiss', points: 70, ...at }, t);
    applyEvent({ type: 'drift-end', points: 400, seconds: 1, ...at }, t);
    applyEvent({ type: 'traffic-pass', points: 60, ...at }, t);
    applyEvent({ type: 'spark', points: 25, ...at }, t);
    expect(t.popups).toEqual(['NEAR MISS +150', 'EDGE KISS +70', 'DRIFT +400', 'PASS +60', '25']);
    expect(t.bursts).toBeGreaterThan(1);
  });

  it('shakes the camera on impacts, but not when motion is reduced', () => {
    const t = targets();
    applyEvent({ type: 'crash', reason: 'hazard', ...at }, t);
    expect(t.cam.shake).toBe(12);
    const calm = { ...targets(), reduced: true };
    applyEvent({ type: 'crash', reason: 'hazard', ...at }, calm);
    applyEvent({ type: 'scrape', side: 1, ...at }, calm);
    applyEvent({ type: 'shield-break', ...at }, calm);
    expect(calm.cam.shake).toBe(0);
    const t2 = targets();
    applyEvent({ type: 'scrape', side: 1, ...at }, t2);
    applyEvent({ type: 'shield-break', ...at }, t2);
    expect(t2.cam.shake).toBeGreaterThan(0);
  });

  it('ignores events that have no place on the road', () => {
    const t = targets();
    applyEvent({ type: 'combo-up', level: 2 }, t);
    applyEvent({ type: 'finish', clean: true }, t);
    expect(t.bursts).toBe(0);
  });

  it('gives each kind of event its own sound, touch and sight', () => {
    const e = (event: WorldEvent): ReturnType<typeof feedbackFor> => feedbackFor(event, 3);
    expect(e({ type: 'crash', reason: 'barrier', ...at })).toMatchObject({ sfx: 'crash', haptic: 'heavy', flash: true });
    expect(e({ type: 'spark', points: 1, ...at })).toMatchObject({ sfx: 'spark', level: 2 });
    expect(e({ type: 'combo-up', level: 4 })).toMatchObject({ sfx: 'combo-up', level: 4, pulse: true });
    expect(e({ type: 'drift-end', points: 1, seconds: 1, ...at })).toMatchObject({ sfx: 'drift-end', level: 3 });
    expect(e({ type: 'finish', clean: true })).toMatchObject({ sfx: 'finish', haptic: 'success' });
    expect(e({ type: 'combo-break' })).toMatchObject({ sfx: 'combo-drop' });
    expect(e({ type: 'drift-start', ...at })).toBeNull();
    expect(e({ type: 'traffic-pass', points: 1, ...at })).toBeNull();
  });

  it('turns the music up with the combo and the boost', () => {
    expect(musicIntensity(1, false)).toBeLessThan(musicIntensity(3, false));
    expect(musicIntensity(3, false)).toBeLessThan(musicIntensity(6, false));
    expect(musicIntensity(1, true)).toBe(1);
  });
});
