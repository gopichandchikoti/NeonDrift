// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SaveSlot, type SaveSpec } from '../src/services/storage/save-slot';
import { createDefaultStore, LocalStore, MemoryStore } from '../src/services/storage/store';
import {
  DEFAULT_SETTINGS, reducedMotion, sanitizeSettings, SettingsStore, type Settings,
} from '../src/services/settings';

class BrokenStorage implements Storage {
  readonly length = 0;
  clear(): void {
    throw new Error('blocked');
  }
  getItem(): string | null {
    throw new Error('blocked');
  }
  key(): string | null {
    throw new Error('blocked');
  }
  removeItem(): void {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('quota');
  }
}

describe('key-value stores', () => {
  it('keep values in memory', () => {
    const s = new MemoryStore();
    expect(s.get('a')).toBeNull();
    expect(s.set('a', '1')).toBe(true);
    expect(s.get('a')).toBe('1');
    s.remove('a');
    expect(s.get('a')).toBeNull();
  });

  it('wrap localStorage and survive it throwing (private windows, full disks)', () => {
    const ok = new LocalStore(window.localStorage);
    expect(ok.set('k', 'v')).toBe(true);
    expect(ok.get('k')).toBe('v');
    ok.remove('k');
    const broken = new LocalStore(new BrokenStorage());
    expect(broken.get('k')).toBeNull();
    expect(broken.set('k', 'v')).toBe(false);
    expect(() => broken.remove('k')).not.toThrow();
  });

  it('pick localStorage when it works and fall back to memory when it does not', () => {
    expect(createDefaultStore().persistent).toBe(true);
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { value: new BrokenStorage(), configurable: true });
    try {
      const fallback = createDefaultStore();
      expect(fallback.persistent).toBe(false);
      fallback.store.set('x', '1');
      expect(fallback.store.get('x')).toBe('1');
    } finally {
      if (real) Object.defineProperty(window, 'localStorage', real);
    }
  });
});

interface Doc {
  n: number;
}

const spec = (over: Partial<SaveSpec<Doc>> = {}): SaveSpec<Doc> => ({
  key: 'doc',
  version: 2,
  defaults: () => ({ n: 0 }),
  migrate: (data) => ({ n: (data as { count: number }).count }),
  validate: (data) => (typeof data === 'object' && data !== null && typeof (data as Doc).n === 'number' ? (data as Doc) : null),
  ...over,
});

describe('versioned saves', () => {
  it('start from defaults, then round-trip what was saved', () => {
    const store = new MemoryStore();
    const slot = new SaveSlot(store, spec());
    expect(slot.load()).toMatchObject({ source: 'defaults', recovered: false, value: { n: 0 } });
    expect(slot.save({ n: 5 })).toBe(true);
    expect(new SaveSlot(store, spec()).load()).toMatchObject({ source: 'primary', value: { n: 5 }, migrated: false });
  });

  it('migrate an older version forward and report it', () => {
    const store = new MemoryStore();
    store.set('doc', JSON.stringify({ version: 1, data: { count: 9 } }));
    expect(new SaveSlot(store, spec()).load()).toMatchObject({ value: { n: 9 }, migrated: true, source: 'primary' });
  });

  it('refuse a save from a newer version of the game instead of damaging it', () => {
    const store = new MemoryStore();
    store.set('doc', JSON.stringify({ version: 3, data: { n: 1 } }));
    const loaded = new SaveSlot(store, spec()).load();
    expect(loaded).toMatchObject({ source: 'defaults', recovered: true });
  });

  it('fall back to the backup when the main save is corrupt, and to defaults when both are', () => {
    const store = new MemoryStore();
    const slot = new SaveSlot(store, spec());
    slot.save({ n: 1 });
    slot.save({ n: 2 });
    store.set('doc', '{not json');
    expect(slot.load()).toMatchObject({ source: 'backup', recovered: true, value: { n: 1 } });
    store.set('doc.backup', JSON.stringify({ version: 2, data: { n: 'bad' } }));
    expect(slot.load()).toMatchObject({ source: 'defaults', recovered: true, value: { n: 0 } });
    store.set('doc', JSON.stringify([1, 2]));
    store.set('doc.backup', 'null');
    expect(slot.load().source).toBe('defaults');
    store.set('doc', JSON.stringify({ version: 1.5, data: {} }));
    expect(slot.load().source).toBe('defaults');
  });

  it('treat a migration that throws as an unusable save', () => {
    const store = new MemoryStore();
    store.set('doc', JSON.stringify({ version: 1, data: null }));
    const loaded = new SaveSlot(store, spec()).load();
    expect(loaded.source).toBe('defaults');
  });

  it('report a refused write, and clear both copies', () => {
    const slot = new SaveSlot(new LocalStore(new BrokenStorage()), spec());
    expect(slot.save({ n: 1 })).toBe(false);
    const store = new MemoryStore();
    const real = new SaveSlot(store, spec());
    real.save({ n: 1 });
    real.save({ n: 2 });
    real.clear();
    expect(store.get('doc')).toBeNull();
    expect(store.get('doc.backup')).toBeNull();
  });
});

describe('settings', () => {
  it('clamp, correct and complete whatever they are given', () => {
    const s = sanitizeSettings({
      musicVolume: 7, sfxVolume: -1, sensitivity: 9, uiScale: 0, quality: 'ultra', motion: 'reduce', controls: 'buttons',
      muted: 'yes', haptics: false, screenShake: false,
    });
    expect(s).toMatchObject({
      musicVolume: 1, sfxVolume: 0, sensitivity: 1.2, uiScale: 0.9, quality: 'auto', motion: 'reduce',
      controls: 'buttons', muted: false, haptics: false, screenShake: false,
    });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ musicVolume: NaN }).musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
  });

  it('save on change, tell listeners, reset, and reload the same values', () => {
    const store = new MemoryStore();
    const settings = new SettingsStore(store);
    const seen: Settings[] = [];
    const off = settings.subscribe((s) => seen.push(s));
    settings.update({ muted: true, sensitivity: 1.1 });
    expect(seen).toHaveLength(1);
    expect(new SettingsStore(store).value).toMatchObject({ muted: true, sensitivity: 1.1 });
    off();
    settings.update({ muted: false });
    expect(seen).toHaveLength(1);
    settings.reset();
    expect(settings.value).toEqual(DEFAULT_SETTINGS);
  });

  it('decide when motion is reduced: the setting wins over the system preference', () => {
    const base = DEFAULT_SETTINGS;
    expect(reducedMotion({ ...base, motion: 'reduce' }, false)).toBe(true);
    expect(reducedMotion({ ...base, motion: 'full' }, true)).toBe(false);
    expect(reducedMotion({ ...base, motion: 'system' }, true)).toBe(true);
    expect(reducedMotion({ ...base, motion: 'system' }, false)).toBe(false);
  });
});
