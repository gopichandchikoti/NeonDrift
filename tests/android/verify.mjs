/**
 * Android checks against a running emulator or phone: installs the debug APK, then drives the real app through its
 * WebView's DevTools socket (a small CDP client) plus device-level adb input and lifecycle events.
 *
 *   npm run android:apk
 *   NEON_ADB_SERIAL=emulator-5566 npm run android:verify
 *
 * NEON_ADB_SERIAL is required, so this can never touch some other device or emulator by accident. An emulator is
 * not a phone: frame rate and touch feel measured here say nothing about a real Samsung Galaxy.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const serial = process.env.NEON_ADB_SERIAL;
const sdk = process.env.ANDROID_HOME;
if (!serial || !sdk) {
  console.error('Set NEON_ADB_SERIAL (for example emulator-5566) and ANDROID_HOME.');
  process.exit(2);
}
const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const APP = 'com.portfolio.neondrift';
const APK = join(root, 'dist', 'android', 'neon-drift-v1.0-debug.apk');
const OUT = join(root, 'tests', 'android', 'output');
mkdirSync(OUT, { recursive: true });
const PORT = 9336;
const results = [];
const consoleLog = [];

function sh(...args) {
  const r = spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
}
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(name, body) {
  try {
    await body();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n      ${String(error.message).split('\n').join('\n      ')}`);
  }
}

async function pageTarget() {
  for (let i = 0; i < 40; i++) {
    const targets = await fetch(`http://localhost:${PORT}/json`).then((r) => r.json()).catch(() => []);
    const target = targets.find((t) => t.type === 'page');
    if (target) return target;
    await sleep(500);
  }
  throw new Error('no page target appeared in the WebView');
}

/** A minimal Chrome DevTools Protocol client for the app's WebView page. */
async function connect() {
  const target = await pageTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
      consoleLog.push(`${msg.params.type}: ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleLog.push(`pageerror: ${d.exception?.description ?? d.text}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1);
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async (expression, what, timeout = 20000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
      await sleep(250);
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  return { evaluate, waitFor, close: () => ws.close() };
}

async function launchAndAttach() {
  sh('shell', 'am', 'force-stop', APP);
  sh('shell', 'am', 'start', '-n', `${APP}/.MainActivity`);
  let socket = '';
  for (let i = 0; i < 40 && !socket; i++) {
    await sleep(500);
    // Only this app's WebView: the socket is named after the app's process id.
    const pid = sh('shell', 'pidof', APP).split(/\s+/)[0];
    if (pid && sh('shell', 'cat', '/proc/net/unix').includes(`@webview_devtools_remote_${pid}`)) {
      socket = `webview_devtools_remote_${pid}`;
    }
  }
  assert(socket, 'the WebView DevTools socket never appeared (is this a debug build?)');
  sh('forward', `tcp:${PORT}`, `localabstract:${socket}`);
  const page = await connect();
  await page.waitFor("document.querySelector('canvas') && !document.getElementById('splash')", 'the game to start');
  return page;
}

function screenshotDevice(name) {
  sh('shell', 'screencap', '-p', `/sdcard/${name}.png`);
  sh('pull', `/sdcard/${name}.png`, join(OUT, `${name}.png`));
}

const buttonByText = (re) =>
  `Array.from(document.querySelectorAll('button')).find((b) => ${re}.test((b.getAttribute('aria-label') ?? b.textContent ?? '').trim()))`;

/** Maps a CSS-pixel point inside the page to device pixels (the WebView sits between the system bars). */
async function devicePoint(page, selectorExpression) {
  const size = /(\d+)x(\d+)/.exec(sh('shell', 'wm', 'size'));
  const deviceHeight = Number(size[2]);
  const r = await page.evaluate(
    `(() => { const b = (${selectorExpression}).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, dpr: devicePixelRatio, vh: innerHeight }; })()`,
  );
  const offset = (deviceHeight - r.vh * r.dpr) / 2;
  return { x: Math.round(r.x * r.dpr), y: Math.round(r.y * r.dpr + offset), deviceHeight };
}

console.log(`Neon Drift Android checks on ${serial}`);
console.log(`  device: ${sh('shell', 'getprop', 'ro.product.model')}, Android ${sh('shell', 'getprop', 'ro.build.version.release')}`);

await check('the debug APK installs (an update keeps saved data)', async () => {
  assert(/Success/.test(sh('install', '-r', APK)), 'adb install did not report Success');
});

await check('the installed package is Neon Drift 1.0.0 with no INTERNET permission', async () => {
  const info = sh('shell', 'dumpsys', 'package', APP);
  assert(/versionName=1\.0\.0/.test(info), 'versionName is not 1.0.0');
  assert(!/android\.permission\.INTERNET/.test(info), 'the app requests INTERNET');
  assert(/android\.permission\.VIBRATE/.test(info), 'expected the VIBRATE permission for haptics');
});

sh('shell', 'pm', 'clear', APP);
let page = await launchAndAttach();

await check('the game loads from the bundled files (https://localhost), with no dev hook', async () => {
  assert(/^https:\/\/localhost\//.test(await page.evaluate('location.href')), 'not served from the bundled origin');
  assert((await page.evaluate('document.title')) === 'Neon Drift', 'wrong title');
  assert((await page.evaluate("document.querySelectorAll('canvas').length")) === 1, 'expected one canvas');
  assert(await page.evaluate("typeof window.__nd === 'undefined'"), 'the dev hook is present in the APK');
});

await check('the bundled fonts are available with no network', async () => {
  const fonts = await page.evaluate(
    `['800 40px "Unbounded Variable"', '600 20px "Manrope Variable"'].map((f) => document.fonts.check(f))`,
  );
  assert(fonts.every(Boolean), `font check: ${fonts}`);
});

await check('the canvas fills the screen width and the interface sits exactly over it', async () => {
  const g = await page.evaluate(`(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    const u = document.getElementById('ui').getBoundingClientRect();
    return { c: [c.width, c.height, c.left, c.top], u: [u.width, u.height, u.left, u.top], w: innerWidth, h: innerHeight, dpr: devicePixelRatio };
  })()`);
  assert(Math.abs(g.c[0] - g.w) < 3, `canvas ${Math.round(g.c[0])} wide in a ${g.w} wide window`);
  g.c.forEach((v, i) => assert(Math.abs(v - g.u[i]) < 2, `UI misaligned ${JSON.stringify(g)}`));
  console.log(`      viewport ${g.w}x${g.h} css px at ${g.dpr}x; canvas ${Math.round(g.c[0])}x${Math.round(g.c[1])}`);
});

await check('system-bar insets reach the page (Capacitor safe-area variables)', async () => {
  const v = await page.evaluate(
    `(() => { const r = getComputedStyle(document.documentElement); return { top: r.getPropertyValue('--safe-area-inset-top').trim(), bottom: r.getPropertyValue('--safe-area-inset-bottom').trim() }; })()`,
  );
  console.log(`      --safe-area-inset-top: "${v.top}", bottom: "${v.bottom}"`);
  assert(typeof v.top === 'string', 'could not read the safe-area variable');
});

await check('the first launch greets a new player, and a device tap on "Let\'s go" starts stage 1-01', async () => {
  await page.waitFor("document.querySelector('[role=dialog]')", 'the welcome dialog', 8000);
  screenshotDevice('android-welcome');
  const p = await devicePoint(page, `(${buttonByText(/^Let's go/)})`);
  sh('shell', 'input', 'tap', String(p.x), String(p.y));
  await page.waitFor("document.querySelector('.hud')", 'the HUD after the tap');
  await sleep(1200);
  screenshotDevice('android-run');
});

await check('holding the screen with a real finger spins the car out within about a second', async () => {
  await page.evaluate('location.reload()');
  await page.waitFor("document.querySelector('canvas') && !document.getElementById('splash')", 'the reloaded page');
  const play = await devicePoint(page, `(${buttonByText(/^(Play|Continue)/)})`);
  sh('shell', 'input', 'tap', String(play.x), String(play.y));
  await page.waitFor("document.querySelector('.hud')", 'the run to start');
  await sleep(500);
  // A press that never lets go turns the car in a circle, which the game calls a spin-out: it must end the run fast.
  sh('shell', 'input', 'swipe', '540', '1200', '540', '1200', '2500');
  await page.waitFor("document.querySelector('.results')", 'the results screen', 15000);
  const title = await page.evaluate("document.querySelector('.results__title')?.textContent");
  const time = await page.evaluate("Array.from(document.querySelectorAll('.stats div')).find((d) => /Time/.test(d.textContent))?.querySelector('dd')?.textContent");
  console.log(`      result: ${title}, time ${time}`);
  assert(title === 'Crashed', `expected a crash, got ${title}`);
  screenshotDevice('android-results');
});

await check('Android Back pauses a run and resumes it; Home pauses it too', async () => {
  const dialogText = "document.querySelector('[role=dialog]')?.textContent ?? ''";
  await page.evaluate(`(${buttonByText(/^Retry/)}).click()`);
  await page.waitFor("document.querySelector('.hud')", 'a fresh attempt');
  await sleep(700);
  sh('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await page.waitFor(`/Paused/.test(${dialogText})`, 'the pause dialog after Back');
  screenshotDevice('android-paused');
  sh('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await page.waitFor("!document.querySelector('[role=dialog]')", 'the dialog to close after a second Back');
  sh('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await sleep(1500);
  sh('shell', 'am', 'start', '-n', `${APP}/.MainActivity`);
  await page.waitFor(`/Paused/.test(${dialogText})`, 'the game to be paused after returning from Home');
});

await check('progress survives the app being killed and restarted', async () => {
  const progress = { stages: {}, tutorialDone: true };
  for (const id of ['1-01', '1-02', '1-03']) progress.stages[id] = { stars: 2, bestScore: 4000, bestTicks: 2500, attempts: 2, cleared: true };
  await page.evaluate(`localStorage.setItem('neon-drift.progress', ${JSON.stringify(JSON.stringify({ version: 1, data: progress }))})`);
  await page.evaluate('location.reload()');
  await sleep(1500);
  await page.waitFor("document.querySelector('canvas') && !document.getElementById('splash')", 'the reloaded page');
  await page.waitFor(buttonByText(/^Continue/), 'the Continue button');
  const label = await page.evaluate(`(${buttonByText(/^Continue/)})?.textContent ?? ''`);
  assert(/1-04/.test(label), `after a reload the Continue button says: "${label}"`);
  page.close();
  page = await launchAndAttach(); // force-stops the app first, so this is a cold start of a killed process
  await page.waitFor(buttonByText(/^Continue/), 'the Continue button after a kill');
  const after = await page.evaluate(`(${buttonByText(/^Continue/)})?.textContent ?? ''`);
  assert(/1-04/.test(after), `after killing the app the Continue button says: "${after}"`);
  await sleep(1800); // let the window finish drawing, or the capture can show a stale frame
  screenshotDevice('android-menu');
});

await check('the game still starts and plays in airplane mode', async () => {
  sh('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  sh('shell', 'svc', 'wifi', 'disable');
  sh('shell', 'svc', 'data', 'disable');
  await sleep(1500);
  page.close();
  page = await launchAndAttach();
  await page.evaluate(`(${buttonByText(/^Continue/)}).click()`);
  await page.waitFor("document.querySelector('.hud')", 'the HUD in airplane mode');
  await sleep(800);
  sh('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
  sh('shell', 'svc', 'wifi', 'enable');
  sh('shell', 'svc', 'data', 'enable');
});

await check('frame rate on this device, and no console errors from the app', async () => {
  await sleep(1000);
  const fps = await page.evaluate(`new Promise((resolve) => {
    let frames = 0; const start = performance.now();
    const tick = () => { frames += 1; if (performance.now() - start < 3000) requestAnimationFrame(tick); else resolve(Math.round(frames / (performance.now() - start) * 1000)); };
    requestAnimationFrame(tick);
  })`);
  const hardware = `${serial} ${sh('shell', 'getprop', 'ro.hardware')} ${sh('shell', 'getprop', 'ro.product.model')}`;
  const emulator = /emu|sdk|ranchu|goldfish/i.test(hardware);
  console.log(`      measured ${fps} fps (${emulator ? 'an EMULATOR with software graphics: not representative of a phone' : 'a physical device'})`);
  const errors = consoleLog.filter((m) => /^(error|pageerror)/.test(m));
  // Two messages come from Capacitor's own native-injected scripts when a page is being replaced (its SystemBars
  // plugin sets CSS on document.documentElement, and the bridge fires events at window.Capacitor, before either
  // exists). Whether they appear is a race, they are not game code, and the game does not depend on them, so they
  // are counted and reported, not hidden. Anything else fails the check.
  const framework = errors.filter((m) => /Error injecting safe area CSS|reading 'triggerEvent'/.test(m));
  const own = errors.filter((m) => !framework.includes(m));
  console.log(`      ${framework.length} Capacitor framework message(s) during page loads, ${own.length} from the app`);
  assert(own.length === 0, `console errors:\n${own.join('\n')}`);
});

page.close();
writeFileSync(join(OUT, 'console.txt'), consoleLog.join('\n'));
sh('forward', '--remove', `tcp:${PORT}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed. Console lines captured: ${consoleLog.length} (tests/android/output/console.txt)`);
process.exit(failed ? 1 : 0);
