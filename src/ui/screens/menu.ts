import type { AppContext, ScreenView } from '../../app/context';
import { stageById } from '../../game/levels/catalog';
import { dateKey } from '../../services/progress';
import { endlessUnlocked, MAX_STARS, nextToPlay, totalStars } from '../../services/unlocks';
import { formatScore, h } from '../dom';
import { icon, type IconName } from '../icons';

interface MenuButton {
  label: string;
  icon: IconName;
  onClick: () => void;
  locked?: boolean;
  note?: string;
}

function menuButton(spec: MenuButton): HTMLElement {
  const note = spec.note
    ? h('small', { class: 'muted', style: 'display:block;font-size:.62rem;letter-spacing:0' }, spec.note)
    : null;
  return h('button', {
    class: 'btn',
    type: 'button',
    'aria-disabled': spec.locked ? 'true' : undefined,
    onClick: spec.onClick,
  }, icon(spec.locked ? 'lock' : spec.icon), h('span', {}, spec.label, note));
}

function playButton(ctx: AppContext): HTMLElement {
  const progress = ctx.progress.value;
  const next = stageById(nextToPlay(progress));
  const caption = next
    ? h('small', { style: 'display:block;font-size:.62rem;letter-spacing:.04em;opacity:.85' }, `${next.id} · ${next.name}`)
    : null;
  return h('button', {
    class: 'btn btn--primary btn--big btn--block',
    type: 'button',
    onClick: () => next && ctx.nav.playStage(next.id),
  }, icon('play'), h('span', {}, Object.keys(progress.stages).length > 0 ? 'Continue' : 'Play', caption));
}

function soundButton(ctx: AppContext): HTMLElement {
  const muted = ctx.settings.value.muted;
  return h('button', {
    class: 'btn btn--icon btn--ghost',
    type: 'button',
    'aria-label': muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off',
    onClick: () => {
      ctx.settings.update({ muted: !muted });
      ctx.nav.show('menu');
    },
  }, icon(muted ? 'mute' : 'sound'));
}

function grid(ctx: AppContext): HTMLElement {
  const progress = ctx.progress.value;
  const open = endlessUnlocked(progress);
  const today = dateKey(ctx.now());
  const dailyDone = progress.daily[today]?.finished === true;
  const locked = (): void => ctx.toast('Clear all ten stages of Electric Alley to unlock this.');
  return h('div', { class: 'menu__grid' },
    menuButton({ label: 'Stages', icon: 'car', onClick: () => ctx.nav.show('stages') }),
    menuButton({
      label: 'Endless', icon: 'infinity', locked: !open, onClick: () => (open ? ctx.nav.playEndless() : locked()),
      note: open ? `Best ${formatScore(progress.endless.best)}` : undefined,
    }),
    menuButton({
      label: 'Daily', icon: 'calendar', locked: !open, onClick: () => (open ? ctx.nav.playDaily() : locked()),
      note: open ? (dailyDone ? 'Done today' : today) : undefined,
    }),
    menuButton({ label: 'Garage', icon: 'settings', onClick: () => ctx.nav.show('garage') }),
    menuButton({ label: 'Trophies', icon: 'trophy', onClick: () => ctx.nav.show('achievements') }),
    menuButton({ label: 'Boards', icon: 'medal', onClick: () => ctx.nav.show('boards') }),
  );
}

export function buildMenu(ctx: AppContext): ScreenView {
  const progress = ctx.progress.value;
  const iconButton = (label: string, name: IconName, onClick: () => void): HTMLElement =>
    h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': label, onClick }, icon(name));
  const el = h('main', { class: 'screen screen--clear', 'aria-label': 'Main menu' },
    h('div', { class: 'screen__head' },
      h('span', { class: 'chip', title: 'Stars earned' }, icon('star'), `${totalStars(progress)} / ${MAX_STARS}`),
      h('span', { style: 'flex:1' }),
      soundButton(ctx),
    ),
    h('div', {},
      h('h1', { class: 'logo display', tabindex: '-1' }, h('span', {}, 'Neon'), h('b', {}, 'Drift')),
      h('p', { class: 'tagline' }, 'One thumb. Pure drift.'),
    ),
    h('div', { class: 'menu__spacer' }),
    playButton(ctx),
    grid(ctx),
    h('div', { class: 'menu__foot' },
      h('div', { class: 'row' },
        iconButton('How to play', 'help', () => ctx.nav.show('howto')),
        iconButton('Settings', 'settings', () => ctx.nav.show('settings')),
      ),
      h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => ctx.nav.show('credits') }, icon('info'), 'About'),
    ),
  );
  if (!ctx.progress.saveWorks) {
    el.append(h('p', { class: 'menu__best', role: 'status' }, 'Saving is blocked in this browser: progress will not be kept.'));
  }
  return { el, title: 'Main menu' };
}
