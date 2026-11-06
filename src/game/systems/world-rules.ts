import { circleGap, SHAPES, type Hazard, type Pickup } from '../entities/entities';
import { CAR, DT, POINTS, RULES, SIM_HZ } from '../physics/constants';
import { angleDiff, clamp } from '../physics/math';
import { addManeuver, breakCombo } from './combo';
import { endDrift, resetDrift, updateDrift } from './drift';
import type { World } from './world';

const TRAFFIC_WAKE = 560;
const TRAFFIC_SIGNAL = 230;
const LANE_CHANGE_TIME = 1.1;

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function placeOnRoad(w: World, h: Hazard): void {
  const p = w.track.pointAt(h.s, h.lat);
  h.x = p.x;
  h.y = p.y;
  h.angle = p.angle;
}

function moveTraffic(w: World, h: Hazard): void {
  if (h.hit) return;
  const gap = h.s - w.s;
  if (gap < TRAFFIC_WAKE) h.s = Math.min(w.track.length - 40, h.s + h.speed * DT);
  if (h.targetLat !== h.baseLat && gap < TRAFFIC_SIGNAL) h.laneT += DT / LANE_CHANGE_TIME;
  // The first 35% of the lane change is the blinker only; then the car moves over.
  h.lat = h.baseLat + (h.targetLat - h.baseLat) * smoothstep((h.laneT - 0.35) / 0.65);
  placeOnRoad(w, h);
}

/** Gates slide across the road on a fixed clock; traffic wakes as the car approaches. */
export function moveHazards(w: World): void {
  for (let i = w.hazardCursor; i < w.hazards.length; i++) {
    const h = w.hazards[i] as Hazard;
    if (h.s > w.s + 900) break;
    if (h.kind !== 'gate') continue;
    h.lat = h.baseLat + h.amp * Math.sin(Math.PI * 2 * (w.tick / h.period + h.phase));
    placeOnRoad(w, h);
  }
  for (const h of w.traffic) moveTraffic(w, h);
}

/** Loses the current drift and combo and slows the car: the price of touching anything. */
function penalise(w: World): void {
  resetDrift(w.drift);
  if (breakCombo(w.combo)) w.events.push({ type: 'combo-break' });
}

function useShield(w: World): void {
  w.shield = false;
  w.invulnTicks = Math.round(RULES.shieldGrace * SIM_HZ);
  w.stats.shieldsUsed += 1;
  w.events.push({ type: 'shield-break', x: w.car.x, y: w.car.y });
}

/**
 * Barrier contact. A shallow touch is a scrape (the car is pushed back and slowed); a steep impact is a crash unless a
 * shield absorbs it. Returns true when the run ended.
 */
export function checkBarrier(w: World): boolean {
  const laterals = w.cornerLaterals();
  const limit = w.halfWidth - RULES.barrierPad;
  let worst = 0;
  for (const lat of laterals) if (Math.abs(lat) > Math.abs(worst)) worst = lat;
  const over = Math.abs(worst) - limit;
  if (over <= 0) return false;
  const side = Math.sign(worst);
  const impact = angleDiff(w.car.velAngle, w.roadAngle) * side;
  const protectedHit = w.invulnTicks > 0 || w.shield;
  if (impact >= w.rules.scrapeAngle && !protectedHit) {
    w.crash('barrier');
    return true;
  }
  if (impact >= w.rules.scrapeAngle && w.invulnTicks === 0) useShield(w);
  scrape(w, side, over, Math.max(0, impact));
  return false;
}

function scrape(w: World, side: number, over: number, impact: number): void {
  const nx = -Math.sin(w.roadAngle);
  const ny = Math.cos(w.roadAngle);
  w.car.x -= nx * side * (over + 0.5);
  w.car.y -= ny * side * (over + 0.5);
  w.car.velAngle = w.roadAngle - side * 0.02;
  w.car.heading -= side * impact * 0.6;
  w.car.yawRate *= 0.3;
  w.updateRoad();
  if (w.scrapeCooldown > 0) return;
  w.scrapeCooldown = Math.round(RULES.scrapeCooldown * SIM_HZ);
  w.car.speed *= RULES.scrapeSpeedLoss;
  w.stats.scrapes += 1;
  penalise(w);
  w.events.push({ type: 'scrape', side, x: w.car.x, y: w.car.y });
}

function carGap(w: World, h: Hazard): number {
  const c = Math.cos(w.car.heading);
  const s = Math.sin(w.car.heading);
  let gap = Infinity;
  for (const offset of CAR.circleOffsets) {
    gap = Math.min(gap, circleGap(h, w.car.x + c * offset, w.car.y + s * offset, CAR.circleRadius));
  }
  return gap;
}

function hitHazard(w: World, h: Hazard): boolean {
  if (w.invulnTicks > 0) return false;
  if (!w.shield) {
    h.hit = true;
    w.crash('hazard');
    return true;
  }
  h.hit = true;
  h.resolved = true;
  useShield(w);
  w.car.speed *= RULES.scrapeSpeedLoss;
  penalise(w);
  return false;
}

function award(w: World, points: number): number {
  const total = Math.round(points * w.combo.level);
  w.stats.score += total;
  return total;
}

function maneuver(w: World): void {
  if (addManeuver(w.combo)) w.events.push({ type: 'combo-up', level: w.combo.level });
  w.stats.peakCombo = Math.max(w.stats.peakCombo, w.combo.peak);
}

