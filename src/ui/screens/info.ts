import type { AppContext, ScreenView } from '../../app/context';
import { h, svg } from '../dom';
import { icon } from '../icons';

const S = 'viewBox="0 0 40 40" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/** The same shapes the game draws, so the legend teaches what the player will actually see. */
const LEGEND: Array<[string, string, string]> = [
  [`<svg ${S} stroke="#ff8a2b"><path d="M20 8l9 22H11z" fill="#ff8a2b33"/></svg>`, 'Cone', 'A triangle. Tap it and you crash, so pass it close for a near miss instead.'],
  [`<svg ${S} stroke="#ff3b5c"><rect x="6" y="12" width="28" height="16" rx="2" fill="#ff3b5c22"/><path d="M12 28l8-16M20 28l8-16" stroke="#ffd0d8"/></svg>`, 'Block', 'A hatched slab. It is wide: pick a side early.'],
  [`<svg ${S} stroke="#ffc13b"><rect x="8" y="16" width="24" height="8" rx="2" fill="#ffc13b22"/><path d="M5 20h30" stroke-dasharray="2 4" opacity=".6"/></svg>`, 'Gate', 'A bar that slides across the road on a steady beat. Both side lanes always stay open.'],
  [`<svg ${S} stroke="#dad4ff"><path d="M33 20l-8-8H11l-4 4v8l4 4h14z" fill="#2a2740"/><circle cx="33" cy="12" r="3" fill="#ffc13b" stroke="none"/></svg>`, 'Traffic', 'A slower car. An amber blinker means it will change lane about half a second later.'],
  [`<svg ${S} stroke="#fff36b"><path d="M20 7l7 13-7 13-7-13z" fill="#fff36b"/></svg>`, 'Spark', 'Collect for points. A trail of them marks a good racing line.'],
  [`<svg ${S} stroke="#37e2ff"><path d="M20 6l11 6v12l-11 10-11-10V12z" fill="#37e2ff33"/></svg>`, 'Shield', 'Absorbs one hit, then you get a brief grace period.'],
  [`<svg ${S} stroke="#ff3fa4"><path d="M10 28V16a10 10 0 0 1 20 0v12"/><path d="M8 28h5M27 28h5" stroke="#fff"/></svg>`, 'Magnet', 'Pulls nearby sparks to you for six seconds.'],
];

function legend(): HTMLElement {
  const root = h('div', { class: 'legend' });
  for (const [art, name, text] of LEGEND) {
    root.append(svg(art), h('div', {}, h('b', {}, name), h('div', { class: 'muted', style: 'font-size:.8rem;font-weight:500' }, text)));
  }
  return root;
}

export function howToContent(): HTMLElement {
  return h('div', { class: 'prose' },
    h('h2', {}, 'Steer with one thumb'),
    h('ul', {},
      h('li', {}, h('b', {}, 'Hold'), ' anywhere on the screen to turn the car into the next bend. The direction is chosen for you.'),
      h('li', {}, h('b', {}, 'Release'), ' to straighten out. Short taps nudge the car; long holds make it slide.'),
      h('li', {}, 'Prefer buttons or a keyboard? Turn on Left / right in Settings, or use A / D or the arrow keys.'),
    ),
    h('h2', {}, 'Score'),
    h('ul', {},
      h('li', {}, h('b', {}, 'Drift'), ': slide sideways for points. The wider and longer, the more you earn.'),
      h('li', {}, h('b', {}, 'Near miss'), ': pass a hazard closely. ', h('b', {}, 'Edge kiss'), ': graze the barrier while drifting.'),
      h('li', {}, 'Clean moves build the ', h('b', {}, 'combo'), ' (up to x8). A crash or scrape breaks it, and it fades if you go quiet.'),
      h('li', {}, 'Charge the ', h('b', {}, 'boost'), ' ring with drifts, near misses and sparks, then tap the boost button or press Shift.'),
    ),
    h('h2', {}, 'What you will see'),
    legend(),
    h('h2', {}, 'Stars'),
    h('p', {}, 'Clear a stage by reaching the finish and meeting its objective: one star. Beat the score targets for two and three.'),
  );
}

export function buildHowTo(ctx: AppContext): ScreenView {
  const el = h('main', { class: 'screen', 'aria-label': 'How to play' },
    h('div', { class: 'screen__head' },
      h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': 'Back', onClick: () => ctx.nav.back() }, icon('back')),
      h('h1', { class: 'display', tabindex: '-1' }, 'How to play'),
    ),
    howToContent(),
  );
  return { el, title: 'How to play' };
}

export function buildCredits(ctx: AppContext): ScreenView {
  const el = h('main', { class: 'screen', 'aria-label': 'About and privacy' },
    h('div', { class: 'screen__head' },
      h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': 'Back', onClick: () => ctx.nav.back() }, icon('back')),
      h('h1', { class: 'display', tabindex: '-1' }, 'About'),
    ),
    h('div', { class: 'prose' },
      h('h2', {}, `Neon Drift ${ctx.version}`),
      h('p', {}, 'A one-thumb neon drifting game. Sixty stages, endless mode and a daily challenge, all playable offline.'),
      h('h2', {}, 'Privacy'),
      h('ul', {},
        h('li', {}, 'No account, no ads, no analytics and no network access. The Android app does not even request the internet permission.'),
        h('li', {}, 'Your progress and settings are stored only on this device. Export and import are manual and local.'),
        h('li', {}, 'The leaderboards and the daily challenge are local: the daily course comes from the date on your device, not from a server.'),
      ),
      h('h2', {}, 'Made with'),
      h('ul', {},
        h('li', {}, 'All graphics are drawn in code and all sound and music are synthesised live. There are no third-party images, audio files or car artwork, and no real-world brands.'),
        h('li', {}, 'Phaser 3 game engine (MIT licence), Capacitor (MIT) for the Android app.'),
        h('li', {}, 'Fonts: Unbounded and Manrope (SIL Open Font License 1.1), bundled locally.'),
      ),
    ),
  );
  return { el, title: 'About' };
}
