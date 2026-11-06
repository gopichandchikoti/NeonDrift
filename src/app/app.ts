import pkg from '../../package.json';
import type { DriveScene } from '../game/scenes/drive-scene';
import { createHapticsBackend, Haptics } from '../platform/haptics';
import { createDefaultLifecycle, type Lifecycle } from '../platform/lifecycle';
import { exitApp, isNative } from '../platform/native';
import { AudioKit } from '../services/audio';
import { dateKey, ProgressStore } from '../services/progress';
import { SettingsStore } from '../services/settings';
import { createDefaultStore } from '../services/storage/store';
import { h } from '../ui/dom';
import { Dialogs } from '../ui/dialogs';
import { buildGarage } from '../ui/screens/garage';
import { buildCredits, buildHowTo } from '../ui/screens/info';
import { buildAchievements, buildBoards } from '../ui/screens/lists';
import { buildMenu } from '../ui/screens/menu';
import { buildSettings } from '../ui/screens/settings';
import { buildStages } from '../ui/screens/stages';
import type { AppContext, Nav, ScreenName, ScreenView } from './context';
import { RunFlow } from './run-flow';
import { ScreenHost } from './screens';

interface HistoryEntry {
  screen: ScreenName;
  params?: { district?: number };
}

export interface AppParts {
  ui: HTMLElement;
  live: HTMLElement;
  scene: DriveScene;
  /** Re-places the interface over the canvas (after a settings change such as interface size). */
  relayout: () => void;
}

/** The whole application: services, navigation between screens, the run flow, and the Android lifecycle. */
export class App implements Nav {
  readonly ctx: AppContext;
  readonly flow: RunFlow;
  private readonly screens: ScreenHost;
  private readonly toasts: HTMLElement;
  private readonly lifecycle: Lifecycle;
  private history: HistoryEntry[] = [];

  constructor(private readonly parts: AppParts) {
    const { store, persistent } = createDefaultStore();
    const settings = new SettingsStore(store);
    const progress = new ProgressStore(store);
    progress.saveWorks = progress.saveWorks && persistent;
    const audio = new AudioKit();
    audio.apply(settings.value);
    this.toasts = h('div', { class: 'toast-layer', 'aria-hidden': 'true' });
    const dialogLayer = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    dialogLayer.addEventListener('pointerdown', (e) => e.stopPropagation());
    const dialogs = new Dialogs(dialogLayer);
    this.ctx = {
      progress, settings, audio, dialogs, nav: this,
      haptics: new Haptics(createHapticsBackend(), () => settings.value.haptics),
      now: () => new Date(),
      toast: (message, strong) => this.toast(message, strong),
      announce: (message) => {
        parts.live.textContent = '';
        parts.live.textContent = message;
      },
      exit: exitApp,
      version: pkg.version,
      isNative: isNative(),
    };
    this.screens = new ScreenHost(parts.ui, this.ctx.announce);
    this.flow = new RunFlow(this.ctx, parts.scene, parts.ui, this.screens);
    parts.ui.append(this.toasts, dialogLayer);
    this.lifecycle = createDefaultLifecycle();
    this.applySettings();
    settings.subscribe(() => this.applySettings());
  }

  start(): void {
    this.lifecycle.onBackground(() => {
      this.flow.pause();
      this.ctx.audio.suspend();
    });
    this.lifecycle.onForeground(() => this.ctx.audio.resume());
    this.lifecycle.onBack(() => this.back());
    this.show('menu');
    this.flow.startAttract();
    if (!this.ctx.progress.value.tutorialDone) setTimeout(() => this.welcome(), 500);
  }

  private applySettings(): void {
    const s = this.ctx.settings.value;
    this.ctx.audio.apply(s);
    document.documentElement.dataset.motion = s.motion === 'system' ? 'system' : s.motion;
    this.parts.relayout();
  }

  private welcome(): void {
    if (this.flow.inRun || this.ctx.dialogs.isOpen) return;
    const ctx = this.ctx;
    const done = (): void => ctx.progress.update((p) => {
      p.tutorialDone = true;
    });
    ctx.dialogs.open({
      title: 'Welcome to Neon Drift',
      center: true,
      body: h('div', { class: 'prose' },
        h('p', {}, h('b', {}, 'Hold'), ' anywhere to turn into the bend. ', h('b', {}, 'Release'), ' to straighten out.'),
        h('p', {}, 'Long holds make the car slide. Slide cleanly, pass hazards close, and build the combo.'),
      ),
      actions: [
        { label: 'Details', kind: 'ghost', onClick: () => { done(); this.show('howto'); } },
        { label: "Let's go", kind: 'primary', onClick: () => { done(); this.playStage('1-01'); } },
      ],
      onClose: done,
    });
  }

  // ---- toasts --------------------------------------------------------------------------------------------------

  private toast(message: string, strong?: string): void {
    const el = h('div', { class: 'toast' }, strong ? h('b', {}, `${strong} `) : null, message);
    this.toasts.append(el);
    this.ctx.announce(message);
    setTimeout(() => el.remove(), 3700);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
  }

  // ---- navigation (Nav) ------------------------------------------------------------------------------------------

  private build(entry: HistoryEntry): ScreenView {
    const ctx = this.ctx;
    switch (entry.screen) {
      case 'menu': return buildMenu(ctx);
      case 'stages': return buildStages(ctx, entry.params);
      case 'garage': return buildGarage(ctx);
      case 'settings': return buildSettings(ctx);
      case 'achievements': return buildAchievements(ctx);
      case 'howto': return buildHowTo(ctx);
      case 'credits': return buildCredits(ctx);
      case 'boards': return buildBoards(ctx);
    }
  }

  show(screen: ScreenName, params?: { district?: number }): void {
    const entry: HistoryEntry = { screen, params };
    const top = this.history[this.history.length - 1];
    if (screen === 'menu') this.history = [entry];
    else if (top?.screen === screen) this.history[this.history.length - 1] = entry;
    else this.history.push(entry);
    this.ctx.audio.sfx.play('tap');
    this.screens.show(this.build(entry));
  }

  back(): void {
    if (this.ctx.dialogs.closeTop()) return;
    if (this.flow.inRun) return this.backInRun();
    if (this.history.length > 1) {
      this.history.pop();
      const entry = this.history[this.history.length - 1] as HistoryEntry;
      this.ctx.audio.sfx.play('back');
      this.screens.show(this.build(entry));
      return;
    }
    this.ctx.exit();
  }

  private backInRun(): void {
    if (this.flow.paused) return this.flow.resume();
    if (this.flow.running) return this.flow.pause();
    // The results screen is showing: leave it.
    if (this.flow.session?.stage) this.quitToStages();
    else this.quitToMenu();
  }

  resume(): void {
    this.flow.resume();
  }

  playStage(id: string): void {
    this.ctx.dialogs.closeAll();
    this.flow.start({ kind: 'stage', id });
  }

  playEndless(): void {
    this.ctx.dialogs.closeAll();
    this.flow.start({ kind: 'endless' });
  }

  playDaily(): void {
    this.ctx.dialogs.closeAll();
    this.flow.start({ kind: 'daily', key: dateKey(this.ctx.now()) });
  }

  restart(): void {
    this.ctx.dialogs.closeAll();
    this.flow.restart();
  }

  quitToMenu(): void {
    this.leaveRun();
    this.show('menu');
  }

  quitToStages(): void {
    this.leaveRun();
    this.history = [{ screen: 'menu' }];
    this.show('stages', { district: undefined });
  }

  private leaveRun(): void {
    this.ctx.dialogs.closeAll();
    this.flow.quit();
    this.flow.startAttract();
  }
}
