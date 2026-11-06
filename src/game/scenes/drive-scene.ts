import Phaser from 'phaser';
import { designById, paletteById } from '../cosmetics';
import { districtById, type DistrictTheme } from '../levels/districts';
import { angleDiff } from '../physics/math';
import type { Session } from '../session';
import type { WorldEvent } from '../systems/world-types';
import { ChaseCamera, VIEW } from './camera';
import { drawCar, type CarLook } from './draw/car';
import { City } from './draw/city';
import { Particles, Trails } from './draw/effects';
import { drawGrid } from './draw/grid';
import { drawHazard, drawPickup, type Pen } from './draw/objects';
import { drawAsphalt, drawBarriers, drawLine, drawMarkings, roadEdges, visibleRange } from './draw/road';
import { applyEvent } from './event-effects';
import { QualityMonitor, styleFor, type Level, type LevelStyle } from './quality';
import { Rain } from './rain';

export interface SceneBridge {
  onEvents(events: WorldEvent[], session: Session): void;
  onFrame(session: Session): void;
  popup(text: string, x: number, y: number, kind: string): void;
  reducedMotion(): boolean;
  shakeEnabled(): boolean;
  qualitySetting(): 'auto' | Level;
}

export interface Attach {
  session: Session;
  district: number;
  car: string;
  palette: string;
  seed: number;
}

const AHEAD = 950;
const BEHIND = 340;

type LayerName = 'city' | 'road' | 'edge' | 'trail' | 'obj' | 'objGlow' | 'car' | 'carGlow' | 'fx' | 'hud';
interface CarPose {
  x: number;
  y: number;
  heading: number;
}

/** Draws a run: the road, city, hazards, car and effects, and turns world events into sparks and shake. */
export class DriveScene extends Phaser.Scene {
  private bridge: SceneBridge | null = null;
  private session: Session | null = null;
  private theme: DistrictTheme = districtById(1).theme;
  private look: CarLook = { design: designById('pulse'), palette: paletteById('cyan') };
  private city = new City(1);
  private district = 1;
  private readonly cam = new ChaseCamera();
  private readonly trails = new Trails();
  private readonly particles = new Particles();
  private readonly quality = new QualityMonitor();
  private readonly rain = new Rain();
  private world!: Phaser.GameObjects.Container;
  private layers!: Record<LayerName, Phaser.GameObjects.Graphics>;
  private style: LevelStyle = styleFor('high');
  private level: Level = 'high';
  private bloom: Phaser.FX.Bloom | null = null;
  private clock = 0;
  private lastDriftEmit = 0;

  constructor() {
    super('drive');
  }

