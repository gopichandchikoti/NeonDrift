import { createStageWorld } from '../game/levels/runner';
import { stageById } from '../game/levels/catalog';
import { createDailyWorld, createEndlessWorld, dailySpec, type ModeWorld } from '../game/levels/modes';
import type { DriveScene, SceneBridge } from '../game/scenes/drive-scene';
import { Session, type RunMode, type RunResult } from '../game/session';
import type { Stage } from '../game/levels/types';
import type { WorldEvent } from '../game/systems/world-types';
import { dateKey } from '../services/progress';
import { reducedMotion } from '../services/settings';
import { Hud } from '../ui/hud';
import { h } from '../ui/dom';
import { howToContent } from '../ui/screens/info';
import { buildResults } from '../ui/screens/results';
import { settingsPanel } from '../ui/screens/settings';
import type { OpenDialog } from '../ui/dialogs';
import { Attract } from './attract';
import type { AppContext } from './context';
import { feedbackFor, musicIntensity, type Feedback } from './run-effects';
import type { ScreenHost } from './screens';

export type RunSpec = { kind: 'stage'; id: string } | { kind: 'endless' } | { kind: 'daily'; key: string };

/** After this many failed attempts at a stage, the next attempt starts with a free shield. */
const MERCY_AFTER = 3;

/**
 * Owns a run from start to results: builds the world, mounts the HUD, turns world events into sound, touch feedback
 * and effects, handles pause and restart, and records the result when the run ends.
 */
export class RunFlow implements SceneBridge {
  session: Session | null = null;
  private hud: Hud | null = null;
  private spec: RunSpec | null = null;
  private pauseDialog: OpenDialog | null = null;
  private recorded = false;
  private readonly fails = new Map<string, number>();
  private readonly attract: Attract;
  private mode: 'idle' | 'attract' | 'run' = 'idle';
  /** Where an endless run's road comes from. Random for players; tests replace it to get the same road every time. */
  seedFor: () => number = () => Math.floor(Math.random() * 0x7fffffff);

  constructor(
    private readonly ctx: AppContext,
    private readonly scene: DriveScene,
    private readonly uiRoot: HTMLElement,
    private readonly screens: ScreenHost,
  ) {
    this.attract = new Attract(ctx, scene);
    scene.setBridge(this);
  }

  get running(): boolean {
    return this.mode === 'run' && this.session !== null && this.session.world.running;
  }

  get inRun(): boolean {
    return this.mode === 'run';
  }

  get paused(): boolean {
    return this.session?.paused === true;
  }

  // ---- SceneBridge -------------------------------------------------------------------------------------------

