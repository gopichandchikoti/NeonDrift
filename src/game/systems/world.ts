import { isHazardKind, placeHazard, placePickup, type Hazard, type Pickup } from '../entities/entities';
import { carCorners, createCar, slipOf, stepCar, type CarState } from '../physics/car';
import { CAR, DT, HANDLING, POINTS, RULES, SIM_HZ } from '../physics/constants';
import { angleDiff } from '../physics/math';
import type { Track } from '../physics/track';
import type { ItemPlacement } from '../physics/track-types';
import { createCombo, tickCombo, type ComboState } from './combo';
import { createDrift, type DriftState } from './drift';
import { checkBarrier, checkHazards, collectPickups, moveHazards, scoreDrift } from './world-rules';
import { createStats, type InputFrame, type RunStats, type RunStatus, type StageRules, type TrackExtender } from './world-types';
import type { WorldEvent } from './world-types';

export interface WorldOptions {
  track: Track;
  items: readonly ItemPlacement[];
  rules: StageRules;
  extender?: TrackExtender;
  /** Where the car starts (distance along the road). */
  startS?: number;
}

/** Everything a run needs, advanced one fixed step at a time. Rendering only ever reads it. */
export class World {
  readonly track: Track;
  readonly rules: StageRules;
  car: CarState;
  status: RunStatus = 'racing';
  tick = 0;
  /** Progress, lateral offset and road state at the car. */
  s: number;
  lateral = 0;
  roadAngle: number;
  halfWidth: number;
  hint: number;
  combo: ComboState = createCombo();
  drift: DriftState = createDrift();
  stats: RunStats = createStats();
  boostMeter = 0;
  boostTicks = 0;
  magnetTicks = 0;
  shield = false;
  /** One-thumb latch: whether the hold was down last step, and the direction it committed to. */
  holding = false;
  latched = 1;
  invulnTicks = 0;
  scrapeCooldown = 0;
  hazards: Hazard[] = [];
  traffic: Hazard[] = [];
  pickups: Pickup[] = [];
  events: WorldEvent[] = [];
  hazardCursor = 0;
  pickupCursor = 0;
  /** Endless mode only: switched off while the autopilot looks ahead, so a rollout never changes the road. */
  extending = true;
  private readonly extender: TrackExtender | undefined;
  private nextId = 1;

  constructor(options: WorldOptions) {
    this.track = options.track;
    this.rules = options.rules;
    this.extender = options.extender;
    this.s = options.startS ?? 60;
    const pose = this.track.poseAt(this.s);
    this.car = createCar(pose.x, pose.y, pose.angle);
    this.roadAngle = pose.angle;
    this.halfWidth = pose.halfWidth;
    this.hint = this.track.indexAt(this.s);
    this.shield = options.rules.startShield ?? false;
    this.addItems(options.items);
  }

  addItems(items: readonly ItemPlacement[]): void {
    const hazards: Hazard[] = [];
    const pickups: Pickup[] = [];
    for (const item of items) {
      const id = this.nextId++;
      if (item.kind === 'traffic') this.traffic.push(placeHazard(this.track, item, id));
      else if (isHazardKind(item.kind)) hazards.push(placeHazard(this.track, item, id));
      else pickups.push(placePickup(this.track, item, id));
    }
    this.hazards.push(...hazards.sort((a, b) => a.s - b.s));
    this.pickups.push(...pickups.sort((a, b) => a.s - b.s));
  }

  get running(): boolean {
    return this.status === 'racing';
  }

  get slip(): number {
    return slipOf(this.car);
  }

  /** Target cruising speed at the car's position (endless mode speeds up with distance). */
  speedAt(s: number): number {
    const ramp = (this.rules.speedRamp ?? 0) * (s / 1000);
    return Math.min(this.rules.maxSpeed ?? Infinity, this.rules.baseSpeed + ramp);
  }

  /**
   * One-thumb steering: a press commits to the bend ahead (the direction is latched when the press starts and kept
   * until release), so the direction never changes under a thumb that is still down. Explicit left/right wins.
   */
  private resolveSteer(input: InputFrame): number {
    if (input.steer !== 0) {
      this.holding = false;
      return Math.sign(input.steer);
    }
    if (input.hold && !this.holding) this.latched = this.track.assistAt(this.s + 20);
    this.holding = input.hold;
    return input.hold ? this.latched : 0;
  }

