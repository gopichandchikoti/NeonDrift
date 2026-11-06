// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STAGE_DEFS } from '../src/game/levels/stages';
import { stageById } from '../src/game/levels/catalog';
import { Session } from '../src/game/session';
import { createStageWorld } from '../src/game/levels/runner';
import { Dialogs } from '../src/ui/dialogs';
import { append, clear, formatScore, formatTime, h, svg } from '../src/ui/dom';
import { Hud } from '../src/ui/hud';
import { icon, starIcon } from '../src/ui/icons';
import { mount, stubBrowser } from './harness';

beforeEach(() => stubBrowser());

describe('dom helpers', () => {
  it('build elements with attributes, listeners, booleans and nested children', () => {
    const clicks: string[] = [];
    const el = h('button', { class: 'x', disabled: true, hidden: false, onClick: () => clicks.push('hit'), 'data-n': 3 },
      'Hi ', ['a', ['b']], null, false, undefined, h('b', {}, '!'));
    expect(el.className).toBe('x');
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.getAttribute('data-n')).toBe('3');
    expect(el.textContent).toBe('Hi ab!');
    el.removeAttribute('disabled');
    el.click();
    expect(clicks).toEqual(['hit']);
    clear(el);
    expect(el.childNodes).toHaveLength(0);
    append(el, ['z']);
    expect(el.textContent).toBe('z');
  });

  it('format scores and times for reading', () => {
    expect(formatScore(1234567.4)).toBe('1,234,567');
    expect(formatTime(75.34)).toBe('1:15.3');
    expect(formatTime(5)).toBe('0:05.0');
  });

  it('draw every icon, and fill the star when earned', () => {
    for (const name of ['pause', 'play', 'restart', 'home', 'settings', 'trophy', 'star', 'lock', 'left', 'right', 'back',
      'boost', 'car', 'calendar', 'infinity', 'close', 'sound', 'mute', 'check', 'info', 'medal', 'help'] as const) {
      const el = icon(name);
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.querySelector('path, rect, circle')).not.toBeNull();
    }
    expect(starIcon(true).getAttribute('class')).toContain('star--on');
    expect(starIcon(false).getAttribute('class')).toBe('star');
    expect(svg('<svg viewBox="0 0 1 1"></svg>').tagName.toLowerCase()).toBe('svg');
  });
});

