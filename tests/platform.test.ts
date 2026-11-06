// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLifecycle, type DocumentLike, type NativeApp } from '../src/platform/lifecycle';

const mocks = vi.hoisted(() => ({
  native: false,
  impact: vi.fn(() => Promise.resolve()),
  notification: vi.fn(() => Promise.reject(new Error('no motor'))),
  exitApp: vi.fn(() => Promise.resolve()),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mocks.impact, notification: mocks.notification },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS' },
}));
vi.mock('@capacitor/app', () => ({ App: { exitApp: mocks.exitApp, addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })) } }));

const { createHapticsBackend, Haptics } = await import('../src/platform/haptics');
const { exitApp, isNative } = await import('../src/platform/native');

beforeEach(() => {
  mocks.native = false;
  vi.clearAllMocks();
});

describe('haptics', () => {
  it('use navigator.vibrate on the web and nothing when it does not exist', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const backend = createHapticsBackend();
    backend?.play('light');
    backend?.play('success');
    expect(vibrate).toHaveBeenCalledWith(8);
    expect(vibrate).toHaveBeenCalledWith([14, 40, 14]);
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(createHapticsBackend()).toBeNull();
  });

  it('use the native plugin in the Android app, and ignore a phone with no vibration motor', async () => {
    mocks.native = true;
    const backend = createHapticsBackend();
    backend?.play('heavy');
    backend?.play('success');
    expect(mocks.impact).toHaveBeenCalledWith({ style: 'HEAVY' });
    expect(mocks.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
    await Promise.resolve();
    expect(isNative()).toBe(true);
  });

  it('are only played when switched on and available, and never interrupt play', () => {
    const play = vi.fn();
    let enabled = true;
    const haptics = new Haptics({ play }, () => enabled);
    expect(haptics.available).toBe(true);
    haptics.play('light');
    enabled = false;
    haptics.play('light');
    expect(play).toHaveBeenCalledTimes(1);
    expect(new Haptics(null, () => true).available).toBe(false);
    new Haptics(null, () => true).play('light');
    const throwing = new Haptics({ play: () => { throw new Error('boom'); } }, () => true);
    expect(() => throwing.play('heavy')).not.toThrow();
  });
});

describe('leaving the app', () => {
  it('exits only inside the Android app', () => {
    exitApp();
    expect(mocks.exitApp).not.toHaveBeenCalled();
    mocks.native = true;
    exitApp();
    expect(mocks.exitApp).toHaveBeenCalledTimes(1);
  });
});

describe('app lifecycle', () => {
  function fakeDoc(): DocumentLike & { state: string; fire: (type: string) => void } {
    const listeners = new Map<string, Array<() => void>>();
    const doc = {
      state: 'visible',
      get visibilityState() {
        return doc.state;
      },
      addEventListener: (type: string, fn: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
      removeEventListener: () => undefined,
      fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    };
    return doc;
  }

  it('reports the page going to the background and coming back, and lets a listener stop listening', () => {
    const doc = fakeDoc();
    const life = createLifecycle(doc, null);
    const back = vi.fn();
    const front = vi.fn();
    const off = life.onBackground(back);
    life.onForeground(front);
    doc.state = 'hidden';
    doc.fire('visibilitychange');
    doc.state = 'visible';
    doc.fire('visibilitychange');
    doc.fire('pagehide');
    expect(back).toHaveBeenCalledTimes(2);
    expect(front).toHaveBeenCalledTimes(1);
    off();
    doc.fire('pagehide');
    expect(back).toHaveBeenCalledTimes(2);
  });

  it('forwards the Android app state and back button', () => {
    const handlers: Record<string, (s: { isActive?: boolean }) => void> = {};
    const native: NativeApp = {
      addListener: (event, fn) => {
        handlers[event] = fn;
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    };
    const life = createLifecycle(fakeDoc(), native);
    const back = vi.fn();
    const press = vi.fn();
    const front = vi.fn();
    life.onBackground(back);
    life.onForeground(front);
    life.onBack(press);
    handlers.appStateChange?.({ isActive: false });
    handlers.appStateChange?.({ isActive: true });
    handlers.backButton?.({});
    expect([back.mock.calls.length, front.mock.calls.length, press.mock.calls.length]).toEqual([1, 1, 1]);
  });
});