  setBridge(bridge: SceneBridge): void {
    this.bridge = bridge;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.theme.ground);
    this.world = this.add.container(0, 0);
    const order: Array<[LayerName, boolean]> = [
      ['city', false], ['road', false], ['edge', true], ['trail', true], ['obj', false], ['objGlow', true],
      ['car', false], ['carGlow', true], ['fx', true],
    ];
    const layers = {} as Record<LayerName, Phaser.GameObjects.Graphics>;
    for (const [name, additive] of order) {
      layers[name] = this.add.graphics();
      if (additive) layers[name].setBlendMode(Phaser.BlendModes.ADD);
      this.world.add(layers[name]);
    }
    layers.hud = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.layers = layers;
    this.applyLevel(this.resolveLevel());
  }

  attach(a: Attach): void {
    this.session = a.session;
    this.district = a.district;
    this.theme = districtById(a.district).theme;
    this.look = { design: designById(a.car), palette: paletteById(a.palette) };
    this.city = new City(a.seed);
    this.trails.clear();
    this.particles.clear();
    this.cameras.main.setBackgroundColor(this.theme.ground);
    const world = a.session.world;
    this.cam.reset(world.track.poseAt(world.s).angle);
    this.quality.resetWindow();
  }

  detach(): void {
    this.session = null;
  }

  /** Converts a world position to canvas coordinates (540 wide), for floating score popups. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    const w = this.world;
    const c = Math.cos(w.rotation);
    const s = Math.sin(w.rotation);
    return { x: w.x + w.scaleX * (c * x - s * y), y: w.y + w.scaleY * (s * x + c * y) };
  }

  private resolveLevel(): Level {
    const setting = this.bridge?.qualitySetting() ?? 'auto';
    return setting === 'auto' ? this.quality.level : setting;
  }

  private applyLevel(level: Level): void {
    this.level = level;
    this.style = styleFor(level);
    this.particles.density = this.style.particles;
    const wantBloom = this.style.bloom && this.renderer.type === Phaser.WEBGL;
    if (wantBloom && !this.bloom) this.bloom = this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.1, 1.05, 4);
    if (!wantBloom && this.bloom) {
      this.cameras.main.postFX.remove(this.bloom);
      this.bloom = null;
    }
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.clock += dt;
    this.quality.sample(delta);
    const wanted = this.resolveLevel();
    if (wanted !== this.level) this.applyLevel(wanted);
    const session = this.session;
    const bridge = this.bridge;
    if (!session || !bridge) return;
    const events = session.advance(delta);
    const reduced = bridge.reducedMotion();
    const targets = {
      particles: this.particles,
      cam: this.cam,
      reduced,
      popup: (text: string, x: number, y: number, kind: string) => this.popupAt(text, x, y, kind),
      roadAngle: session.world.roadAngle,
      palette: this.look.palette,
    };
    for (const event of events) applyEvent(event, targets);
    bridge.onEvents(events, session);
    this.particles.update(dt);
    this.render(session, dt, reduced);
    bridge.onFrame(session);
  }

  private carPose(session: Session): CarPose {
    const car = session.world.car;
    const a = session.alpha;
    const p = session.prev;
    return {
      x: p.x + (car.x - p.x) * a,
      y: p.y + (car.y - p.y) * a,
      heading: p.heading + angleDiff(car.heading, p.heading) * a,
    };
  }

  private render(session: Session, dt: number, reduced: boolean): void {
    const world = session.world;
    const pose = this.carPose(session);
    this.cam.update(dt, world.track.poseAt(world.s + 150).angle, world.boostTicks > 0, reduced);
    const shake = this.bridge?.shakeEnabled() && !reduced ? this.cam.shake : 0;
    const jitter = (): number => (Math.random() - 0.5) * shake * 2;
    const t = this.cam.transform(pose.x, pose.y, jitter(), jitter());
    this.world.setRotation(t.rotation).setScale(t.scale).setPosition(t.x, t.y);
    for (const g of Object.values(this.layers)) g.clear();
    this.drawScenery(session, pose);
    this.drawActors(session, pose);
    this.drawOverlay(session, reduced);
  }

  private drawScenery(session: Session, pose: CarPose): void {
    const world = session.world;
    const track = world.track;
    const s1 = world.s + AHEAD;
    drawGrid(this.layers.city, pose, this.theme.edgeLeft);
    this.city.ensure(track, s1 + 300, this.theme.signs);
    const pen: Pen = { g: this.layers.city, glow: this.layers.edge };
    this.city.draw(pen, pose, [world.s - BEHIND - 200, s1 + 200], { theme: this.theme, walls: this.style.walls });
    const range = visibleRange(track, world.s - BEHIND, s1);
    const edges = roadEdges(track, range, this.style.stride);
    drawAsphalt(this.layers.road, edges, this.theme);
    drawMarkings(this.layers.road, track, range, this.theme);
    drawLine(this.layers.road, track, 60, this.theme.edgeLeft);
    const finish = world.rules.finishS;
    if (finish !== null && finish < s1) drawLine(this.layers.road, track, finish, 0xffffff);
    drawBarriers(this.layers.edge, edges, this.theme, this.style);
  }

  private drawActors(session: Session, pose: CarPose): void {
    const world = session.world;
    const pen: Pen = { g: this.layers.obj, glow: this.layers.objGlow };
    const near = (s: number): boolean => s > world.s - BEHIND && s < world.s + AHEAD;
    for (const h of world.hazards) if (near(h.s)) drawHazard(pen, h, this.clock);
    for (const h of world.traffic) if (near(h.s)) drawHazard(pen, h, this.clock);
    for (const p of world.pickups) if (near(p.s)) drawPickup(this.layers.objGlow, p, this.clock);
    this.emitMotionEffects(session, pose);
    this.trails.draw(this.layers.trail, this.look.palette.glow, this.clock);
    this.particles.draw(this.layers.fx);
    if (world.status === 'crashed') return;
    drawCar({ g: this.layers.car, glow: this.layers.carGlow }, pose, this.look, {
      steer: world.holding ? world.latched : 0,
      boosting: world.boostTicks > 0,
      shield: world.shield,
      magnet: world.magnetTicks > 0,
      t: this.clock,
      blink: world.invulnTicks > 0 && Math.floor(this.clock * 14) % 2 === 0,
    });
  }

  private emitMotionEffects(session: Session, pose: CarPose): void {
    const world = session.world;
    const sliding = world.running && Math.abs(world.slip) > 0.13 && world.car.speed > 120;
    const c = Math.cos(pose.heading);
    const s = Math.sin(pose.heading);
    const wheel = (v: number): [number, number] => [pose.x - c * 11 - s * v, pose.y - s * 11 + c * v];
    this.trails.add([wheel(-7), wheel(7)], sliding, this.clock);
    const behind = pose.heading + Math.PI;
    if (sliding && this.clock - this.lastDriftEmit > 0.035) {
      this.lastDriftEmit = this.clock;
      const [x, y] = wheel(Math.random() < 0.5 ? -7 : 7);
      this.particles.burst(x, y, { count: 1, color: this.look.palette.glow, speed: 60, angle: behind, spread: 1.2 });
    }
    if (world.boostTicks > 0 && world.running) {
      const [x, y] = wheel(0);
      this.particles.burst(x, y, { count: 2, color: 0xffffff, speed: 120, angle: behind, spread: 0.5 });
    }
  }

  private drawOverlay(session: Session, reduced: boolean): void {
    const g = this.layers.hud;
    const speed = session.world.car.speed;
    const enabled = this.district === 2 && !reduced;
    this.rain.draw(g, { enabled, t: this.clock, speed, density: this.style.particles });
    if (session.world.boostTicks > 0 && !reduced) this.drawSpeedLines(g);
  }

  private drawSpeedLines(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2, this.look.palette.glow, 0.35);
    for (let i = 0; i < 14; i++) {
      const x = (i * 97 + Math.floor(this.clock * 900)) % VIEW.width;
      const y = (i * 173 + Math.floor(this.clock * 1900)) % VIEW.height;
      g.lineBetween(x, y, x, y + 70 + (i % 3) * 30);
    }
  }

  private popupAt(text: string, x: number, y: number, kind: string): void {
    const p = this.worldToScreen(x, y);
    this.bridge?.popup(text, p.x, p.y, kind);
  }
}
