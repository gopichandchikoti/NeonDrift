import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import Phaser from 'phaser';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/screens.css';
import './ui/styles/hud.css';
import { App } from './app/app';
import { Controls } from './app/controls';
import { Layout } from './app/layout';
import { DriveScene } from './game/scenes/drive-scene';
import { VIEW, viewHeightFor } from './game/scenes/camera';

const host = document.getElementById('game') as HTMLElement;
const ui = document.getElementById('ui') as HTMLElement;
const live = document.getElementById('live') as HTMLElement;
const scene = new DriveScene();
VIEW.height = viewHeightFor(window.innerWidth, window.innerHeight);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: host,
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: '#07060d',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // The game synthesises its own sound with Web Audio; Phaser's audio system is not used.
  audio: { noAudio: true },
  render: { antialias: true, powerPreference: 'high-performance' },
  scene,
});

let app: App | null = null;
const layout = new Layout(game, ui, host, () => app?.ctx.settings.value.uiScale ?? 1);

game.events.once('ready', async () => {
  app = new App({ ui, live, scene, relayout: () => layout.place() });
  const controls = new Controls(host, {
    session: () => app?.flow.session ?? null,
    scheme: () => app?.ctx.settings.value.controls ?? 'thumb',
    gesture: () => app?.ctx.audio.unlock(),
    togglePause: () => {
      if (app?.flow.paused) app.flow.resume();
      else app?.flow.pause();
    },
    restart: () => app?.restart(),
    toggleMute: () => app?.ctx.settings.update({ muted: !app.ctx.settings.value.muted }),
  });
  controls.attach();
  layout.apply();
  window.addEventListener('resize', () => layout.apply());
  window.addEventListener('orientationchange', () => setTimeout(() => layout.apply(), 150));
  game.scale.on('resize', () => layout.place());
  // Show the first screen only once the display fonts are ready, so there is no flash of fallback text.
  await Promise.race([
    Promise.all([document.fonts.load('800 1em "Unbounded Variable"'), document.fonts.load('600 1em "Manrope Variable"')]),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  app.start();
  layout.place();
  document.getElementById('splash')?.remove();
  if (import.meta.env.DEV) void import('./app/dev').then((dev) => dev.installDevHook(app as App, scene, controls));
});
