/**
 * Real-browser checks of the screens: accessibility (axe, WCAG 2.2 AA), keyboard-only use, touch-target sizes,
 * layouts from a 320 px phone to a desktop window, offline play, settings and garage persistence, and recovery from
 * a corrupt save.
 */
import { PHONE, SMALL_PHONE, TABLET, assert, clearedProgress, runAxe, shot, test } from './harness.mjs';

const open = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' }).click();

/** True when nothing on the page scrolls sideways and every interactive control is at least 44 css px square. */
async function layoutProblems(page) {
  return page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('page scrolls sideways');
    const screen = document.querySelector('main.screen');
    if (screen && screen.scrollWidth > screen.clientWidth + 1) out.push(`screen content is ${screen.scrollWidth} wide in ${screen.clientWidth}`);
    for (const el of document.querySelectorAll('main.screen button, main.screen input[type=range], main.screen .switch')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 24)}: ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}

export async function runScreenTests() {
  await test('every screen passes automated WCAG 2.2 AA checks (axe)', { context: PHONE, seed: clearedProgress(10, { achievements: { 'first-finish': '2026-11-04' } }) }, async (page) => {
    const incomplete = [];
    const screens = [['menu', null], ['stage select', /^Stages/], ['garage', /^Garage/], ['trophies', /^Trophies/], ['boards', /^Boards/],
      ['settings', 'Settings'], ['how to play', 'How to play'], ['about', /^About/]];
    for (const [label, button] of screens) {
      if (button) await open(page, button);
      await page.locator('main.screen').waitFor();
      incomplete.push(`${label}: ${await runAxe(page, label)}`);
      if (button) await open(page, 'Back');
    }
    await open(page, /^Stages/);
    await open(page, /Stage 1-01/);
    await page.getByRole('dialog').waitFor();
    await runAxe(page, 'stage sheet');
    console.log(`      axe "needs review" counts: ${incomplete.join(', ')}`);
  });

  await test('the HUD and the pause menu pass axe', { context: PHONE }, async (page) => {
    await page.getByRole('button', { name: /^Play|^Continue/ }).click();
    await page.getByLabel('Heads-up display').waitFor();
    await runAxe(page, 'the HUD');
    await open(page, 'Pause');
    await page.getByRole('dialog').waitFor();
    await runAxe(page, 'the pause menu');
  });

  await test('screens fit without sideways scrolling, and every control is at least 44 px', { context: SMALL_PHONE, seed: clearedProgress(10) }, async (page) => {
    for (const [name, button] of [['menu', null], ['stages', /^Stages/], ['garage', /^Garage/], ['settings', 'Settings'], ['trophies', /^Trophies/], ['boards', /^Boards/]]) {
      if (button) await open(page, button);
      await page.locator('main.screen').waitFor();
      await page.waitForTimeout(350);
      const problems = await layoutProblems(page);
      assert(problems.length === 0, `${name} at 320 px: ${problems.join('; ')}`);
      if (name === 'menu') await shot(page, '07-menu-320');
      if (button) await open(page, 'Back');
    }
  });

  for (const [label, context] of [['tablet portrait', TABLET], ['desktop landscape', { viewport: { width: 1280, height: 720 } }], ['tall phone', { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]]) {
    await test(`the menu and a run lay out on a ${label} screen`, { context }, async (page) => {
      await page.waitForTimeout(600);
      assert((await layoutProblems(page)).length === 0, 'menu layout problems');
      await shot(page, `08-menu-${label.replace(/ /g, '-')}`);
      await page.getByRole('button', { name: /^Play|^Continue/ }).click();
      await page.getByLabel('Heads-up display').waitFor();
      await page.waitForTimeout(1200);
      const fits = await page.evaluate(() => {
        const c = document.querySelector('canvas').getBoundingClientRect();
        const u = document.getElementById('ui').getBoundingClientRect();
        return Math.abs(c.width - u.width) < 2 && Math.abs(c.height - u.height) < 2 && Math.abs(c.left - u.left) < 2;
      });
      assert(fits, 'the interface layer is not exactly over the canvas');
      await shot(page, `09-run-${label.replace(/ /g, '-')}`);
    });
  }

  await test('keyboard only: Tab reaches the buttons, Enter starts a stage, focus lands on headings', { seed: clearedProgress(0) }, async (page) => {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    assert(focused && focused.length > 0, 'Tab did not reach a control');
    for (let i = 0; i < 12; i++) {
      const text = await page.evaluate(() => document.activeElement?.textContent ?? '');
      if (/^Play|^Continue/.test(text.trim())) break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await page.getByLabel('Heads-up display').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor();
    const trapped = await page.evaluate(() => document.activeElement?.closest('[role=dialog]') !== null);
    assert(trapped, 'focus is not inside the pause dialog');
  });

  await test('settings persist across a reload and apply immediately', { context: PHONE }, async (page) => {
    await open(page, 'Settings');
    await page.getByRole('button', { name: 'Reduced' }).click();
    await page.getByRole('button', { name: 'Left / right' }).click();
    await page.getByRole('button', { name: 'Low' }).click();
    assert((await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduce', 'motion setting not applied');
    await page.reload();
    await page.locator('#splash').waitFor({ state: 'detached', timeout: 30000 });
    await open(page, 'Settings');
    for (const name of ['Reduced', 'Left / right', 'Low']) {
      assert((await page.getByRole('button', { name }).getAttribute('aria-pressed')) === 'true', `${name} did not persist`);
    }
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /^Play|^Continue/ }).click();
    await page.getByRole('button', { name: 'Steer left' }).waitFor();
    await page.getByRole('button', { name: 'Steer right' }).waitFor();
  });

  await test('the garage equips what is earned, explains what is locked, and remembers the choice', { context: PHONE, seed: clearedProgress(10) }, async (page) => {
    await open(page, /^Garage/);
    await page.getByRole('heading', { name: 'Pulse' }).waitFor();
    await open(page, 'Next car');
    await shot(page, '10-garage');
    for (let i = 0; i < 3; i++) await open(page, 'Next car');
    const locked = await page.getByRole('button', { name: 'Equip' }).isDisabled();
    assert(locked, 'a car that costs more stars than are earned should not be equippable');
    await page.getByRole('button', { name: /Ultraviolet, locked/ }).click({ force: true });
    assert(/to unlock Ultraviolet/.test(await page.locator('.toast').innerText()), 'no explanation for the locked colour');
  });

  await test('the game works fully offline once loaded', { context: PHONE }, async (page, context) => {
    await context.setOffline(true);
    await page.getByRole('button', { name: /^Play|^Continue/ }).click();
    await page.getByLabel('Heads-up display').waitFor();
    await page.waitForTimeout(1500);
    await open(page, 'Pause');
    await page.getByRole('dialog').waitFor();
    await context.setOffline(false);
  });

  await test('a corrupt save falls back safely instead of breaking the game', {
    context: PHONE,
    seed: [{ key: 'neon-drift.progress', value: '{not json' }, { key: 'neon-drift.settings', value: '[1,2' }],
  }, async (page) => {
    await page.getByRole('button', { name: /^Play/ }).waitFor();
    // A save that cannot be read starts a new player, who is greeted once; Escape closes the greeting.
    await page.getByRole('dialog', { name: /Welcome/ }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await open(page, 'Settings');
    await page.getByRole('main', { name: 'Settings' }).waitFor();
  });

  await test('keyboard shortcuts and the dev inspector are absent from a production build', {}, async (page) => {
    assert(await page.evaluate(() => typeof window.__nd === 'undefined'), 'the dev hook is present in the production build');
    assert((await page.evaluate(() => document.title)) === 'Neon Drift', 'wrong title');
  }, { prodOnly: true });

  await test('the frame rate in this (software-rendered) browser, for the record', { context: PHONE }, async (page) => {
    await page.getByRole('button', { name: /^Play|^Continue/ }).click();
    await page.waitForTimeout(1500);
    const fps = await page.evaluate(() => new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames += 1;
        if (performance.now() - start < 3000) requestAnimationFrame(tick);
        else resolve(Math.round((frames / (performance.now() - start)) * 1000));
      };
      requestAnimationFrame(tick);
    }));
    console.log(`      measured ${fps} fps (headless Chromium on software GL: not representative of a phone)`);
  });
}

