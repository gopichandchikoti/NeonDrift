// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { decodeInput } from '../src/game/levels/runner';
import { stageById } from '../src/game/levels/catalog';
import { STAGE_DEFS } from '../src/game/levels/stages';
import { mount, stubBrowser } from './harness';

beforeEach(() => stubBrowser());

const done = { stars: 1, bestScore: 100, bestTicks: null, attempts: 1, cleared: true };
const cleared = (count: number): Record<string, unknown> => ({
  stages: Object.fromEntries(STAGE_DEFS.slice(0, count).map((s) => [s.id, done])),
});

describe('starting up', () => {
  it('shows the main menu with the live demo running behind it', () => {
    const h = mount();
    h.app.start();
    expect(h.ui.querySelector('[aria-label="Main menu"]')).not.toBeNull();
    expect(h.has(/^Play/)).toBe(true);
    expect(h.scene.attached?.session.script).not.toBeNull();
    expect(h.live.textContent).toBe('Main menu');
    h.frame(500);
    expect(h.scene.session?.world.tick).toBeGreaterThan(30);
  });

  it('plays the next demo stage when one finishes', () => {
    const h = mount();
    h.app.start();
    const first = h.scene.attaches;
    h.until(() => h.scene.attaches > first, 120000);
    expect(h.scene.attaches).toBeGreaterThan(first);
  });

  it('greets a brand-new player once, and starts the first stage from the greeting', () => {
    const h = mount({ tutorialDone: false });
    h.app.start();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    return new Promise<void>((resolve) => setTimeout(() => {
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Welcome');
      h.click("Let's go");
      expect(h.app.flow.inRun).toBe(true);
      expect(h.app.flow.stage?.id).toBe('1-01');
      expect(h.app.ctx.progress.value.tutorialDone).toBe(true);
      resolve();
    }, 700));
  });

  it('warns when saving is not possible', () => {
    const h = mount();
    h.app.ctx.progress.saveWorks = false;
    h.app.show('menu');
    expect(h.ui.textContent).toContain('Saving is blocked');
  });
});

describe('menu and navigation', () => {
  it('keeps Endless and Daily locked until Electric Alley is cleared, and explains why', () => {
    const h = mount();
    h.app.start();
    h.click(/^Endless/);
    expect(h.app.flow.inRun).toBe(false);
    expect(document.querySelector('.toast')?.textContent).toContain('Electric Alley');
    h.click(/^Daily/);
    expect(document.querySelectorAll('.toast').length).toBe(2);
  });

  it('opens every screen from the menu and comes back with Back', () => {
    const h = mount();
    h.app.start();
    const screens: Array<[RegExp | string, string]> = [
      [/^Stages/, 'Stage select'], [/^Garage/, 'Garage'], [/^Trophies/, 'Trophies'], [/^Boards/, 'Personal bests'],
      ['How to play', 'How to play'], ['Settings', 'Settings'], [/^About/, 'About and privacy'],
    ];
    for (const [button, label] of screens) {
      h.click(button);
      expect(h.ui.querySelector(`[aria-label="${label}"]`), String(label)).not.toBeNull();
      h.click('Back');
      expect(h.ui.querySelector('[aria-label="Main menu"]')).not.toBeNull();
    }
  });

  it('turns sound off from the menu and says so', () => {
    const h = mount();
    h.app.start();
    h.click(/Turn sound off/);
    expect(h.app.ctx.settings.value.muted).toBe(true);
    expect(h.has(/Turn sound on/)).toBe(true);
  });

  it('opens Endless and the Daily Challenge once the first district is cleared', () => {
    const h = mount({ progress: cleared(10) });
    h.app.start();
    h.click(/^Endless/);
    expect(h.app.flow.inRun).toBe(true);
    expect(h.ui.querySelector('.objective')).toBeNull();
    h.app.quitToMenu();
    h.click(/^Daily/);
    expect(h.app.flow.inRun).toBe(true);
    expect(h.app.flow.session?.mode).toBe('daily');
  });
});

describe('stage select', () => {
  it('lists the ten stages of a district, locks the unplayed ones and opens a sheet for an open stage', () => {
    const h = mount();
    h.app.show('stages');
    expect(document.querySelectorAll('.tile')).toHaveLength(10);
    expect(h.has(/Stage 1-02 Neon Bends, locked/)).toBe(true);
    h.click(/Stage 1-02/);
    expect(document.querySelector('.toast')?.textContent).toContain('Clear stage 1-01 first');
    h.click(/Stage 1-01 First Light/);
    const sheet = document.querySelector('[role="dialog"]');
    expect(sheet?.textContent).toContain('Objective');
    expect(sheet?.textContent).toContain('3 stars');
    h.click('Start');
    expect(h.app.flow.stage?.id).toBe('1-01');
  });

  it('switches district only when it is open, and marks cleared stages', () => {
    const h = mount({ progress: { ...cleared(10), lastStage: '1-10' } });
    h.app.show('stages');
    h.click(/2\. Rainline Docks/);
    expect(document.querySelector('.district-card')?.textContent).toContain('Rainline Docks');
    h.click(/3\. Sunset Circuit/);
    expect(document.querySelector('.toast')?.textContent).toContain('Rainline Docks');
    h.click(/1\. Electric Alley/);
    expect(h.has(/Stage 1-10 Alley Finale, 1 of 3 stars, cleared/)).toBe(true);
  });
});

