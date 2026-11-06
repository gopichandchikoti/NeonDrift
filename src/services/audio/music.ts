import type { AudioEngine } from './engine';
import { midi, noise, tone } from './synth';

interface Groove {
  bpm: number;
  root: number;
  scale: readonly number[];
}

/** One tempo, key and mode per district, so each part of the city sounds different. */
const GROOVES: Record<number, Groove> = {
  0: { bpm: 96, root: 45, scale: [0, 3, 5, 7, 10] },
  1: { bpm: 112, root: 45, scale: [0, 3, 5, 7, 10] },
  2: { bpm: 100, root: 38, scale: [0, 2, 3, 7, 9] },
  3: { bpm: 124, root: 40, scale: [0, 1, 5, 7, 8] },
  4: { bpm: 118, root: 36, scale: [0, 3, 5, 7, 10] },
  5: { bpm: 126, root: 41, scale: [0, 2, 4, 6, 7] },
  6: { bpm: 132, root: 43, scale: [0, 3, 5, 7, 10] },
};

const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);
const LOOKAHEAD = 0.14;
const INTERVAL_MS = 30;

/** A small generative synthwave loop (bass, arpeggio, kick and hat), scheduled ahead of the audio clock. */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private groove: Groove = GROOVES[1] as Groove;
  private intensity = 0.5;

  constructor(private readonly engine: AudioEngine) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  /** 0..1: how busy the music is (menu 0.3, race 0.6, boost or high combo 1). */
  setIntensity(value: number): void {
    this.intensity = value;
  }

  start(district: number): void {
    const ctx = this.engine.context;
    if (!ctx) return;
    this.stop();
    this.groove = GROOVES[district] ?? (GROOVES[1] as Groove);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.engine.context;
    const out = this.engine.musicOut;
    if (!ctx || !out) return;
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    const stepLength = 60 / this.groove.bpm / 4;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(ctx, out, this.step % 64, this.nextTime - ctx.currentTime);
      this.step += 1;
      this.nextTime += stepLength;
    }
  }

  private playStep(ctx: AudioContext, out: AudioNode, step: number, delay: number): void {
    const { root, scale } = this.groove;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const degree = [0, 0, 3, 2][bar % 4] as number;
    const note = (index: number, octave: number): number => {
      return root + octave * 12 + (scale[(index + degree) % scale.length] as number);
    };
    if (s % 4 === 0) tone(ctx, out, { type: 'sine', freq: 110, freqEnd: 42, duration: 0.18, gain: 0.5, delay });
    if (s % 2 === 1 && this.intensity > 0.4) {
      noise(ctx, out, { filter: 'highpass', freq: 7000, duration: 0.04, gain: 0.07, delay });
    }
    if (BASS_STEPS.has(s)) {
      tone(ctx, out, { type: 'sawtooth', freq: midi(note(0, 0)), duration: 0.2, gain: 0.16, delay });
    }
    if (this.intensity > 0.25 && s % 2 === 0) {
      const arp = [0, 2, 1, 3, 2, 4, 3, 1][(s / 2) % 8] as number;
      tone(ctx, out, { type: 'square', freq: midi(note(arp, 2)), duration: 0.1, gain: 0.045 * this.intensity, delay });
    }
  }
}
