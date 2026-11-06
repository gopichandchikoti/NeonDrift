/** Cosmetic choices only: every car has exactly the same size, handling and hit box (see CAR in physics/constants). */

export type Layer = 'body' | 'accent' | 'dark' | 'glass';

export interface Piece {
  layer: Layer;
  /** x,y pairs in car space: +x is forward, +y is the car's right. The car is 34 long and 18 wide. */
  pts: readonly number[];
}

export interface CarDesign {
  id: string;
  name: string;
  tagline: string;
  /** Total stars needed to unlock it. */
  stars: number;
  pieces: readonly Piece[];
}

const mirror = (pts: readonly number[]): number[] => pts.map((v, i) => (i % 2 === 1 ? -v : v));

function ellipse(rx: number, ry: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push(Math.cos(a) * rx, Math.sin(a) * ry);
  }
  return out;
}

export const CAR_DESIGNS: readonly CarDesign[] = [
  {
    id: 'pulse', name: 'Pulse', tagline: 'The all-rounder', stars: 0,
    pieces: [
      { layer: 'body', pts: [17, 0, 8, -8, -14, -9, -17, -5, -17, 5, -14, 9, 8, 8] },
      { layer: 'glass', pts: [5, -4.5, -4, -5.5, -4, 5.5, 5, 4.5] },
      { layer: 'accent', pts: [-17, -2, -7, -2, -7, 2, -17, 2] },
    ],
  },
  {
    id: 'arrow', name: 'Arrow', tagline: 'Needle-nosed and sharp', stars: 4,
    pieces: [
      { layer: 'body', pts: [17, 0, -2, -8, -17, -6, -17, 6, -2, 8] },
      { layer: 'glass', pts: [6, -2.5, -3, -4.5, -3, 4.5, 6, 2.5] },
      { layer: 'accent', pts: [-17, -6, -12, -9, -8, -6] },
      { layer: 'accent', pts: mirror([-17, -6, -12, -9, -8, -6]) },
    ],
  },
  {
    id: 'bolt', name: 'Bolt', tagline: 'Winged and wide', stars: 10,
    pieces: [
      { layer: 'body', pts: [15, 0, 6, -7, -10, -8, -17, -6, -17, 6, -10, 8, 6, 7] },
      { layer: 'accent', pts: [-6, -9, -17, -9, -17, -6, -6, -6] },
      { layer: 'accent', pts: mirror([-6, -9, -17, -9, -17, -6, -6, -6]) },
      { layer: 'glass', pts: [6, -3.5, -2, -4.5, -2, 4.5, 6, 3.5] },
    ],
  },
  {
    id: 'comet', name: 'Comet', tagline: 'Smooth as a teardrop', stars: 20,
    pieces: [
      { layer: 'body', pts: ellipse(17, 9, 16) },
      { layer: 'glass', pts: ellipse(6, 4.5, 10).map((v, i) => (i % 2 === 0 ? v + 3 : v)) },
      { layer: 'accent', pts: [-17, -1.5, -9, -1.5, -9, 1.5, -17, 1.5] },
    ],
  },
  {
    id: 'manta', name: 'Manta', tagline: 'Flat, wide, swept back', stars: 32,
    pieces: [
      { layer: 'body', pts: [17, 0, 5, -9, -6, -9, -17, -4, -17, 4, -6, 9, 5, 9] },
      { layer: 'dark', pts: [9, -3, -9, -6, -9, 6, 9, 3] },
      { layer: 'accent', pts: [10, -1, -6, -1, -6, 1, 10, 1] },
    ],
  },
  {
    id: 'prism', name: 'Prism', tagline: 'Cut from crystal', stars: 48,
    pieces: [
      { layer: 'body', pts: [17, 0, 6, -9, -9, -9, -17, 0, -9, 9, 6, 9] },
      { layer: 'glass', pts: [8, 0, 0, -5, -8, 0, 0, 5] },
      { layer: 'accent', pts: [17, 0, 9, -3, 9, 3] },
    ],
  },
  {
    id: 'ember', name: 'Ember', tagline: 'Twin pods, one spark', stars: 70,
    pieces: [
      { layer: 'body', pts: [14, -9, -17, -9, -17, -3.5, 14, -3.5] },
      { layer: 'body', pts: [14, 3.5, -17, 3.5, -17, 9, 14, 9] },
      { layer: 'accent', pts: [5, -3.5, -8, -3.5, -8, 3.5, 5, 3.5] },
      { layer: 'glass', pts: [3, -1.5, -5, -1.5, -5, 1.5, 3, 1.5] },
    ],
  },
  {
    id: 'phantom', name: 'Phantom', tagline: 'Stealth, all angles', stars: 100,
    pieces: [
      { layer: 'body', pts: [17, 0, -2, -7, -10, -9, -17, -4, -17, 4, -10, 9, -2, 7] },
      { layer: 'dark', pts: [10, 0, -3, -5, -8, 0, -3, 5] },
      { layer: 'accent', pts: [-10, -9, -17, -4, -13, -4] },
      { layer: 'accent', pts: mirror([-10, -9, -17, -4, -13, -4]) },
    ],
  },
];

export interface Palette {
  id: string;
  name: string;
  body: number;
  accent: number;
  /** Tire trail, boost flame and shield glow. */
  glow: number;
  /** Cleared district needed to unlock it (0 = from the start). */
  district: number;
}

export const PALETTES: readonly Palette[] = [
  { id: 'cyan', name: 'Cyan Rush', body: 0xdff7ff, accent: 0x37e2ff, glow: 0x37e2ff, district: 0 },
  { id: 'magenta', name: 'Magenta Burn', body: 0xffe3f3, accent: 0xff3fa4, glow: 0xff3fa4, district: 1 },
  { id: 'gold', name: 'Solar Gold', body: 0xfff6d2, accent: 0xffb13b, glow: 0xffc860, district: 2 },
  { id: 'lime', name: 'Toxic Lime', body: 0xf0ffd6, accent: 0xb6ff3b, glow: 0xb6ff3b, district: 3 },
  { id: 'violet', name: 'Ultraviolet', body: 0xeadfff, accent: 0xa66bff, glow: 0xa66bff, district: 4 },
  { id: 'white', name: 'Ghost White', body: 0xffffff, accent: 0xff3b5c, glow: 0xffffff, district: 5 },
];

export const DARK_BODY = 0x1a1626;
export const GLASS = 0x0b0914;

export function designById(id: string): CarDesign {
  return CAR_DESIGNS.find((d) => d.id === id) ?? (CAR_DESIGNS[0] as CarDesign);
}

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? (PALETTES[0] as Palette);
}

export function pieceColor(layer: Layer, palette: Palette): number {
  switch (layer) {
    case 'body':
      return palette.body;
    case 'accent':
      return palette.accent;
    case 'dark':
      return DARK_BODY;
    case 'glass':
      return GLASS;
  }
}

/** The design as SVG markup, for the garage preview (same art as the in-game car). */
export function designSvg(design: CarDesign, palette: Palette): string {
  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  const shapes = design.pieces
    .map((piece) => {
      const points = piece.pts.reduce<string[]>((acc, v, i) => {
        if (i % 2 === 0) acc.push(`${v},${piece.pts[i + 1]}`);
        return acc;
      }, []);
      return `<polygon points="${points.join(' ')}" fill="${hex(pieceColor(piece.layer, palette))}"/>`;
    })
    .join('');
  return `<svg viewBox="-22 -13 44 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shapes}</svg>`;
}
