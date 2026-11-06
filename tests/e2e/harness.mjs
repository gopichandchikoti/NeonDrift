/**
 * Shared plumbing for the browser end-to-end suites: launches an installed Chromium browser (Edge, then Chrome), gives
 * every test a fresh context with its own storage, and fails a test on any console error, page crash, failed request
 * or request to another origin (the game must never touch the network).
 *
 * Environment:
 *   NEON_URL      base URL (default http://localhost:5615)
 *   NEON_BROWSER  path to a Chromium-based executable (default: installed Edge, then Chrome)
 *   NEON_PROD=1   production build (no window.__nd hook): skips the checks that need it
 *   NEON_GREP     only run checks whose name matches this regular expression (case-insensitive)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const BASE = process.env.NEON_URL ?? 'http://localhost:5615';
export const PROD = process.env.NEON_PROD === '1';
const GREP = process.env.NEON_GREP ? new RegExp(process.env.NEON_GREP, 'i') : null;
export const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');
const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
mkdirSync(OUT, { recursive: true });

const results = [];
let browser;

async function launch() {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const candidates = process.env.NEON_BROWSER
    ? [{ executablePath: process.env.NEON_BROWSER }]
    : [{ channel: 'msedge' }, { channel: 'chrome' }];
  for (const candidate of candidates) {
    try {
      return await chromium.launch({ headless: true, args, ...candidate });
    } catch {
      /* try the next browser */
    }
  }
  throw new Error('No Chromium-based browser found. Set NEON_BROWSER to its executable path.');
}

export async function openBrowser() {
  console.log(`Neon Drift end-to-end checks against ${BASE}${PROD ? ' (production build)' : ''}`);
  browser = await launch();
  console.log(`  browser: ${browser.version()}`);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
export const SMALL_PHONE = {
  viewport: { width: 320, height: 568 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
};
export const TABLET = { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true };

/** Progress with the first `count` stages cleared, so later stages, endless and daily can be opened. */
export function clearedProgress(count, extra = {}) {
  const ids = [];
  for (let district = 1; district <= 6; district++) {
    for (let n = 1; n <= 10; n++) ids.push(`${district}-${String(n).padStart(2, '0')}`);
  }
  const stages = {};
  for (const id of ids.slice(0, count)) {
    stages[id] = { stars: 1, bestScore: 2000, bestTicks: 2400, attempts: 1, cleared: true };
  }
  const data = { stages, tutorialDone: true, ...extra };
  return { key: 'neon-drift.progress', value: JSON.stringify({ version: 1, data }) };
}

export const SEEN = { key: 'neon-drift.progress', value: JSON.stringify({ version: 1, data: { tutorialDone: true } }) };

/**
 * Opens a fresh page and runs `body`.
 * options.context   browser-context options (viewport, touch, reduced motion ...)
 * options.seed      { key, value } entries written to localStorage before the page loads
 * options.ignore    regular expressions for problems that are expected in this test
 * options.path      path (and query) to open instead of "/"
 */
async function withPage(options, body) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options.context });
  const seeds = [].concat(options.seed ?? [SEEN]);
  await context.addInitScript((entries) => {
    if (!sessionStorage.getItem('__seeded')) {
      entries.forEach((e) => localStorage.setItem(e.key, e.value));
      sessionStorage.setItem('__seeded', '1');
    }
  }, seeds);
  const page = await context.newPage();
  const problems = [];
  const expected = (text) => (options.ignore ?? []).some((pattern) => pattern.test(text));
  const note = (text) => {
    if (!expected(text)) problems.push(text);
  };
  const origin = new URL(BASE).origin;
  page.on('console', (msg) => {
    if (msg.type() === 'error') note(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => note(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => note(`request failed: ${request.url()}`));
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin) {
      note(`request to another origin: ${url}`);
    }
  });
  try {
    await page.goto(`${BASE}${options.path ?? '/'}`, { waitUntil: 'load' });
    await page.locator('#splash').waitFor({ state: 'detached', timeout: 30000 });
    await body(page, context);
    assert(problems.length === 0, `browser reported problems:\n        ${problems.join('\n        ')}`);
  } finally {
    await context.close();
  }
}

/** flags: needsHook (uses window.__nd, dev server only), prodOnly (only meaningful on a production build). */
export async function test(name, options, body, flags = {}) {
  if (GREP && !GREP.test(name)) return;
  const skip = flags.needsHook && PROD ? 'needs the dev hook' : flags.prodOnly && !PROD ? 'needs a production build' : null;
  if (skip) {
    results.push({ name, status: 'skipped', note: skip });
    console.log(`  - skip  ${name} (${skip})`);
    return;
  }
  const started = Date.now();
  try {
    await withPage(options, body);
    results.push({ name, status: 'passed' });
    console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, status: 'failed', note: error.message });
    console.log(`  ✗ ${name}\n      ${error.message.split('\n').join('\n      ')}`);
  }
}

export async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

export const snap = (page) => page.evaluate(() => window.__nd.snapshot());

export async function waitSnap(page, predicate, timeout = 20000) {
  await page.waitForFunction(
    (source) => new Function('s', `return (${source})(s)`)(window.__nd.snapshot()),
    predicate.toString(),
    { timeout },
  );
  return snap(page);
}

/** Runs axe-core with the WCAG 2.2 AA rule tags. */
export async function runAxe(page, label) {
  await page.addScriptTag({ content: AXE_SOURCE });
  // Entrance animations blend colours while they run, which would make axe's contrast maths meaningless.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 8000 });
  const report = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    }),
  );
  const detail = report.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
  assert(report.violations.length === 0, `axe found ${report.violations.length} violation(s) on ${label}:\n  ${detail.join('\n  ')}`);
  return report.incomplete.map((v) => v.id).join('+') || 'none';
}

export function finish() {
  const failed = results.filter((r) => r.status === 'failed');
  const passed = results.filter((r) => r.status === 'passed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  console.log(`\n${passed} passed, ${failed.length} failed, ${skipped} skipped`);
  return browser.close().then(() => process.exit(failed.length ? 1 : 0));
}
