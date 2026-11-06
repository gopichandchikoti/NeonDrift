import type { Palette } from '../cosmetics';
import type { WorldEvent } from '../systems/world-types';
import type { ChaseCamera } from './camera';
import type { Particles } from './draw/effects';

export interface EffectTargets {
  particles: Particles;
  cam: ChaseCamera;
  reduced: boolean;
  popup: (text: string, x: number, y: number, kind: string) => void;
  roadAngle: number;
  palette: Palette;
}

type Located = Extract<WorldEvent, { x: number; y: number }>;

/** Floating labels for scoring events: text, and the style it is drawn in. */
function label(event: WorldEvent): [string, string] | null {
  switch (event.type) {
    case 'spark':
      return [String(event.points), 'spark'];
    case 'near-miss':
      return [`NEAR MISS +${event.points}`, 'near'];
    case 'edge-kiss':
      return [`EDGE KISS +${event.points}`, 'kiss'];
    case 'drift-end':
      return [`DRIFT +${event.points}`, 'drift'];
    case 'traffic-pass':
      return [`PASS +${event.points}`, 'pass'];
    default:
      return null;
  }
}

function impact(event: Located, t: EffectTargets): void {
  const { particles, cam } = t;
  if (event.type === 'scrape') {
    const away = t.roadAngle + Math.PI;
    particles.burst(event.x, event.y, { count: 14, color: 0xffc13b, speed: 220, angle: away, spread: 2 });
    cam.addShake(t.reduced ? 0 : 3.5);
  } else if (event.type === 'crash') {
    particles.burst(event.x, event.y, { count: 70, color: 0xff5a3c, speed: 360 });
    particles.burst(event.x, event.y, { count: 34, color: 0xffffff, speed: 260 });
    cam.addShake(t.reduced ? 0 : 12);
  } else if (event.type === 'shield-break') {
    particles.burst(event.x, event.y, { count: 36, color: t.palette.glow, speed: 300 });
    cam.addShake(t.reduced ? 0 : 5);
  }
}

const COLLECT: Partial<Record<WorldEvent['type'], { color: number; count: number; speed: number }>> = {
  spark: { color: 0xfff36b, count: 6, speed: 120 },
  'near-miss': { color: 0xffffff, count: 14, speed: 200 },
  'shield-pickup': { color: 0x37e2ff, count: 20, speed: 200 },
  'magnet-pickup': { color: 0xff3fa4, count: 20, speed: 200 },
};

/** Turns one world event into sparks, shake and floating labels. Sound and haptics live elsewhere. */
export function applyEvent(event: WorldEvent, t: EffectTargets): void {
  if (!('x' in event)) return;
  impact(event, t);
  const burst = COLLECT[event.type];
  if (burst) t.particles.burst(event.x, event.y, burst);
  const text = label(event);
  if (text) t.popup(text[0], event.x, event.y, text[1]);
}
