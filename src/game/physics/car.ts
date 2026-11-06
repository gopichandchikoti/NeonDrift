import { DT, HANDLING } from './constants';
import { angleDiff, approach, clamp } from './math';

export interface CarState {
  x: number;
  y: number;
  /** Where the nose points (rad). */
  heading: number;
  /** Where the car is actually travelling (rad). heading - velAngle is the slip (drift) angle. */
  velAngle: number;
  speed: number;
  yawRate: number;
  /** -1 left, 0 none, +1 right: the steering that was applied on the last step (for rendering and audio). */
  steer: number;
}

export interface DriveInput {
  /** -1, 0 or +1. Already resolved from hold + assist, or from the explicit left/right controls. */
  steer: number;
  /** Direction of the road at the car, for the straighten-on-release behaviour. */
  roadAngle: number;
  targetSpeed: number;
  /** 0.8 - 1.2 from settings: scales the turn rate (1 = the validated default). */
  sensitivity: number;
}

export function createCar(x: number, y: number, angle: number): CarState {
  return { x, y, heading: angle, velAngle: angle, speed: 0, yawRate: 0, steer: 0 };
}

export function slipOf(car: CarState): number {
  return angleDiff(car.heading, car.velAngle);
}

/** Advances the car by one fixed step. Pure arithmetic: the same inputs always give the same result. */
export function stepCar(car: CarState, input: DriveInput): void {
  const turning = input.steer !== 0;
  let targetYaw: number;
  if (turning) {
    targetYaw = (input.steer * car.speed * input.sensitivity) / HANDLING.turnRadius;
  } else {
    const error = angleDiff(input.roadAngle, car.heading);
    targetYaw = clamp(error * HANDLING.alignGain, -HANDLING.alignMax, HANDLING.alignMax);
  }
  car.yawRate = approach(car.yawRate, targetYaw, HANDLING.yawAccel * DT);
  car.heading += car.yawRate * DT;

  const grip = turning ? HANDLING.gripDrift : HANDLING.gripRoad;
  car.velAngle += angleDiff(car.heading, car.velAngle) * (1 - Math.exp(-grip * DT));

  const slip = Math.min(1, Math.abs(slipOf(car)) / 0.8);
  const scrubbed = input.targetSpeed * (1 - HANDLING.driftScrub * slip);
  const target = Math.max(input.targetSpeed * HANDLING.minSpeedFactor, scrubbed);
  const accel = car.speed < target * 0.8 ? HANDLING.launchAccel : HANDLING.cruiseAccel;
  car.speed = approach(car.speed, target, accel * DT);

  car.x += Math.cos(car.velAngle) * car.speed * DT;
  car.y += Math.sin(car.velAngle) * car.speed * DT;
  car.steer = input.steer;
}

/** The four body corners, used for barrier contact. */
export function carCorners(car: CarState, halfLength: number, halfWidth: number): Array<{ x: number; y: number }> {
  const c = Math.cos(car.heading);
  const s = Math.sin(car.heading);
  const out: Array<{ x: number; y: number }> = [];
  for (const [along, side] of [
    [halfLength, halfWidth],
    [halfLength, -halfWidth],
    [-halfLength, halfWidth],
    [-halfLength, -halfWidth],
  ] as const) {
    out.push({ x: car.x + c * along - s * side, y: car.y + s * along + c * side });
  }
  return out;
}
