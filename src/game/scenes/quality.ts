import type { RoadStyle } from './draw/road';

export type Level = 'high' | 'medium' | 'low';

export interface LevelStyle extends RoadStyle {
  /** Rooftops get side walls. */
  walls: boolean;
  /** Post-process bloom (WebGL only). */
  bloom: boolean;
  /** Share of particles emitted, 0..1. */
  particles: number;
}

const STYLES: Record<Level, LevelStyle> = {
  high: { stride: 2, glow: 3, walls: true, bloom: true, particles: 1 },
  medium: { stride: 2, glow: 2, walls: true, bloom: false, particles: 0.7 },
  low: { stride: 3, glow: 1, walls: false, bloom: false, particles: 0.4 },
};

export function styleFor(level: Level): LevelStyle {
  return STYLES[level];
}

const ORDER: readonly Level[] = ['high', 'medium', 'low'];
const WINDOW = 90;
/** Average frame time (ms) above which effects are stepped down: roughly under 42 fps. */
const SLOW_MS = 24;
const COOLDOWN_MS = 3000;

/**
 * Watches frame times and, in "auto" quality, steps the visual effects down when the device cannot keep up. It only
 * ever steps down within a session, so quality never flaps.
 */
export class QualityMonitor {
  level: Level = 'high';
  private total = 0;
  private count = 0;
  private cooldown = COOLDOWN_MS;

  resetWindow(): void {
    this.total = 0;
    this.count = 0;
    this.cooldown = COOLDOWN_MS;
  }

  sample(delta: number): void {
    // Ignore long stalls (tab switches, pauses): they say nothing about steady-state speed.
    if (delta > 250) return;
    this.cooldown -= delta;
    this.total += delta;
    this.count += 1;
    if (this.count < WINDOW) return;
    const average = this.total / this.count;
    this.total = 0;
    this.count = 0;
    if (average > SLOW_MS && this.cooldown <= 0) this.stepDown();
  }

  private stepDown(): void {
    const next = ORDER[ORDER.indexOf(this.level) + 1];
    if (!next) return;
    this.level = next;
    this.cooldown = COOLDOWN_MS;
  }
}
