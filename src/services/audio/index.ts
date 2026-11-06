import type { Settings } from '../settings';
import { AudioEngine, type ContextFactory } from './engine';
import { DriveSound } from './drive-sound';
import { Music } from './music';
import { Sfx } from './sfx';

/** Everything that makes sound, behind one object the app can unlock, mute and re-level from the settings. */
export class AudioKit {
  readonly engine: AudioEngine;
  readonly sfx: Sfx;
  readonly music: Music;
  readonly drive: DriveSound;

  constructor(factory?: ContextFactory) {
    this.engine = new AudioEngine(factory);
    this.sfx = new Sfx(this.engine);
    this.music = new Music(this.engine);
    this.drive = new DriveSound(this.engine);
  }

  apply(settings: Settings): void {
    this.engine.setLevels({ musicVolume: settings.musicVolume, sfxVolume: settings.sfxVolume, muted: settings.muted });
  }

  /** Call from a tap or key press: browsers only allow sound after a user gesture. */
  unlock(): void {
    this.engine.unlock();
  }

  suspend(): void {
    this.engine.suspend();
  }

  resume(): void {
    this.engine.resume();
  }
}