  reducedMotion(): boolean {
    return reducedMotion(this.ctx.settings.value, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  shakeEnabled(): boolean {
    return this.ctx.settings.value.screenShake;
  }

  qualitySetting(): 'auto' | 'high' | 'medium' | 'low' {
    return this.ctx.settings.value.quality;
  }

  popup(text: string, x: number, y: number, kind: string): void {
    if (this.mode === 'run') this.hud?.popup(text, x, y, kind);
  }

  onEvents(events: WorldEvent[], session: Session): void {
    if (this.mode !== 'run') return;
    for (const event of events) {
      const feedback = feedbackFor(event, session.world.combo.level);
      if (feedback) this.give(feedback);
    }
  }

  private give(feedback: Feedback): void {
    if (feedback.sfx) this.ctx.audio.sfx.play(feedback.sfx, feedback.level ?? 0);
    if (feedback.haptic) this.ctx.haptics.play(feedback.haptic);
    if (feedback.flash) this.hud?.flash();
    if (feedback.pulse) this.hud?.pulseCombo();
    if (feedback.say) this.ctx.announce(feedback.say);
  }

  onFrame(session: Session): void {
    if (this.mode === 'attract') return this.attract.frame(session);
    if (this.mode !== 'run') return;
    const w = session.world;
    this.hud?.update(session);
    this.ctx.audio.drive.update(w.car.speed, Math.abs(w.slip), w.boostTicks > 0, w.running && !session.paused);
    this.ctx.audio.music.setIntensity(musicIntensity(w.combo.level, w.boostTicks > 0));
    if (session.result && !this.recorded) this.finish(session.result);
  }

  // ---- starting and leaving ----------------------------------------------------------------------------------

  startAttract(): void {
    this.leaveRun();
    this.mode = 'attract';
    this.attract.start();
  }

  start(spec: RunSpec): void {
    this.leaveRun();
    this.spec = spec;
    this.recorded = false;
    const built = this.build(spec);
    if (!built) return this.ctx.nav.quitToMenu();
    const { session, district, seed } = built;
    this.session = session;
    this.mode = 'run';
    this.screens.clear();
    const settings = this.ctx.settings.value;
    const garage = this.ctx.progress.value.garage;
    this.scene.attach({ session, district, car: garage.car, palette: garage.palette, seed });
    this.hud = new Hud(
      {
        pause: () => this.pause(),
        boost: () => session.queueBoost(),
        steer: (side, down) => session.setSource(side === 'left' ? 'left-button' : 'right-button', down),
      },
      settings.controls,
      spec.kind === 'stage',
    );
    this.uiRoot.prepend(this.hud.el);
    (document.activeElement as HTMLElement | null)?.blur();
    this.ctx.audio.unlock();
    this.ctx.audio.drive.start();
    this.ctx.audio.music.start(district);
    this.ctx.announce(this.describe(spec));
  }

  private describe(spec: RunSpec): string {
    if (spec.kind === 'stage') return `${stageById(spec.id)?.name ?? 'Stage'}. Go.`;
    return spec.kind === 'daily' ? 'Daily challenge. Go.' : 'Endless. Go.';
  }

  private build(spec: RunSpec): { session: Session; district: number; seed: number } | null {
    const sensitivity = this.ctx.settings.value.sensitivity;
    if (spec.kind === 'stage') {
      const stage = stageById(spec.id);
      if (!stage) return null;
      const world = createStageWorld(stage, { sensitivity });
      if ((this.fails.get(stage.id) ?? 0) >= MERCY_AFTER && !world.shield) {
        world.shield = true;
        this.ctx.toast('A free shield, since this one is tough.');
      }
      const session = new Session({ world, mode: 'stage', stage, cues: stage.tutorial ?? [] });
      return { session, district: stage.district, seed: stage.district * 100 + stage.index };
    }
    const mode: RunMode = spec.kind;
    const made: ModeWorld = spec.kind === 'daily'
      ? createDailyWorld(dailySpec(spec.key), sensitivity)
      : createEndlessWorld(this.seedFor(), sensitivity);
    return { session: new Session({ world: made.world, mode }), district: made.district, seed: made.seed };
  }

  restart(): void {
    const spec = this.spec?.kind === 'daily' ? { kind: 'daily' as const, key: dateKey(this.ctx.now()) } : this.spec;
    if (spec) this.start(spec);
  }

  /** Stops sound and effects for the current run without recording anything. */
  private leaveRun(): void {
    this.pauseDialog?.close();
    this.pauseDialog = null;
    this.ctx.audio.drive.stop();
    this.ctx.audio.music.stop();
    this.hud?.el.remove();
    this.hud = null;
    this.session?.clearInput();
    this.session = null;
    this.mode = 'idle';
    this.attract.stop();
    this.scene.detach();
  }

  quit(): void {
    this.leaveRun();
  }

  // ---- pause ---------------------------------------------------------------------------------------------------

  pause(): void {
    const session = this.session;
    if (this.mode !== 'run' || !session || session.paused || !session.world.running) return;
    session.paused = true;
    session.clearInput();
    this.ctx.audio.drive.update(0, 0, false, false);
    this.ctx.audio.sfx.play('tap');
    this.pauseDialog = this.ctx.dialogs.open({
      title: 'Paused',
      center: true,
      body: this.pauseBody(),
      onClose: () => {
        if (this.session === session && session.paused && this.pauseDialog) this.resume();
      },
    });
  }

  private pauseBody(): HTMLElement {
    const ctx = this.ctx;
    const action = (label: string, run: () => void, kind = ''): HTMLElement =>
      h('button', { class: `btn btn--block ${kind}`, type: 'button', onClick: run }, label);
    return h('div', { style: 'display:flex;flex-direction:column;gap:.5rem' },
      action('Resume', () => this.resume(), 'btn--primary btn--big'),
      action('Restart', () => ctx.nav.restart()),
      action('How to play', () => ctx.dialogs.open({ title: 'How to play', body: howToContent(), actions: [{ label: 'Back', kind: 'primary', onClick: () => undefined }] })),
      action('Settings', () => ctx.dialogs.open({ title: 'Settings', body: settingsPanel(ctx, false), actions: [{ label: 'Done', kind: 'primary', onClick: () => undefined }] })),
      action(this.spec?.kind === 'stage' ? 'Quit to stages' : 'Quit to menu', () => (this.spec?.kind === 'stage' ? ctx.nav.quitToStages() : ctx.nav.quitToMenu()), 'btn--ghost'),
    );
  }

  resume(): void {
    const session = this.session;
    if (!session || !session.paused) return;
    const dialog = this.pauseDialog;
    this.pauseDialog = null;
    session.paused = false;
    dialog?.close();
    this.ctx.audio.sfx.play('tap');
  }

  // ---- finishing -----------------------------------------------------------------------------------------------

  private finish(result: RunResult): void {
    this.recorded = true;
    this.ctx.audio.drive.stop();
    this.ctx.audio.music.stop();
    const stage = result.stage;
    const key = this.spec?.kind === 'daily' ? this.spec.key : dateKey(this.ctx.now());
    const report = this.ctx.progress.record(result, key);
    if (stage) this.fails.set(stage.id, result.verdict.stars > 0 ? 0 : (this.fails.get(stage.id) ?? 0) + 1);
    this.hud?.el.remove();
    this.hud = null;
    const view = buildResults(this.ctx, result, report, { retry: () => this.ctx.nav.restart() });
    this.screens.show(view);
    if (report.newAchievements.length > 0) this.ctx.audio.sfx.play('achievement');
    if (!this.ctx.progress.saveWorks) this.ctx.toast('Progress could not be saved on this device.');
  }

  /** The stage being played, if any. */
  get stage(): Stage | null {
    return this.session?.stage ?? null;
  }
}

