import type Phaser from 'phaser';
import { VIEW } from './camera';

const DROPS = 70;

/** Rain for Rainline Docks, drawn in screen space. Purely visual: it never affects grip. */
export class Rain {
  private readonly seeds = Array.from({ length: DROPS }, (_, i) => ({
    x: (i * 7919) % VIEW.width,
    y: (i * 104729) % VIEW.height,
    v: 0.8 + ((i * 31) % 10) / 12,
  }));

  draw(g: Phaser.GameObjects.Graphics, state: { enabled: boolean; t: number; speed: number; density: number }): void {
    const { enabled, t, speed, density } = state;
    if (!enabled) return;
    g.lineStyle(1.4, 0x9fd8ff, 0.32);
    const count = Math.round(DROPS * density);
    for (let i = 0; i < count; i++) {
      const d = this.seeds[i];
      if (!d) continue;
      const fall = (d.y + t * 900 * d.v) % VIEW.height;
      const lean = speed * 0.02;
      g.lineBetween(d.x, fall, d.x - lean * 0.1, fall + 18 + lean * 0.1);
    }
  }
}
