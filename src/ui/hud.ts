import type { Session } from '../game/session';
import { objectiveHudText, objectiveProgress } from '../game/levels/objectives';
import { comboHeat } from '../game/systems/combo';
import { RULES, SIM_HZ } from '../game/physics/constants';
import { VIEW } from '../game/scenes/camera';
import type { ControlScheme } from '../services/settings';
import { clear, formatScore, h } from './dom';
import { icon } from './icons';

export interface HudHooks {
  pause: () => void;
  boost: () => void;
  steer: (side: 'left' | 'right', down: boolean) => void;
}

/**
 * The in-run display. It is built once per run and updated in place, only touching the DOM when a value changes, so
 * it costs almost nothing per frame. Nothing sits in the middle of the screen: the road stays fully visible.
 */
export class Hud {
  readonly el: HTMLElement;
  private readonly score = h('output', { 'aria-label': 'Score' }, '0');
  private readonly level = h('span', { class: 'combo__level' }, 'x1');
  private readonly pips = h('div', { class: 'combo__pips', 'aria-hidden': 'true' });
  private readonly decay = h('span', {});
  private readonly combo = h('div', { class: 'combo', role: 'status', 'aria-label': 'Combo multiplier 1' });
  private readonly progress = h('span', {});
  private readonly objective = h('div', { class: 'objective' });
  private readonly objectiveText = h('span', {});
  private readonly objectiveBar = h('span', {});
  private readonly status = h('div', { class: 'hud__status' });
  private readonly boost: HTMLElement;
  private readonly hint = h('div', { class: 'hint', role: 'status', hidden: true });
  private readonly popups = h('div', { class: 'popups', 'aria-hidden': 'true' });
  private readonly flashEl = h('div', { class: 'flash', 'aria-hidden': 'true' });
  private last = new Map<string, string>();
  private lastPips = '';

  constructor(hooks: HudHooks, scheme: ControlScheme, private readonly showObjective: boolean) {
    this.boost = h('button', { class: 'boost', type: 'button', 'aria-label': 'Boost', onPointerdown: (e: Event) => {
      e.stopPropagation();
      hooks.boost();
    } }, icon('boost'));
    const pause = h('button', { class: 'btn btn--icon hud__pause', type: 'button', 'aria-label': 'Pause', onClick: hooks.pause }, icon('pause'));
    this.combo.append(this.level, this.pips, h('div', { class: 'combo__decay', 'aria-hidden': 'true' }, this.decay));
    this.objective.append(this.objectiveText, h('div', { class: 'meter', 'aria-hidden': 'true' }, this.objectiveBar));
    const bar = h('div', { class: 'hud__bar' },
      h('div', { class: 'meter', 'aria-hidden': 'true' }, this.progress),
      showObjective ? this.objective : null,
      this.status,
    );
    this.el = h('section', { class: 'hud', 'aria-label': 'Heads-up display' },
      h('div', { class: 'vignette', 'aria-hidden': 'true' }),
      this.popups,
      h('div', { class: 'hud__top' },
        h('div', { class: 'hud__score' }, h('div', { class: 'hud__label' }, 'Score'), this.score),
        this.combo,
        pause,
      ),
      bar,
      this.hint,
      h('div', { class: 'hud__bottom' }, ...this.bottom(scheme, hooks)),
      this.flashEl,
    );
  }

