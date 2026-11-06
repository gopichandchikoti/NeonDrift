import type { Hazard, Pickup } from '../entities/entities';
import type { World } from './world';
import type { RunStats, RunStatus } from './world-types';
import type { CarState } from '../physics/car';
import type { ComboState } from './combo';
import type { DriftState } from './drift';

type HazardState = [number, number, number, number, number, number, number, boolean, boolean];

/** The plain numbers a world carries, saved and restored by name. */
const SCALARS = [
  'tick', 's', 'lateral', 'roadAngle', 'halfWidth', 'hint', 'boostMeter', 'boostTicks', 'magnetTicks',
  'invulnTicks', 'scrapeCooldown', 'hazardCursor', 'pickupCursor',
] as const;

export interface WorldSnapshot {
  car: CarState;
  status: RunStatus;
  scalars: Record<(typeof SCALARS)[number], number>;
  shield: boolean;
  latch: [boolean, number];
  combo: ComboState;
  drift: DriftState;
  stats: RunStats;
  events: number;
  hazards: HazardState[];
  traffic: HazardState[];
  pickups: Array<[number, number, boolean]>;
}

const saveHazard = (h: Hazard): HazardState => [h.s, h.lat, h.x, h.y, h.angle, h.laneT, h.minGap, h.resolved, h.hit];

function loadHazard(h: Hazard, v: HazardState): void {
  [h.s, h.lat, h.x, h.y, h.angle, h.laneT, h.minGap, h.resolved, h.hit] = v;
}

/** Captures every mutable part of a world, so a look-ahead can be undone exactly (the track itself is not copied). */
export function snapshotWorld(w: World): WorldSnapshot {
  return {
    car: { ...w.car },
    status: w.status,
    scalars: Object.fromEntries(SCALARS.map((key) => [key, w[key]])) as WorldSnapshot['scalars'],
    shield: w.shield,
    latch: [w.holding, w.latched],
    combo: { ...w.combo },
    drift: { ...w.drift },
    stats: { ...w.stats },
    events: w.events.length,
    hazards: w.hazards.map(saveHazard),
    traffic: w.traffic.map(saveHazard),
    pickups: w.pickups.map((p: Pickup) => [p.x, p.y, p.taken]),
  };
}

export function restoreWorld(w: World, snap: WorldSnapshot): void {
  Object.assign(w.car, snap.car);
  w.status = snap.status;
  for (const key of SCALARS) w[key] = snap.scalars[key];
  w.shield = snap.shield;
  [w.holding, w.latched] = snap.latch;
  Object.assign(w.combo, snap.combo);
  Object.assign(w.drift, snap.drift);
  Object.assign(w.stats, snap.stats);
  w.events.length = snap.events;
  snap.hazards.forEach((v, i) => loadHazard(w.hazards[i] as Hazard, v));
  snap.traffic.forEach((v, i) => loadHazard(w.traffic[i] as Hazard, v));
  snap.pickups.forEach(([x, y, taken], i) => {
    const p = w.pickups[i] as Pickup;
    p.x = x;
    p.y = y;
    p.taken = taken;
  });
}
