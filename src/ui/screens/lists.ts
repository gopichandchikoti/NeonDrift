import type { AppContext, ScreenView } from '../../app/context';
import { ACHIEVEMENTS } from '../../game/achievements';
import type { ScoreEntry } from '../../services/progress-model';
import { dateKey } from '../../services/progress';
import { formatScore, h } from '../dom';
import { icon } from '../icons';

function header(ctx: AppContext, title: string, right?: HTMLElement): HTMLElement {
  return h('div', { class: 'screen__head' },
    h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': 'Back', onClick: () => ctx.nav.back() }, icon('back')),
    h('h1', { class: 'display', tabindex: '-1' }, title),
    right,
  );
}

export function buildAchievements(ctx: AppContext): ScreenView {
  const unlocked = ctx.progress.value.achievements;
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const items = ACHIEVEMENTS.map((a) => {
    const when = unlocked[a.id];
    return h('li', { class: when ? 'row-card row-card--done' : 'row-card' },
      icon(when ? 'trophy' : 'lock'),
      h('div', {}, h('b', {}, a.name), h('small', {}, a.description + (when ? ` · ${when}` : ''))),
    );
  });
  const el = h('main', { class: 'screen', 'aria-label': 'Trophies' },
    header(ctx, 'Trophies', h('span', { class: 'chip' }, `${done} / ${ACHIEVEMENTS.length}`)),
    h('ul', { class: 'list' }, ...items),
  );
  return { el, title: 'Trophies' };
}

function board(title: string, entries: readonly ScoreEntry[], empty: string): HTMLElement {
  const rows = entries.length === 0
    ? [h('li', { class: 'muted', style: 'font-size:.85rem' }, empty)]
    : entries.map((e, i) => h('li', { class: 'row-card' },
      h('b', { style: 'min-width:1.6rem' }, `${i + 1}.`),
      h('div', { style: 'flex:1' }, h('b', {}, formatScore(e.score)), h('small', {}, `${e.date} · ${formatScore(e.distance)} units`)),
    ));
  return h('section', { class: 'panel' },
    h('h2', { class: 'display', style: 'font-size:.85rem;margin:0 0 .5rem;color:var(--cyan)' }, title),
    h('ol', { class: 'list', style: 'list-style:none;padding:0' }, ...rows));
}

/** Personal bests and the local top ten. Nothing here is online: it is this device's own record. */
export function buildBoards(ctx: AppContext): ScreenView {
  const p = ctx.progress.value;
  const today = dateKey(ctx.now());
  const t = p.totals;
  const el = h('main', { class: 'screen', 'aria-label': 'Personal bests' },
    header(ctx, 'Boards'),
    h('p', { class: 'muted', style: 'margin:0;font-size:.8rem' }, 'These are your own scores on this device. There is no online ranking.'),
    board('Endless: top 10', p.leaderboard.endless, 'No endless runs yet.'),
    board('Daily challenge: top 10', p.leaderboard.daily, 'No daily runs yet.'),
    h('section', { class: 'panel' },
      h('h2', { class: 'display', style: 'font-size:.85rem;margin:0 0 .5rem;color:var(--cyan)' }, 'Lifetime'),
      h('dl', { class: 'stats' },
        ...[
          ['Runs', t.runs], ['Finishes', t.finishes], ['Crashes', t.crashes],
          ['Near misses', t.nearMisses], ['Sparks', t.sparks], ['Cars passed', t.trafficPassed],
          ['Best combo', `x${t.bestCombo}`], ['Drift points', t.driftPoints], ['Daily streak', p.dailyStreak.count],
        ].map(([label, value]) => h('div', {}, h('dt', {}, String(label)), h('dd', {}, typeof value === 'number' ? formatScore(value) : String(value)))),
      ),
      h('p', { class: 'muted', style: 'margin:.5rem 0 0;font-size:.75rem' }, `Today is ${today}.`),
    ),
  );
  return { el, title: 'Personal bests' };
}