describe('a run', () => {
  it('starts with a HUD, takes a thumb, pauses and resumes', () => {
    const h = mount();
    h.app.playStage('1-01');
    expect(h.ui.querySelector('.hud')).not.toBeNull();
    expect(h.ui.querySelector('[aria-label="Main menu"]')).toBeNull();
    expect(h.live.textContent).toContain('First Light');
    h.frame(200);
    const tick = h.scene.session?.world.tick ?? 0;
    expect(tick).toBeGreaterThan(10);
    h.click('Pause');
    expect(h.app.flow.paused).toBe(true);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Paused');
    h.frame(500);
    expect(h.scene.session?.world.tick).toBe(tick);
    h.click('Resume');
    expect(h.app.flow.paused).toBe(false);
    h.frame(100);
    expect(h.scene.session?.world.tick).toBeGreaterThan(tick);
  });

  it('uses Android back as pause, then resume, and leaves a finished run for the stage list', () => {
    const h = mount();
    h.app.playStage('1-01');
    h.frame(100);
    h.app.back();
    expect(h.app.flow.paused).toBe(true);
    h.app.back();
    expect(h.app.flow.paused).toBe(false);
    h.app.back();
    expect(h.app.flow.paused).toBe(true);
    h.click('Quit to stages');
    expect(h.ui.querySelector('[aria-label="Stage select"]')).not.toBeNull();
    expect(h.app.flow.inRun).toBe(false);
  });

  it('restarts from the pause menu with a fresh world, and opens help and settings inside it', () => {
    const h = mount();
    h.app.playStage('1-01');
    h.frame(500);
    const before = h.scene.session;
    h.click('Pause');
    h.click('How to play');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    h.click('Back');
    h.click('Settings');
    const open = Array.from(document.querySelectorAll('[role="dialog"]'));
    expect(open.at(-1)?.textContent).toContain('Mute everything');
    h.click('Done');
    h.click('Restart');
    expect(h.scene.session).not.toBe(before);
    expect(h.scene.session?.world.tick).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows a clear result after finishing, saves it, and offers the next stage', () => {
    const h = mount();
    h.app.playStage('1-01');
    const stage = stageById('1-01');
    const session = h.scene.session;
    if (!session || !stage?.calibration) throw new Error('setup');
    session.script = decodeInput(stage.calibration.input);
    h.until(() => session.result !== null && h.ui.querySelector('.results') !== null);
    expect(h.ui.querySelector('.results__title')?.textContent).toBe('Stage clear');
    expect(h.app.ctx.progress.value.stages['1-01']?.cleared).toBe(true);
    expect(h.has(/^Next: Neon Bends/)).toBe(true);
    expect(h.ui.textContent).toContain('First clear');
    h.click(/^Next: Neon Bends/);
    expect(h.app.flow.stage?.id).toBe('1-02');
  });

  it('shows a crash result, lets the player retry, and gives a free shield after three failures', () => {
    const h = mount();
    h.app.playStage('1-01');
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = h.scene.session;
      session?.setSource('pointer', true);
      h.until(() => h.ui.querySelector('.results') !== null);
      expect(h.ui.querySelector('.results__title')?.textContent).toBe('Crashed');
      h.click('Retry');
    }
    expect(h.scene.session?.world.shield).toBe(true);
    expect(document.querySelector('.toast')?.textContent).toContain('free shield');
    expect(h.app.ctx.progress.value.stages['1-01']?.attempts).toBe(3);
  });

  it('records endless runs and shows a run-over screen with the local rank', () => {
    const h = mount({ progress: cleared(10) });
    h.app.flow.seedFor = () => 5;
    h.app.playEndless();
    h.scene.session?.setSource('pointer', true);
    h.until(() => h.ui.querySelector('.results') !== null);
    expect(h.ui.querySelector('.results__title')?.textContent).toBe('Run over');
    expect(h.app.ctx.progress.value.endless.runs).toBe(1);
    h.click('Menu');
    expect(h.ui.querySelector('[aria-label="Main menu"]')).not.toBeNull();
  });

  it('can steer with on-screen buttons, and the boost button queues a boost', () => {
    const h = mount({ settings: { controls: 'buttons' } });
    h.app.playStage('1-01');
    expect(h.has('Steer left')).toBe(true);
    const right = h.button('Steer right');
    right.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(h.scene.session?.world.steerCue).toBeDefined();
    h.frame(100);
    right.dispatchEvent(new Event('pointerup', { bubbles: true }));
    const world = h.scene.session?.world;
    if (!world) throw new Error('no world');
    world.boostMeter = 1;
    h.button(/^Boost/).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    h.frame(50);
    expect(world.stats.boosts).toBe(1);
  });
});

describe('Android back from a menu', () => {
  it('goes up one screen at a time and asks the app to exit from the menu', () => {
    const h = mount();
    let exits = 0;
    h.app.ctx.exit = () => {
      exits += 1;
    };
    h.app.start();
    h.click(/^Stages/);
    h.app.back();
    expect(h.ui.querySelector('[aria-label="Main menu"]')).not.toBeNull();
    h.app.back();
    expect(exits).toBe(1);
  });

  it('closes an open dialog first', () => {
    const h = mount();
    h.app.show('stages');
    h.click(/Stage 1-01/);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    h.app.back();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(h.ui.querySelector('[aria-label="Stage select"]')).not.toBeNull();
  });
});