describe('dialogs', () => {
  function setup(): { dialogs: Dialogs; layer: HTMLElement } {
    document.body.innerHTML = '<button id="before">before</button><div id="layer"></div>';
    const layer = document.getElementById('layer') as HTMLElement;
    return { dialogs: new Dialogs(layer), layer };
  }

  it('open with focus inside, trap Tab, close on Escape and return focus', () => {
    const { dialogs, layer } = setup();
    const before = document.getElementById('before') as HTMLElement;
    before.focus();
    const closed = vi.fn();
    dialogs.open({ title: 'Hello', body: h('p', {}, 'Body'), actions: [
      { label: 'One', onClick: () => undefined },
      { label: 'Two', kind: 'primary', onClick: () => undefined },
      { label: 'Three', kind: 'ghost', onClick: () => undefined },
    ], onClose: closed });
    const dialog = layer.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h2')?.id);
    const buttons = Array.from(dialog.querySelectorAll('button'));
    expect(document.activeElement).toBe(buttons[0]);
    buttons[2]?.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    buttons[2]?.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    buttons[0]?.dispatchEvent(back);
    expect(document.activeElement).toBe(buttons[2]);
    buttons[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(layer.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(dialogs.isOpen).toBe(false);
    expect(dialogs.closeTop()).toBe(false);
  });

  it('close from an action unless told to stay open, from the scrim, and all at once', () => {
    const { dialogs, layer } = setup();
    const picked: string[] = [];
    dialogs.open({ title: 'A', body: h('p', {}), actions: [
      { label: 'Stay', keepOpen: true, onClick: () => picked.push('stay') },
      { label: 'Go', onClick: () => picked.push('go') },
    ] });
    (layer.querySelectorAll('button')[0] as HTMLElement).click();
    expect(layer.querySelector('[role="dialog"]')).not.toBeNull();
    (layer.querySelectorAll('button')[1] as HTMLElement).click();
    expect(layer.querySelector('[role="dialog"]')).toBeNull();
    expect(picked).toEqual(['stay', 'go']);
    dialogs.open({ title: 'B', body: h('p', {}), center: true });
    const scrim = layer.querySelector('.scrim') as HTMLElement;
    expect(scrim.className).toContain('scrim--center');
    scrim.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(dialogs.isOpen).toBe(false);
    dialogs.open({ title: 'C', body: h('p', {}) });
    dialogs.open({ title: 'D', body: h('p', {}) });
    expect(layer.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    dialogs.closeAll();
    expect(layer.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });
});

describe('settings screen', () => {
  it('changes and saves every control', () => {
    const h2 = mount();
    h2.app.show('settings');
    const store = h2.app.ctx.settings;
    h2.ui.querySelector<HTMLElement>('.switch[role="switch"]')?.click(); // the first switch is Mute
    expect(store.value.muted).toBe(true);
    const range = (index: number, value: string): void => {
      const input = h2.ui.querySelectorAll<HTMLInputElement>('input[type="range"]')[index] as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    range(0, '0.3');
    range(1, '0.2');
    range(2, '1.1');
    range(3, '1.2');
    expect(store.value).toMatchObject({ musicVolume: 0.3, sfxVolume: 0.2, sensitivity: 1.1, uiScale: 1.2 });
    h2.click('Left / right');
    h2.click('Low');
    h2.click('Reduced');
    expect(store.value).toMatchObject({ controls: 'buttons', quality: 'low', motion: 'reduce' });
    const switches = Array.from(h2.ui.querySelectorAll<HTMLElement>('.switch'));
    switches[1]?.click();
    switches[2]?.click();
    expect(store.value).toMatchObject({ haptics: false, screenShake: false });
    expect(document.documentElement.dataset.motion).toBe('reduce');
    h2.click('Restore');
    expect(store.value.quality).toBe('auto');
  });

  it('exports the save as text, imports one back, rejects nonsense, and resets after a confirmation', () => {
    const h2 = mount({ progress: { stages: { '1-01': { stars: 3, bestScore: 900, bestTicks: 1, attempts: 2, cleared: true } } } });
    h2.app.show('settings');
    h2.click('Export');
    const text = (document.querySelector('textarea') as HTMLTextAreaElement).value;
    expect(JSON.parse(text)).toMatchObject({ game: 'neon-drift', progress: { stages: { '1-01': { stars: 3 } } } });
    h2.click('Close');
    h2.app.ctx.progress.reset();
    const inDialog = (name: string): HTMLElement =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button')).find((b) => b.textContent === name) as HTMLElement;
    h2.click('Import');
    (document.querySelector('textarea') as HTMLTextAreaElement).value = 'garbage';
    inDialog('Import').click();
    expect(document.querySelector('.toast')?.textContent).toContain('not a valid');
    h2.click('Import');
    (document.querySelector('textarea') as HTMLTextAreaElement).value = text;
    inDialog('Import').click();
    expect(h2.app.ctx.progress.value.stages['1-01']?.stars).toBe(3);
    h2.click('Reset');
    h2.click('Keep it');
    expect(h2.app.ctx.progress.value.stages['1-01']).toBeDefined();
    h2.click('Reset');
    h2.click('Erase');
    expect(h2.app.ctx.progress.value.stages['1-01']).toBeUndefined();
  });

  it('copies the exported text when the browser allows it, and says so when it does not', async () => {
    const h2 = mount();
    h2.app.show('settings');
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    h2.click('Export');
    h2.click('Copy');
    await Promise.resolve();
    expect(write).toHaveBeenCalled();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true });
    h2.click('Copy');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.textContent).toContain('copy it by hand');
  });
});

describe('garage', () => {
  it('shows what is locked and why, and equips what is earned', () => {
    const three = { stars: 3, bestScore: 1, bestTicks: null, attempts: 1, cleared: true };
    const stages = Object.fromEntries(STAGE_DEFS.slice(0, 10).map((s) => [s.id, three]));
    const h2 = mount({ progress: { stages } });
    h2.app.show('garage');
    expect(h2.ui.textContent).toContain('Pulse');
    expect(h2.ui.textContent).toContain('Equipped');
    h2.click('Next car');
    expect(h2.ui.textContent).toContain('Arrow');
    h2.click('Equip');
    expect(h2.app.ctx.progress.value.garage.car).toBe('arrow');
    for (let i = 0; i < 6; i++) h2.click('Next car');
    expect(h2.ui.textContent).toContain('Locked: earn');
    expect((h2.button('Equip') as HTMLButtonElement).disabled).toBe(true);
    h2.click('Previous car');
    h2.click(/^Magenta Burn/);
    h2.click(/Ultraviolet, locked/);
    expect(document.querySelector('.toast')?.textContent).toContain('to unlock Ultraviolet');
    h2.click('Next car');
    h2.click('Next car');
    h2.click('Next car');
  });
});

describe('information screens', () => {
  it('list trophies with their progress, boards with local scores, and the privacy statement', () => {
    const h2 = mount({
      progress: {
        achievements: { 'first-finish': '2026-11-04' },
        leaderboard: { endless: [{ score: 4200, date: '2026-11-03', distance: 9000 }], daily: [] },
        totals: { runs: 5, bestCombo: 4 },
      },
    });
    h2.app.show('achievements');
    expect(h2.ui.textContent).toContain('First Lap');
    expect(h2.ui.querySelectorAll('.row-card--done')).toHaveLength(1);
    h2.app.show('boards');
    expect(h2.ui.textContent).toContain('4,200');
    expect(h2.ui.textContent).toContain('No daily runs yet');
    expect(h2.ui.textContent).toContain('no online ranking');
    h2.app.show('credits');
    expect(h2.ui.textContent).toContain('does not even request the internet permission');
    expect(h2.ui.textContent).toContain('Unbounded and Manrope');
    h2.app.show('howto');
    expect(h2.ui.textContent).toContain('Hold');
    expect(h2.ui.querySelectorAll('.legend svg').length).toBe(7);
  });

  it('give every screen a heading, labelled buttons and a name', () => {
    const one = { stars: 1, bestScore: 1, bestTicks: null, attempts: 1, cleared: true };
    const h2 = mount({ progress: { stages: { '1-01': one } } });
    const nameOf = (button: Element): string => {
      const labelled = Array.from((button as HTMLButtonElement).labels ?? []).map((l) => l.textContent).join(' ');
      return (button.getAttribute('aria-label') ?? (button.textContent || labelled)).trim();
    };
    for (const name of ['menu', 'stages', 'garage', 'settings', 'achievements', 'boards', 'howto', 'credits'] as const) {
      h2.app.show(name);
      const screen = h2.ui.querySelector('main.screen');
      expect(screen?.getAttribute('aria-label'), name).toBeTruthy();
      expect(screen?.querySelector('h1'), name).not.toBeNull();
      const unnamed = Array.from(screen?.querySelectorAll('button') ?? []).filter((b) => nameOf(b).length === 0);
      expect(unnamed.map((b) => b.outerHTML.slice(0, 80)), name).toEqual([]);
      const unlabelled = Array.from(screen?.querySelectorAll('input') ?? []).filter((i) => !i.id);
      expect(unlabelled, name).toEqual([]);
    }
  });
});

describe('the HUD', () => {
  function hudFor(id: string): { hud: Hud; session: Session } {
    const stage = stageById(id);
    if (!stage) throw new Error(id);
    const session = new Session({ world: createStageWorld(stage), mode: 'stage', stage, cues: stage.tutorial });
    const hud = new Hud({ pause: () => undefined, boost: () => undefined, steer: () => undefined }, 'thumb', true);
    document.body.append(hud.el);
    return { hud, session };
  }

  it('shows the score, combo, progress and a hint, and only touches the DOM when something changes', () => {
    const { hud, session } = hudFor('1-01');
    session.world.stats.score = 12345;
    session.world.combo.level = 3;
    session.world.combo.pips = 2;
    while (session.world.s < 280) session.advance(16);
    hud.update(session);
    expect(hud.el.querySelector('output')?.textContent).toBe('12,345');
    expect(hud.el.querySelector('.combo__level')?.textContent).toBe('x3');
    expect(hud.el.querySelectorAll('.combo__pips i.on')).toHaveLength(2);
    expect(hud.el.querySelector('.hint')?.textContent).toContain('HOLD');
    const first = hud.el.querySelector('.combo__pips i');
    hud.update(session);
    expect(hud.el.querySelector('.combo__pips i')).toBe(first);
  });

  it('describes each kind of objective as it is worked on', () => {
    const wording: Record<string, RegExp> = {
      '1-03': /^Drift points 0 \/ [\d,]+$/, '1-04': /^Sparks 0 \/ \d+$/, '1-06': /^Combo x1 \/ x\d$/,
      '4-01': /^Cars passed 0 \/ \d+$/, '1-07': /^Time left \d+\.\d s$/, '1-01': /^Reach the finish$/,
    };
    for (const [id, expected] of Object.entries(wording)) {
      const { hud, session } = hudFor(id);
      hud.update(session);
      expect(hud.el.querySelector('.objective span')?.textContent, id).toMatch(expected);
    }
  });

  it('shows shield, magnet and boost state, popups and flashes', () => {
    const { hud, session } = hudFor('1-01');
    session.world.shield = true;
    session.world.magnetTicks = 480;
    session.world.boostMeter = 1;
    hud.update(session);
    expect(hud.el.querySelector('.chip--shield')).not.toBeNull();
    expect(hud.el.querySelector('.chip--magnet')?.textContent).toContain('4 s');
    expect(hud.el.querySelector('.boost')?.getAttribute('aria-label')).toBe('Boost ready');
    expect(hud.el.querySelector('.boost--ready')).not.toBeNull();
    session.world.boostMeter = 0;
    session.world.boostTicks = 100;
    hud.update(session);
    expect(hud.el.querySelector('.boost')?.getAttribute('aria-label')).toBe('Boost active');
    session.world.boostTicks = 0;
    session.world.boostMeter = 0.4;
    hud.update(session);
    expect(hud.el.querySelector('.boost')?.getAttribute('aria-label')).toContain('40 percent');
    for (let i = 0; i < 12; i++) hud.popup(`+${i}`, 100, 200, 'near');
    expect(hud.el.querySelectorAll('.popup').length).toBeLessThanOrEqual(8);
    hud.flash();
    hud.pulseCombo();
    expect(hud.el.querySelector('.flash--on')).not.toBeNull();
    expect(hud.el.querySelector('.combo--pop')).not.toBeNull();
  });

  it('needs no objective row for endless runs, and shows the distance instead', () => {
    const session = new Session({ world: createStageWorld(stageById('1-01') as never), mode: 'endless' });
    session.world.rules.finishS = null;
    const hud = new Hud({ pause: () => undefined, boost: () => undefined, steer: () => undefined }, 'thumb', false);
    document.body.append(hud.el);
    hud.update(session);
    expect(hud.el.querySelector('.objective')).toBeNull();
  });
});
