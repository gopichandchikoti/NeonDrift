/**
 * The Neon Drift icon, drawn once in code and reused for the launcher icons, the splash screen and the README.
 * Everything here is original: two neon drift trails sweeping through a bend, with a small car at the apex.
 */
export const COLORS = {
  bg: '#07060d',
  panel: '#12101c',
  cyan: '#37e2ff',
  magenta: '#ff3fa4',
  yellow: '#fff36b',
  text: '#f2eeff',
};

/** A soft glow behind the mark, plus a faint perspective grid, on a 108 x 108 canvas. */
export const BACKDROP = `
  <defs>
    <radialGradient id="halo" cx="54" cy="54" r="54" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff3fa4" stop-opacity="0.26"/>
      <stop offset="0.55" stop-color="#37e2ff" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#07060d" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="108" height="108" fill="url(#halo)"/>
  <g stroke="#37e2ff" stroke-opacity="0.12" stroke-width="0.6">
    <path d="M0 78H108M0 88H108M0 99H108"/>
    <path d="M54 66V108M30 66L8 108M78 66L100 108M12 66L-20 108M96 66L128 108"/>
  </g>`;

/** The mark: two parallel drift trails and the car. It stays inside the 66 x 66 centre so every icon shape keeps it. */
export const MARK = `
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.6"/>
    </filter>
  </defs>
  <g fill="none" stroke-linecap="round">
    <path d="M27 77 C 41 77 47 67 49 56 C 51 44 58 36 76 34" stroke="#ff3fa4" stroke-width="9" opacity="0.55" filter="url(#glow)"/>
    <path d="M27 77 C 41 77 47 67 49 56 C 51 44 58 36 76 34" stroke="#ff3fa4" stroke-width="5.2"/>
    <path d="M27 67 C 37 67 41 60 43 52 C 45 43 51 38 64 36" stroke="#37e2ff" stroke-width="7" opacity="0.55" filter="url(#glow)"/>
    <path d="M27 67 C 37 67 41 60 43 52 C 45 43 51 38 64 36" stroke="#37e2ff" stroke-width="3.6"/>
  </g>
  <g transform="translate(78 33) rotate(-14) scale(0.95)">
    <path d="M17 0 L8 -8 L-14 -9 L-17 -5 L-17 5 L-14 9 L8 8 Z" fill="#dff7ff"/>
    <path d="M5 -4.5 L-4 -5.5 L-4 5.5 L5 4.5 Z" fill="#0b0914"/>
    <path d="M-17 -2 L-7 -2 L-7 2 L-17 2 Z" fill="#ff3fa4"/>
  </g>`;

export function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="100%" height="100%">${inner}</svg>`;
}
