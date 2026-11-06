import { SaveSlot, type LoadResult, type SaveSpec } from './storage/save-slot';
import type { KeyValueStore } from './storage/store';

export type Quality = 'auto' | 'high' | 'medium' | 'low';
export type MotionPref = 'system' | 'reduce' | 'full';
export type ControlScheme = 'thumb' | 'buttons';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  haptics: boolean;
  motion: MotionPref;
  screenShake: boolean;
  quality: Quality;
  controls: ControlScheme;
  /** 0.8 - 1.2: scales the turn rate. 1 is the setting every stage was validated with. */
  sensitivity: number;
  /** 0.9 - 1.3: scales text and controls in the interface. */
  uiScale: number;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  haptics: true,
  motion: 'system',
  screenShake: true,
  quality: 'auto',
  controls: 'thumb',
  sensitivity: 1,
  uiScale: 1,
};

export const SETTINGS_VERSION = 1;
const QUALITIES: readonly Quality[] = ['auto', 'high', 'medium', 'low'];
const MOTIONS: readonly MotionPref[] = ['system', 'reduce', 'full'];
const CONTROLS: readonly ControlScheme[] = ['thumb', 'buttons'];

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Turns anything that was stored (or imported) into a complete, in-range Settings object. */
export function sanitizeSettings(data: unknown): Settings {
  const raw = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    musicVolume: clampNumber(raw.musicVolume, 0, 1, d.musicVolume),
    sfxVolume: clampNumber(raw.sfxVolume, 0, 1, d.sfxVolume),
    muted: bool(raw.muted, d.muted),
    haptics: bool(raw.haptics, d.haptics),
    motion: oneOf(raw.motion, MOTIONS, d.motion),
    screenShake: bool(raw.screenShake, d.screenShake),
    quality: oneOf(raw.quality, QUALITIES, d.quality),
    controls: oneOf(raw.controls, CONTROLS, d.controls),
    sensitivity: clampNumber(raw.sensitivity, 0.8, 1.2, d.sensitivity),
    uiScale: clampNumber(raw.uiScale, 0.9, 1.3, d.uiScale),
  };
}

const spec: SaveSpec<Settings> = {
  key: 'neon-drift.settings',
  version: SETTINGS_VERSION,
  defaults: () => ({ ...DEFAULT_SETTINGS }),
  migrate: (data) => data,
  validate: (data) => (typeof data === 'object' && data !== null ? sanitizeSettings(data) : null),
};

type Listener = (settings: Settings) => void;

/** Settings held in memory, saved on every change, with change listeners for the audio, UI and renderer. */
export class SettingsStore {
  private readonly slot: SaveSlot<Settings>;
  private current: Settings;
  private readonly listeners = new Set<Listener>();
  readonly loadInfo: LoadResult<Settings>;

  constructor(store: KeyValueStore) {
    this.slot = new SaveSlot(store, spec);
    this.loadInfo = this.slot.load();
    this.current = this.loadInfo.value;
  }

  get value(): Settings {
    return this.current;
  }

  update(patch: Partial<Settings>): void {
    this.current = sanitizeSettings({ ...this.current, ...patch });
    this.slot.save(this.current);
    for (const listener of this.listeners) listener(this.current);
  }

  reset(): void {
    this.update({ ...DEFAULT_SETTINGS });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** Whether effects that move the picture (shake, parallax, speed lines, long transitions) should be reduced. */
export function reducedMotion(settings: Settings, systemPrefersReduced: boolean): boolean {
  if (settings.motion === 'reduce') return true;
  if (settings.motion === 'full') return false;
  return systemPrefersReduced;
}
