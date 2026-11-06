import type Phaser from 'phaser';

const SPACING = 150;
const RADIUS = 1100;

/** A faint neon ground grid in world space: gives the eye something to slide against, so speed reads clearly. */
export function drawGrid(g: Phaser.GameObjects.Graphics, focus: { x: number; y: number }, color: number): void {
  const x0 = Math.floor((focus.x - RADIUS) / SPACING) * SPACING;
  const y0 = Math.floor((focus.y - RADIUS) / SPACING) * SPACING;
  g.lineStyle(1.6, color, 0.07);
  for (let x = x0; x < focus.x + RADIUS; x += SPACING) g.lineBetween(x, focus.y - RADIUS, x, focus.y + RADIUS);
  for (let y = y0; y < focus.y + RADIUS; y += SPACING) g.lineBetween(focus.x - RADIUS, y, focus.x + RADIUS, y);
}
