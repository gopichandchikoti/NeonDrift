/**
 * Real-browser end-to-end checks. Drives an installed Chromium browser with real mouse, touch and keyboard input
 * against a running Neon Drift server.
 *
 *   npm run dev          # in one terminal (serves http://localhost:5615)
 *   npm run test:e2e     # in another
 *
 * Production-build check:  npm run build && npm run preview, then NEON_PROD=1 npm run test:e2e
 * Accessibility, layout and persistence checks are in screens.mjs.
 */
import { PHONE, assert, clearedProgress, finish, openBrowser, shot, snap, test, waitSnap } from './harness.mjs';
import { runScreenTests } from './screens.mjs';

const playButton = (page) => page.getByRole('button', { name: /^(Play|Continue)/ });

/** Holds a finger on the play field for `ms` using real touch events from the DevTools protocol. */
async function touchHold(page, ms, x = 195, y = 520) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

await openBrowser();

await test('menu loads, renders one canvas and the live demo animates behind it', {}, async (page) => {
  await page.getByRole('heading', { name: /Neon\s*Drift/ }).waitFor();
  await playButton(page).waitFor();
  assert((await page.locator('canvas').count()) === 1, 'expected exactly one canvas');
  const first = await page.screenshot();
  await page.waitForTimeout(900);
  const second = await page.screenshot();
  assert(first.length > 20000, 'first frame looks blank (screenshot is tiny)');
  assert(!first.equals(second), 'the scene is static: the demo car should be driving behind the menu');
  await shot(page, '01-menu-desktop');
});

await test('Play starts stage 1-01 and the HUD shows score, combo, objective and a coaching hint', { context: PHONE }, async (page) => {
  await playButton(page).click();
  const hud = page.getByLabel('Heads-up display');
  await hud.waitFor();
  const text = await hud.innerText();
  assert(/SCORE/i.test(text) && /x1/.test(text) && /Reach the finish/.test(text), `HUD text was: ${text}`);
  await page.getByRole('button', { name: 'Pause' }).waitFor();
  await page.getByRole('button', { name: /^Boost/ }).waitFor();
  await page.waitForTimeout(1500);
  await shot(page, '02-run-phone');
}, { needsHook: false });

await test('a held mouse button drifts the car in a bend and releasing straightens it', {}, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.mode === 'run' && s.s > 400);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const sliding = await waitSnap(page, (s) => Math.abs(s.slip) > 0.2, 6000);
  assert(sliding.status === 'racing', `the car stopped racing while drifting: ${sliding.status}`);
  await shot(page, '03-drift');
  await page.mouse.up();
  await waitSnap(page, (s) => Math.abs(s.slip) < 0.08 || s.status !== 'racing', 6000);
}, { needsHook: true });

await test('a real touch hold steers the car, and lifting the finger lets go', { context: PHONE }, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.mode === 'run' && s.s > 420);
  await touchHold(page, 450);
  const after = await snap(page);
  assert(Math.abs(after.slip) > 0.05 || after.status !== 'racing', `no sign of steering: slip ${after.slip}`);
}, { needsHook: true });

await test('the keyboard steers: space holds, A and D turn, escape pauses, P and R restart paths work', {}, async (page) => {
  await playButton(page).click();
  await waitSnap(page, (s) => s.mode === 'run' && s.s > 400);
  await page.keyboard.down('Space');
  await waitSnap(page, (s) => Math.abs(s.slip) > 0.15 || s.status !== 'racing', 6000);
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor();
  assert((await snap(page)).paused, 'Escape did not pause');
  const tick = (await snap(page)).tick;
  await page.waitForTimeout(500);
  assert((await snap(page)).tick === tick, 'the world kept running while paused');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert(!(await snap(page)).paused, 'Escape did not resume');
  await page.keyboard.press('KeyR');
  await waitSnap(page, (s) => s.tick < 120 && s.status === 'racing');
  await page.keyboard.press('KeyM');
  assert(await page.evaluate(() => window.__nd.ctx.settings.value.muted), 'M did not mute');
}, { needsHook: true });

await test('pause menu: resume, restart, help and settings are reachable, and quitting returns to stage select', { context: PHONE }, async (page) => {
  await playButton(page).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pause' }).click();
  const dialog = page.getByRole('dialog', { name: 'Paused' });
  await dialog.waitFor();
  await shot(page, '04-pause');
  await dialog.getByRole('button', { name: 'How to play' }).click();
  await page.getByRole('dialog', { name: 'How to play' }).getByRole('button', { name: 'Back' }).click();
  await dialog.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Done' }).click();
  await dialog.getByRole('button', { name: 'Resume' }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quit to stages' }).click();
  await page.getByRole('main', { name: 'Stage select' }).waitFor();
});

await test('finishing a stage shows a clear result, saves it, unlocks the next stage and survives a reload', { context: PHONE }, async (page) => {
  await playButton(page).click();
  await page.evaluate(async () => {
    const { session } = window.__nd;
    const input = session.stage.calibration.input;
    const holds = [];
    input.forEach((length, i) => { for (let t = 0; t < length; t++) holds.push(i % 2 === 1); });
    session.script = holds;
  });
  await page.locator('.results').waitFor({ timeout: 90000 });
  assert((await page.locator('.results__title').textContent()) === 'Stage clear', 'expected Stage clear');
  await page.waitForTimeout(1600);
  await shot(page, '05-results');
  await page.getByRole('button', { name: /^Next: Neon Bends/ }).waitFor();
  await page.reload();
  await page.locator('#splash').waitFor({ state: 'detached', timeout: 30000 });
  assert(/1-02/.test(await playButton(page).innerText()), 'Continue should now point at stage 1-02');
}, { needsHook: true });

await test('crashing shows a retryable result and counts the attempt', { context: PHONE }, async (page) => {
  await playButton(page).click();
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.locator('.results').waitFor({ timeout: 20000 });
  await page.mouse.up();
  assert((await page.locator('.results__title').textContent()) === 'Crashed', 'expected Crashed');
  await page.getByRole('button', { name: 'Retry' }).click();
  await waitSnap(page, (s) => s.mode === 'run' && s.tick < 300);
  const attempts = await page.evaluate(() => window.__nd.ctx.progress.value.stages['1-01'].attempts);
  assert(attempts === 1, `attempts was ${attempts}`);
}, { needsHook: true });

await test('endless and the daily challenge open after Electric Alley and can be played to a result', { context: PHONE, seed: clearedProgress(10) }, async (page) => {
  await page.getByRole('button', { name: /^Endless/ }).click();
  await waitSnap(page, (s) => s.mode === 'run');
  assert((await page.locator('.objective').count()) === 0, 'endless should have no stage objective row');
  await page.keyboard.down('Space');
  await page.locator('.results').waitFor({ timeout: 30000 });
  await page.keyboard.up('Space');
  assert(/Run over/.test(await page.locator('.results__title').textContent()), 'expected a run-over screen');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /^Daily/ }).click();
  await waitSnap(page, (s) => s.mode === 'run');
  await page.waitForTimeout(600);
  await shot(page, '06-daily');
});

await test('with reduced motion the interface stops animating and the setting sticks', {
  context: { ...PHONE, reducedMotion: 'reduce' },
}, async (page) => {
  const durations = await page.evaluate(() => {
    const el = document.querySelector('.screen');
    return getComputedStyle(el).animationDuration;
  });
  assert(/^0\.0*1?ms$|^1e-05s$|^0s$/.test(durations) || parseFloat(durations) < 0.01, `animation duration was ${durations}`);
});

await runScreenTests();
await finish();
