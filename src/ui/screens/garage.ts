import type { AppContext, ScreenView } from '../../app/context';
import { CAR_DESIGNS, PALETTES, designById, designSvg, paletteById, type Palette } from '../../game/cosmetics';
import { DISTRICTS } from '../../game/levels/districts';
import { carUnlocked, paletteUnlocked, totalStars } from '../../services/unlocks';
import { clear, h, svg } from '../dom';
import { icon } from '../icons';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

interface Choice {
  index: number;
  paletteId: string;
}

function statusText(ctx: AppContext, choice: Choice): string {
  const design = CAR_DESIGNS[choice.index] ?? designById('pulse');
  const garage = ctx.progress.value.garage;
  if (!carUnlocked(ctx.progress.value, design)) {
    return `Locked: earn ${design.stars} stars (you have ${totalStars(ctx.progress.value)}).`;
  }
  return design.id === garage.car && choice.paletteId === garage.palette ? 'Equipped' : 'Tap Equip to drive it.';
}

function swatch(ctx: AppContext, p: Palette, choice: Choice, redraw: () => void): HTMLElement {
  const open = paletteUnlocked(ctx.progress.value, p);
  const need = DISTRICTS[p.district - 1]?.name ?? '';
  const onClick = (): void => {
    if (!open) return ctx.toast(`Clear ${need} to unlock ${p.name}.`);
    choice.paletteId = p.id;
    redraw();
  };
  return h('button', {
    class: 'swatch', type: 'button', 'aria-pressed': String(p.id === choice.paletteId),
    'aria-disabled': open ? undefined : 'true', 'aria-label': open ? p.name : `${p.name}, locked: clear ${need}`, onClick,
  }, h('i', { style: `background:${hex(p.accent)}` }), open ? p.name : [icon('lock'), p.name]);
}

export function buildGarage(ctx: AppContext): ScreenView {
  const garage = ctx.progress.value.garage;
  const index = Math.max(0, CAR_DESIGNS.findIndex((c) => c.id === garage.car));
  const choice: Choice = { index, paletteId: garage.palette };
  const stage = h('div', { class: 'garage__car' });
  const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Colours' });
  const status = h('p', { class: 'muted', role: 'status', style: 'text-align:center;margin:0;font-size:.82rem' });
  const equip = h('button', { class: 'btn btn--primary btn--block', type: 'button', onClick: () => doEquip() }, icon('check'), 'Equip');

  const render = (): void => {
    const design = CAR_DESIGNS[choice.index] ?? designById('pulse');
    const palette = paletteById(choice.paletteId);
    clear(stage);
    stage.style.setProperty('--glow', hex(palette.glow));
    stage.append(svg(designSvg(design, palette)), h('h2', { class: 'display' }, design.name),
      h('span', { class: 'muted', style: 'font-size:.82rem' }, design.tagline));
    status.textContent = statusText(ctx, choice);
    clear(swatches);
    for (const p of PALETTES) swatches.append(swatch(ctx, p, choice, render));
    equip.disabled = !carUnlocked(ctx.progress.value, design);
  };
  const doEquip = (): void => {
    const design = CAR_DESIGNS[choice.index] ?? designById('pulse');
    ctx.progress.update((p) => {
      p.garage = { car: design.id, palette: choice.paletteId };
    });
    ctx.audio.sfx.play('confirm');
    render();
  };
  const step = (delta: number) => (): void => {
    choice.index = (choice.index + delta + CAR_DESIGNS.length) % CAR_DESIGNS.length;
    ctx.audio.sfx.play('tap');
    render();
  };
  const arrow = (label: string, name: 'left' | 'right', delta: number): HTMLElement =>
    h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': label, onClick: step(delta) }, icon(name));
  const el = h('main', { class: 'screen', 'aria-label': 'Garage' },
    h('div', { class: 'screen__head' },
      h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': 'Back', onClick: () => ctx.nav.back() }, icon('back')),
      h('h1', { class: 'display', tabindex: '-1' }, 'Garage'),
    ),
    h('div', { class: 'garage__stage' }, arrow('Previous car', 'left', -1), stage, arrow('Next car', 'right', 1)),
    status, swatches, equip,
    h('p', { class: 'muted', style: 'font-size:.75rem;margin:0' }, 'Every car handles exactly the same. This is only about style.'),
  );
  render();
  return { el, title: 'Garage' };
}