  private bottom(scheme: ControlScheme, hooks: HudHooks): HTMLElement[] {
    if (scheme === 'thumb') return [this.boost];
    const pad = (side: 'left' | 'right'): HTMLElement => {
      const button = h('button', { class: 'steer', type: 'button', 'aria-label': `Steer ${side}` }, icon(side));
      button.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        button.setPointerCapture?.(e.pointerId);
        button.classList.add('down');
        hooks.steer(side, true);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, () => {
          button.classList.remove('down');
          hooks.steer(side, false);
        });
      }
      return button;
    };
    return [pad('left'), this.boost, pad('right')];
  }

  private set(key: string, value: string, apply: () => void): void {
    if (this.last.get(key) === value) return;
    this.last.set(key, value);
    apply();
  }

  update(session: Session): void {
    const w = session.world;
    this.set('score', String(w.stats.score), () => {
      this.score.textContent = formatScore(w.stats.score);
    });
    this.updateCombo(session);
    const finish = w.rules.finishS;
    const fraction = finish === null ? 0 : Math.min(1, w.s / finish);
    this.set('progress', fraction.toFixed(3), () => {
      (this.progress as HTMLElement).style.cssText = `display:block;height:100%;width:${(fraction * 100).toFixed(1)}%;background:linear-gradient(90deg,#37e2ff,#ff3fa4)`;
    });
    if (finish === null) this.set('dist', String(Math.round(w.s / 10)), () => this.meterText(`${formatScore(w.s)} units`));
    this.updateObjective(session);
    this.updateStatus(session);
    this.updateBoost(session);
    this.updateHint(session);
  }

  private meterText(text: string): void {
    this.objectiveText.textContent = text;
  }

  private updateCombo(session: Session): void {
    const c = session.world.combo;
    this.set('combo', `${c.level}.${c.pips}`, () => {
      this.level.textContent = `x${c.level}`;
      this.combo.setAttribute('aria-label', `Combo multiplier ${c.level}`);
    });
    const pips = Array.from({ length: RULES.comboPips }, (_, i) => (i < c.pips ? 'on' : '')).join(',');
    if (pips !== this.lastPips) {
      this.lastPips = pips;
      clear(this.pips);
      for (let i = 0; i < RULES.comboPips; i++) this.pips.append(h('i', { class: i < c.pips ? 'on' : '' }));
    }
    const heat = comboHeat(c);
    this.set('decay', heat.toFixed(2), () => {
      (this.decay as HTMLElement).style.cssText = `display:block;height:100%;width:${(heat * 100).toFixed(0)}%`;
    });
  }

  private updateObjective(session: Session): void {
    const stage = session.stage;
    if (!stage || !this.showObjective) return;
    const p = objectiveProgress(stage, session.world.stats);
    const kind = stage.objective.kind;
    const text = objectiveHudText(stage, p);
    this.set('objective', `${text}|${p.met}`, () => {
      this.objectiveText.textContent = text;
      this.objective.classList.toggle('objective--met', p.met && kind !== 'time' && kind !== 'finish');
    });
    const fraction = kind === 'finish' ? 0 : p.fraction;
    this.set('obar', fraction.toFixed(2), () => {
      (this.objectiveBar as HTMLElement).style.cssText = `display:block;height:100%;width:${(fraction * 100).toFixed(0)}%;background:${p.met ? '#b6ff3b' : 'linear-gradient(90deg,#37e2ff,#ff3fa4)'}`;
    });
  }

  private updateStatus(session: Session): void {
    const w = session.world;
    const key = `${w.shield}|${Math.ceil(w.magnetTicks / SIM_HZ)}`;
    this.set('status', key, () => {
      clear(this.status);
      if (w.shield) this.status.append(h('span', { class: 'chip chip--shield' }, icon('check'), 'Shield'));
      if (w.magnetTicks > 0) this.status.append(h('span', { class: 'chip chip--magnet' }, `Magnet ${Math.ceil(w.magnetTicks / SIM_HZ)} s`));
    });
  }

  private updateBoost(session: Session): void {
    const w = session.world;
    const active = w.boostTicks > 0;
    const fill = active ? w.boostTicks / (RULES.boostTime * SIM_HZ) : w.boostMeter;
    this.set('boost', `${fill.toFixed(2)}|${active}`, () => {
      this.boost.style.setProperty('--fill', fill.toFixed(3));
      this.boost.classList.toggle('boost--ready', !active && w.boostMeter >= 1);
      this.boost.classList.toggle('boost--active', active);
      this.boost.setAttribute('aria-label', active ? 'Boost active' : w.boostMeter >= 1 ? 'Boost ready' : `Boost charging ${Math.round(w.boostMeter * 100)} percent`);
    });
  }

  private updateHint(session: Session): void {
    const text = session.cue?.text ?? '';
    this.set('hint', text, () => {
      this.hint.hidden = text === '';
      this.hint.textContent = text;
    });
  }

  pulseCombo(): void {
    this.combo.classList.add('combo--pop');
    setTimeout(() => this.combo.classList.remove('combo--pop'), 160);
  }

  flash(): void {
    this.flashEl.classList.remove('flash--on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('flash--on');
  }

  /** A floating label at a canvas position (the canvas is 540 wide and VIEW.height tall). */
  popup(text: string, x: number, y: number, kind: string): void {
    const el = h('div', { class: `popup popup--${kind}`, style: `left:${(x / VIEW.width) * 100}%;top:${(y / VIEW.height) * 100}%` }, text);
    this.popups.append(el);
    setTimeout(() => el.remove(), 950);
    while (this.popups.childElementCount > 8) this.popups.firstElementChild?.remove();
  }
}