function resolvePass(w: World, h: Hazard): void {
  h.resolved = true;
  if (h.kind === 'traffic') {
    w.stats.trafficPassed += 1;
    w.events.push({ type: 'traffic-pass', points: award(w, POINTS.trafficPass), x: h.x, y: h.y });
  }
  if (h.minGap >= RULES.nearMissGap) return;
  w.stats.nearMisses += 1;
  w.addBoost(0.16);
  const points = award(w, POINTS.nearMiss);
  maneuver(w);
  w.events.push({ type: 'near-miss', points, hazard: h.kind, x: h.x, y: h.y });
}

function checkOne(w: World, h: Hazard): boolean {
  if (h.resolved || h.hit) return false;
  const ahead = h.s - w.s;
  if (ahead < -(SHAPES[h.kind].along + CAR.halfLength + 12)) {
    resolvePass(w, h);
    return false;
  }
  if (ahead > 80) return false;
  const gap = carGap(w, h);
  if (gap < 0) return hitHazard(w, h);
  h.minGap = Math.min(h.minGap, gap);
  return false;
}

/** Collisions and near misses with hazards and traffic. Returns true when the run ended. */
export function checkHazards(w: World): boolean {
  while (w.hazardCursor < w.hazards.length && (w.hazards[w.hazardCursor] as Hazard).s < w.s - 400) w.hazardCursor++;
  for (let i = w.hazardCursor; i < w.hazards.length; i++) {
    const h = w.hazards[i] as Hazard;
    if (h.s > w.s + 120) break;
    if (checkOne(w, h)) return true;
  }
  for (const h of w.traffic) if (Math.abs(h.s - w.s) < 160 && checkOne(w, h)) return true;
  return false;
}

function skipPassedPickups(w: World): void {
  while (w.pickupCursor < w.pickups.length && (w.pickups[w.pickupCursor]?.s ?? 0) < w.s - 300) w.pickupCursor++;
}

/** The magnet drags a spark toward the car. `to` is the vector from the spark to the car, `d` its length. */
function pullSpark(w: World, p: Pickup, to: { x: number; y: number; d: number }): void {
  const pull = Math.min(to.d, (w.car.speed + 340) * DT);
  p.x += (to.x / to.d) * pull;
  p.y += (to.y / to.d) * pull;
}

function touch(w: World, p: Pickup, magnet: boolean, reach: number): void {
  const dx = w.car.x - p.x;
  const dy = w.car.y - p.y;
  const d = Math.hypot(dx, dy);
  const pullable = magnet && p.kind === 'spark' && d < reach && d > RULES.sparkRadius;
  if (pullable) return pullSpark(w, p, { x: dx, y: dy, d });
  if (d <= RULES.sparkRadius + (p.kind === 'spark' ? 0 : 4)) take(w, p);
}

/** Sparks, shields and magnets; the magnet pulls sparks in from a distance. */
export function collectPickups(w: World): void {
  skipPassedPickups(w);
  const magnet = w.magnetTicks > 0;
  const reach = magnet ? RULES.magnetRadius : RULES.sparkRadius;
  for (let i = w.pickupCursor; i < w.pickups.length; i++) {
    const p = w.pickups[i];
    if (!p || p.s > w.s + reach + 40) break;
    if (!p.taken) touch(w, p, magnet, reach);
  }
}

function take(w: World, p: { kind: string; x: number; y: number; taken: boolean }): void {
  p.taken = true;
  if (p.kind === 'spark') {
    w.stats.sparks += 1;
    w.addBoost(0.03);
    w.events.push({ type: 'spark', points: award(w, POINTS.spark), x: p.x, y: p.y });
  } else if (p.kind === 'shield') {
    w.shield = true;
    w.events.push({ type: 'shield-pickup', x: p.x, y: p.y });
  } else {
    w.magnetTicks = Math.round(RULES.magnetTime * SIM_HZ);
    w.events.push({ type: 'magnet-pickup', x: p.x, y: p.y });
  }
}

function edgeKiss(w: World): void {
  if (!w.drift.active || w.drift.kissed) return;
  const limit = w.halfWidth - RULES.barrierPad;
  const closest = Math.max(...w.cornerLaterals().map(Math.abs));
  const clearance = limit - closest;
  if (clearance <= 0 || clearance >= RULES.edgeKissGap) return;
  w.drift.kissed = true;
  w.stats.edgeKisses += 1;
  w.addBoost(0.05);
  const points = award(w, POINTS.edgeKiss);
  maneuver(w);
  w.events.push({ type: 'edge-kiss', points, x: w.car.x, y: w.car.y });
}

/** Banks drift points while sliding and pays them out (times the multiplier) when the drift ends cleanly. */
export function scoreDrift(w: World, progress: number, force = false): void {
  const fast = w.car.speed > 140;
  const update = force && w.drift.active ? endDrift(w.drift) : updateDrift(w.drift, w.slip, progress, fast);
  if (update.kind === 'start') w.events.push({ type: 'drift-start', x: w.car.x, y: w.car.y });
  if (update.kind !== 'end') {
    edgeKiss(w);
    return;
  }
  w.stats.longestDrift = Math.max(w.stats.longestDrift, update.ticks);
  if (!update.scored || update.bank <= 0) return;
  const points = award(w, update.bank);
  w.stats.driftPoints += points;
  w.addBoost(update.bank / 1800);
  maneuver(w);
  w.events.push({ type: 'drift-end', points, seconds: update.ticks / SIM_HZ, x: w.car.x, y: w.car.y });
}
