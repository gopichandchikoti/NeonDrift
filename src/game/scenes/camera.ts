import { angleDiff } from '../physics/math';

/**
 * The internal play field is always 540 units wide; its height follows the screen (taller phones see more road),
 * within these limits. Wider windows are letterboxed by the page.
 */
export const VIEW = { width: 540, height: 960 };
export const VIEW_LIMITS = { minHeight: 820, maxHeight: 1240 };
/** The car sits this far down the screen, leaving most of it for the road ahead. */
const ANCHOR_Y = 0.73;
const BASE_ZOOM = 1.3;
const BOOST_ZOOM = 1.12;

/** Picks the internal height for a window of the given size. */
export function viewHeightFor(windowWidth: number, windowHeight: number): number {
  const wanted = (VIEW.width * windowHeight) / Math.max(1, windowWidth);
  return Math.round(Math.min(VIEW_LIMITS.maxHeight, Math.max(VIEW_LIMITS.minHeight, wanted)));
}

export function anchor(): { x: number; y: number } {
  return { x: VIEW.width / 2, y: VIEW.height * ANCHOR_Y };
}

export interface Transform {
  rotation: number;
  scale: number;
  x: number;
  y: number;
}

/**
 * A chase camera that keeps the road ahead pointing up. It turns toward the direction of the road a little way
 * ahead of the car (not toward the car's own nose), so the car visibly slides and rotates against a calm background.
 */
export class ChaseCamera {
  angle = -Math.PI / 2;
  zoom = BASE_ZOOM;
  shake = 0;

  reset(angle: number): void {
    this.angle = angle;
    this.zoom = BASE_ZOOM;
    this.shake = 0;
  }

  update(dt: number, targetAngle: number, boosting: boolean, reduced: boolean): void {
    this.angle += angleDiff(targetAngle, this.angle) * (1 - Math.exp(-4.2 * dt));
    const target = boosting && !reduced ? BOOST_ZOOM : BASE_ZOOM;
    this.zoom += (target - this.zoom) * (1 - Math.exp(-3 * dt));
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  addShake(amount: number): void {
    this.shake = Math.min(14, this.shake + amount);
  }

  /** The container transform that puts world point (x, y) at the anchor, with the road direction pointing up. */
  transform(x: number, y: number, jitterX = 0, jitterY = 0): Transform {
    const rotation = -Math.PI / 2 - this.angle;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const s = this.zoom;
    const a = anchor();
    return {
      rotation,
      scale: s,
      x: a.x + jitterX - s * (cos * x - sin * y),
      y: a.y + jitterY - s * (sin * x + cos * y),
    };
  }
}
