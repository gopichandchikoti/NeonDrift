import type { DriveScene } from '../game/scenes/drive-scene';
import { STAGE_DEFS } from '../game/levels/stages';
import type { Session } from '../game/session';
import type { App } from './app';
import type { Controls } from './controls';

function describe(session: Session | null): Record<string, unknown> {
  if (!session) return { status: null, stats: null, result: null, stage: null, paused: false };
  const w = session.world;
  return {
    paused: session.paused,
    status: w.status,
    s: w.s,
    lateral: w.lateral,
    score: w.stats.score,
    combo: w.combo.level,
    speed: w.car.speed,
    slip: w.slip,
    tick: w.tick,
    shield: w.shield,
    stage: session.stage?.id ?? null,
    stats: { ...w.stats },
    result: session.result ? { outcome: session.result.outcome, stars: session.result.verdict.stars } : null,
  };
}

/**
 * Development-only inspector (imported behind import.meta.env.DEV, so it is never part of a production build or the
 * Android app). The browser tests use it to read game state and to set up progress without replaying the game.
 */
export function installDevHook(app: App, scene: DriveScene, controls: Controls): void {
  const hook = {
    app,
    scene,
    controls,
    ctx: app.ctx,
    get session() {
      return app.flow.session;
    },
    snapshot: () => ({ mode: app.flow.inRun ? 'run' : 'menu', ...describe(app.flow.session) }),
    /** Marks every stage up to and including `id` as cleared with one star, so later stages can be opened. */
    unlockThrough(id: string): void {
      app.ctx.progress.update((p) => {
        const end = STAGE_DEFS.findIndex((def) => def.id === id);
        for (const def of STAGE_DEFS.slice(0, end + 1)) {
          p.stages[def.id] = { stars: 1, bestScore: 1000, bestTicks: null, attempts: 1, cleared: true };
        }
      });
    },
  };
  (window as unknown as { __nd: typeof hook }).__nd = hook;
}