  /** Which way a hold steers right now (or would, if pressed now): drives the HUD's steering cue. */
  get steerCue(): number {
    return this.holding ? this.latched : this.track.assistAt(this.s + 20);
  }

  step(input: InputFrame): void {
    if (this.status !== 'racing') {
      this.coast();
      return;
    }
    this.tick += 1;
    this.stats.ticks = this.tick;
    this.growTrack();
    this.handleBoost(input);
    const before = this.s;
    const boost = this.boostTicks > 0 ? HANDLING.boostFactor : 1;
    stepCar(this.car, {
      steer: this.resolveSteer(input),
      roadAngle: this.roadAngle,
      targetSpeed: this.speedAt(this.s) * boost,
      sensitivity: this.rules.sensitivity ?? 1,
    });
    this.updateRoad();
    const progress = this.s - before;
    this.stats.distance = Math.max(this.stats.distance, this.s);
    moveHazards(this);
    if (this.checkSpin() || checkBarrier(this) || checkHazards(this)) return;
    collectPickups(this);
    scoreDrift(this, progress);
    this.tickTimers();
    this.checkFinish();
  }

  private growTrack(): void {
    if (!this.extender || !this.extending) return;
    if (this.track.length - this.s > 3200) return;
    this.addItems(this.extender.extend(this.track));
  }

  private handleBoost(input: InputFrame): void {
    if (!input.boost || this.boostMeter < 1 || this.boostTicks > 0) return;
    this.boostMeter = 0;
    this.boostTicks = Math.round(RULES.boostTime * SIM_HZ);
    this.stats.boosts += 1;
    this.events.push({ type: 'boost-start' });
  }

  addBoost(amount: number): void {
    if (this.boostTicks > 0 || this.boostMeter >= 1) return;
    this.boostMeter = Math.min(1, this.boostMeter + amount);
    if (this.boostMeter >= 1) this.events.push({ type: 'boost-ready' });
  }

  updateRoad(): void {
    const p = this.track.project(this.car.x, this.car.y, this.hint);
    this.hint = p.index;
    this.s = p.s;
    this.lateral = p.lateral;
    this.roadAngle = p.angle;
    this.halfWidth = p.halfWidth;
  }

  /** Lateral offsets of the four body corners (for barrier contact and edge kisses). */
  cornerLaterals(): number[] {
    const sin = Math.sin(this.roadAngle);
    const cos = Math.cos(this.roadAngle);
    return carCorners(this.car, CAR.halfLength, CAR.halfWidth).map(
      (c) => this.lateral + -(c.x - this.car.x) * sin + (c.y - this.car.y) * cos,
    );
  }

  /** Travelling sideways or backwards relative to the road is a spin-out. */
  private checkSpin(): boolean {
    if (Math.cos(angleDiff(this.car.velAngle, this.roadAngle)) > -0.05) return false;
    this.crash('spin');
    return true;
  }

  crash(reason: 'barrier' | 'hazard' | 'spin'): void {
    this.status = 'crashed';
    this.events.push({ type: 'crash', reason, x: this.car.x, y: this.car.y });
  }

  private tickTimers(): void {
    const decay = tickCombo(this.combo);
    if (decay === 'level') this.events.push({ type: 'combo-drop', level: this.combo.level });
    if (this.boostTicks > 0) this.boostTicks -= 1;
    if (this.magnetTicks > 0) this.magnetTicks -= 1;
    if (this.invulnTicks > 0) this.invulnTicks -= 1;
    if (this.scrapeCooldown > 0) this.scrapeCooldown -= 1;
  }

  private checkFinish(): void {
    const finish = this.rules.finishS;
    if (finish === null || this.s < finish) return;
    scoreDrift(this, 0, true);
    this.status = 'finished';
    this.stats.finishTicks = this.tick;
    const clean = this.stats.scrapes === 0 && this.stats.shieldsUsed === 0;
    if (clean) this.stats.score += POINTS.cleanFinish;
    this.events.push({ type: 'finish', clean });
  }

  /** After the finish the car rolls to a stop along the road, with no scoring and no collisions. */
  private coast(): void {
    if (this.status !== 'finished' || this.car.speed <= 0) return;
    stepCar(this.car, { steer: 0, roadAngle: this.roadAngle, targetSpeed: 0, sensitivity: 1 });
    this.car.speed = Math.max(0, this.car.speed - 420 * DT);
    this.updateRoad();
  }
}
