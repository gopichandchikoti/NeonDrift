import type { AppContext, ScreenView } from '../../app/context';
import { stageById, stagesOfDistrict } from '../../game/levels/catalog';
import { DISTRICTS, type District } from '../../game/levels/districts';
import { objectiveSentence } from '../../game/levels/objectives';
import type { Stage } from '../../game/levels/types';
import { SIM_HZ } from '../../game/physics/constants';
import { STAGE_DEFS } from '../../game/levels/stages';
import { districtCleared, stageUnlocked, totalStars } from '../../services/unlocks';
import { clear, formatScore, formatTime, h } from '../dom';
import { icon, starIcon } from '../icons';

const accent = (d: District): string => `--accent:#${d.theme.edgeLeft.toString(16).padStart(6, '0')}`;

function districtOpen(ctx: AppContext, d: District): boolean {
  const first = stagesOfDistrict(d.id)[0];
  return first !== undefined && stageUnlocked(ctx.progress.value, first.id);
}

function stageSheet(ctx: AppContext, stage: Stage): void {
  const record = ctx.progress.value.stages[stage.id];
  const district = DISTRICTS[stage.district - 1] as District;
  const body = h('div', { class: 'prose', style: accent(district) },
    h('p', {}, stage.note),
    h('h2', {}, 'Objective'),
    h('p', {}, `Finish the stage and: ${objectiveSentence(stage)}.`),
    h('h2', {}, 'Stars'),
    h('ul', {},
      h('li', {}, '1 star: clear the stage'),
      h('li', {}, `2 stars: score ${formatScore(stage.stars[0])}`),
      h('li', {}, `3 stars: score ${formatScore(stage.stars[1])}`),
    ),
    record
      ? h('p', { class: 'muted' }, `Best ${formatScore(record.bestScore)}` +
        (record.bestTicks ? ` · fastest ${formatTime(record.bestTicks / SIM_HZ)}` : '') + ` · ${record.attempts} attempts`)
      : h('p', { class: 'muted' }, 'Not played yet.'),
  );
  ctx.dialogs.open({
    title: `${stage.id} ${stage.name}`,
    body,
    actions: [
      { label: 'Back', kind: 'ghost', onClick: () => undefined },
      { label: record?.cleared ? 'Play again' : 'Start', kind: 'primary', onClick: () => ctx.nav.playStage(stage.id) },
    ],
  });
}

function tile(ctx: AppContext, stage: Stage, district: District, current: string): HTMLElement {
  const progress = ctx.progress.value;
  const open = stageUnlocked(progress, stage.id);
  const record = progress.stages[stage.id];
  const stars = record?.stars ?? 0;
  const label = open
    ? `Stage ${stage.id} ${stage.name}, ${stars} of 3 stars${record?.cleared ? ', cleared' : ''}`
    : `Stage ${stage.id} ${stage.name}, locked`;
  const onClick = (): void => {
    if (open) stageSheet(ctx, stage);
    else {
      const prev = STAGE_DEFS[STAGE_DEFS.findIndex((s) => s.id === stage.id) - 1];
      ctx.toast(`Clear stage ${prev?.id ?? ''} first.`);
    }
  };
  return h('button', {
    class: stage.id === current ? 'tile tile--current' : 'tile',
    type: 'button',
    style: accent(district),
    'aria-label': label,
    'aria-disabled': open ? undefined : 'true',
    onClick,
  },
    h('span', { class: 'tile__num' }, stage.id),
    ' ',
    h('span', { class: 'tile__name' }, stage.name),
    ' ',
    h('span', { class: 'tile__stars' }, open ? [1, 2, 3].map((n) => starIcon(n <= stars)) : [icon('lock')]),
  );
}

export function buildStages(ctx: AppContext, params: { district?: number } = {}): ScreenView {
  const progress = ctx.progress.value;
  const last = progress.lastStage ? stageById(progress.lastStage) : undefined;
  let selected = params.district ?? last?.district ?? 1;
  const current = last?.id ?? '';
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Districts' });
  const card = h('section', { class: 'panel district-card' });
  const grid = h('ul', { class: 'stage-grid' });

  const render = (): void => {
    const district = DISTRICTS[selected - 1] as District;
    clear(tabs);
    for (const d of DISTRICTS) {
      const open = districtOpen(ctx, d);
      tabs.append(h('button', {
        class: 'tab', type: 'button', role: 'tab', style: accent(d),
        'aria-selected': String(d.id === selected), 'aria-disabled': open ? undefined : 'true',
        onClick: () => {
          if (!open) ctx.toast(`Clear every stage of ${DISTRICTS[d.id - 2]?.name ?? 'the last district'} first.`);
          else {
            selected = d.id;
            render();
          }
        },
      }, h('i', { class: 'dot' }), `${d.id}. ${d.name}`, districtCleared(progress, d.id) ? icon('check') : null));
    }
    clear(card);
    card.setAttribute('style', accent(district));
    card.append(
      h('div', { class: 'teach' }, `New: ${district.teaches}`),
      h('h2', { class: 'display' }, district.name),
      h('p', {}, district.blurb),
    );
    clear(grid);
    for (const stage of stagesOfDistrict(selected)) grid.append(h('li', {}, tile(ctx, stage, district, current)));
  };
  render();

  const el = h('main', { class: 'screen', 'aria-label': 'Stage select' },
    h('div', { class: 'screen__head' },
      h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': 'Back', onClick: () => ctx.nav.back() }, icon('back')),
      h('h1', { class: 'display', tabindex: '-1' }, 'Stages'),
      h('span', { class: 'chip' }, icon('star'), String(totalStars(progress))),
    ),
    tabs,
    card,
    grid,
  );
  return { el, title: 'Stage select' };
}
