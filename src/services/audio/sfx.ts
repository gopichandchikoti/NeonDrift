import type { AudioEngine } from './engine';
import { midi, noise, tone } from './synth';

export type SfxName =
  | 'tap' | 'confirm' | 'back' | 'spark' | 'near-miss' | 'edge-kiss' | 'drift-end' | 'combo-up' | 'combo-drop'
  | 'scrape' | 'crash' | 'shield-pickup' | 'shield-break' | 'magnet' | 'boost-ready' | 'boost-start' | 'finish'
  | 'star' | 'achievement' | 'beep';

type Voice = (ctx: AudioContext, out: AudioNode, level: number) => void;

const pentatonic = [0, 3, 5, 7, 10, 12, 15, 17, 19];

const VOICES: Record<SfxName, Voice> = {
  tap: (c, o) => tone(c, o, { type: 'square', freq: 880, duration: 0.04, gain: 0.05 }),
  confirm: (c, o) => {
    tone(c, o, { type: 'triangle', freq: midi(72), duration: 0.09, gain: 0.12 });
    tone(c, o, { type: 'triangle', freq: midi(79), duration: 0.14, gain: 0.12, delay: 0.07 });
  },
  back: (c, o) => tone(c, o, { type: 'triangle', freq: midi(67), freqEnd: midi(60), duration: 0.12, gain: 0.1 }),
  beep: (c, o, level) => tone(c, o, { type: 'square', freq: level > 0 ? 1175 : 660, duration: level > 0 ? 0.28 : 0.1, gain: 0.1 }),
  spark: (c, o, level) => {
    const note = 76 + (pentatonic[Math.min(level, pentatonic.length - 1)] ?? 0);
    tone(c, o, { type: 'sine', freq: midi(note), duration: 0.11, gain: 0.13 });
    tone(c, o, { type: 'triangle', freq: midi(note + 12), duration: 0.06, gain: 0.05 });
  },
  'near-miss': (c, o) => {
    noise(c, o, { filter: 'bandpass', freq: 700, freqEnd: 3200, duration: 0.2, gain: 0.2 });
    tone(c, o, { type: 'square', freq: midi(84), freqEnd: midi(91), duration: 0.12, gain: 0.07 });
  },
  'edge-kiss': (c, o) => noise(c, o, { filter: 'highpass', freq: 1800, freqEnd: 5000, duration: 0.14, gain: 0.14 }),
  'drift-end': (c, o, level) => {
    [0, 4, 7].forEach((interval, i) => {
      const freq = midi(67 + interval + Math.min(level, 6));
      tone(c, o, { type: 'triangle', freq, duration: 0.18, gain: 0.1, delay: i * 0.05 });
    });
  },
  'combo-up': (c, o, level) => {
    const root = 64 + Math.min(level, 8);
    tone(c, o, { type: 'square', freq: midi(root), duration: 0.07, gain: 0.07 });
    tone(c, o, { type: 'square', freq: midi(root + 7), duration: 0.07, gain: 0.07, delay: 0.06 });
    tone(c, o, { type: 'square', freq: midi(root + 12), duration: 0.12, gain: 0.08, delay: 0.12 });
  },
  'combo-drop': (c, o) => tone(c, o, { type: 'sawtooth', freq: midi(64), freqEnd: midi(52), duration: 0.22, gain: 0.07 }),
  scrape: (c, o) => {
    noise(c, o, { filter: 'bandpass', freq: 2400, freqEnd: 900, duration: 0.22, gain: 0.3 });
    tone(c, o, { type: 'sawtooth', freq: 180, freqEnd: 90, duration: 0.18, gain: 0.07 });
  },
  crash: (c, o) => {
    tone(c, o, { type: 'sine', freq: 150, freqEnd: 34, duration: 0.55, gain: 0.5 });
    noise(c, o, { filter: 'lowpass', freq: 3200, freqEnd: 180, duration: 0.6, gain: 0.5 });
    noise(c, o, { filter: 'highpass', freq: 2500, duration: 0.2, gain: 0.25, delay: 0.02 });
  },
  'shield-pickup': (c, o) => {
    [72, 76, 79, 84].forEach((n, i) => tone(c, o, { type: 'sine', freq: midi(n), duration: 0.16, gain: 0.12, delay: i * 0.05 }));
  },
  'shield-break': (c, o) => {
    noise(c, o, { filter: 'highpass', freq: 3000, duration: 0.3, gain: 0.3 });
    tone(c, o, { type: 'triangle', freq: midi(84), freqEnd: midi(55), duration: 0.3, gain: 0.12 });
  },
  magnet: (c, o) => {
    tone(c, o, { type: 'sawtooth', freq: 220, freqEnd: 440, duration: 0.3, gain: 0.09 });
    tone(c, o, { type: 'sine', freq: midi(79), duration: 0.25, gain: 0.1, delay: 0.1 });
  },
  'boost-ready': (c, o) => {
    tone(c, o, { type: 'sine', freq: midi(84), duration: 0.16, gain: 0.12 });
    tone(c, o, { type: 'sine', freq: midi(91), duration: 0.22, gain: 0.12, delay: 0.1 });
  },
  'boost-start': (c, o) => {
    noise(c, o, { filter: 'bandpass', freq: 400, freqEnd: 4200, duration: 0.5, gain: 0.35 });
    tone(c, o, { type: 'sawtooth', freq: 110, freqEnd: 440, duration: 0.5, gain: 0.12 });
  },
  finish: (c, o) => {
    [60, 64, 67, 72, 76, 79].forEach((n, i) => {
      tone(c, o, { type: 'triangle', freq: midi(n), duration: 0.35, gain: 0.13, delay: i * 0.08 });
    });
  },
  star: (c, o, level) => {
    tone(c, o, { type: 'sine', freq: midi(79 + level * 4), duration: 0.4, gain: 0.16 });
    tone(c, o, { type: 'sine', freq: midi(91 + level * 4), duration: 0.3, gain: 0.07, delay: 0.04 });
  },
  achievement: (c, o) => {
    [72, 79, 84, 88].forEach((n, i) => tone(c, o, { type: 'square', freq: midi(n), duration: 0.2, gain: 0.07, delay: i * 0.07 }));
  },
};

/** One-shot sound effects, synthesised on the fly. Silent until the player's first tap unlocks audio. */
export class Sfx {
  constructor(private readonly engine: AudioEngine) {}

  play(name: SfxName, level = 0): void {
    const ctx = this.engine.context;
    const out = this.engine.sfxOut;
    if (!ctx || !out || ctx.state !== 'running') return;
    VOICES[name](ctx, out, level);
  }
}
