import { stageById } from '../game/levels/catalog';
import { createStageWorld, decodeInput } from '../game/levels/runner';
import type { DriveScene } from '../game/scenes/drive-scene';
import { Session } from '../game/session';
import type { AppContext } from './context';

/** Stages the menu background rotates through: each shows a different district and a different driving style. */
const SHOWCASE = ['1-02', '3-03', '5-02', '2-07', '6-05', '4-08', '3-08', '5-08'];
const PAUSE_BETWEEN_MS = 1300;

/**
 * The live demo behind the menus: the game's own renderer replaying a stage with the recorded autopilot input.
 * It is the same simulation and the same drawing as a real run, so the menu always shows the real game.
 */
export class Attract {
  private index = Math.floor(Math.random() * SHOWCASE.length);
  private active = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly scene: DriveScene,
  ) {}

  start(): void {
    this.active = true;
    for (let tries = 0; tries < SHOWCASE.length; tries++) {
      const stage = stageById(SHOWCASE[this.index % SHOWCASE.length] as string);
      this.index += 1;
      const cal = stage?.calibration;
      if (!stage || !cal) continue;
      const session = new Session({ world: createStageWorld(stage), mode: 'stage', stage });
      session.script = decodeInput(cal.input);
      const garage = this.ctx.progress.value.garage;
      const seed = stage.index * 31;
      this.scene.attach({ session, district: stage.district, car: garage.car, palette: garage.palette, seed });
      this.session = session;
      return;
    }
  }

  private session: Session | null = null;

  /** Called every frame while the demo is showing: starts the next stage when this one has played out. */
  frame(session: Session): void {
    if (!this.active || session !== this.session) return;
    if (!session.world.running && session.sinceEnd > PAUSE_BETWEEN_MS) this.start();
  }

  stop(): void {
    this.active = false;
    this.session = null;
  }
}
