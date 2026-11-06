import type { AudioKit } from '../services/audio';
import type { ProgressStore } from '../services/progress';
import type { SettingsStore } from '../services/settings';
import type { Haptics } from '../platform/haptics';
import type { Dialogs } from '../ui/dialogs';

export type ScreenName =
  | 'menu' | 'stages' | 'garage' | 'settings' | 'achievements' | 'howto' | 'credits' | 'boards';

/** What a screen can ask the app to do. Screens never reach into each other. */
export interface Nav {
  show(screen: ScreenName, params?: { district?: number }): void;
  back(): void;
  playStage(id: string): void;
  playEndless(): void;
  playDaily(): void;
  restart(): void;
  quitToMenu(): void;
  quitToStages(): void;
  resume(): void;
}

export interface AppContext {
  progress: ProgressStore;
  settings: SettingsStore;
  audio: AudioKit;
  haptics: Haptics;
  dialogs: Dialogs;
  nav: Nav;
  now(): Date;
  /** Shows a short message (achievements, save problems). */
  toast(message: string, strong?: string): void;
  /** Speaks a message to screen readers. */
  announce(message: string): void;
  /** Leaves the app (Android back at the top level); does nothing in a browser. */
  exit(): void;
  version: string;
  isNative: boolean;
}

/** A built screen: its root element and an optional cleanup. */
export interface ScreenView {
  el: HTMLElement;
  title: string;
  dispose?: () => void;
}
