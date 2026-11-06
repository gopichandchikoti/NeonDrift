/** Simulation rate. Physics always advances in fixed steps of 1/SIM_HZ seconds, whatever the display refresh rate. */
export const SIM_HZ = 120;
export const DT = 1 / SIM_HZ;

export const CAR = {
  halfLength: 17,
  halfWidth: 9,
  /** Collision circles along the car's axis (offsets from the centre) and their radius. */
  circleOffsets: [-10.5, 0, 10.5] as const,
  circleRadius: 9.5,
};

export const HANDLING = {
  /**
   * Path radius while holding, at every speed: yaw rate = speed / TURN_RADIUS. Because the radius does not shrink with
   * speed, boost can never make a corner impossible: every authored corner is wider than this (see the validator).
   */
  turnRadius: 92,
  /** How quickly the yaw rate reaches its target (rad/s per second): the steering's responsiveness. */
  yawAccel: 26,
  /** Releasing straightens the nose toward the road direction with this gain, but never faster than alignMax. */
  alignGain: 3.4,
  alignMax: 1.45,
  /** Grip: how fast the direction of travel follows the nose (1/s). Low while drifting, high when straight. */
  gripDrift: 5.4,
  gripRoad: 11,
  launchAccel: 760,
  cruiseAccel: 240,
  /** Drifting scrubs speed: at a full slip the target speed drops by this fraction. */
  driftScrub: 0.13,
  minSpeedFactor: 0.62,
  boostFactor: 1.32,
};

export const RULES = {
  /** Slip angle (rad) above which the car counts as drifting. */
  driftMinSlip: 0.16,
  driftFullSlip: 0.75,
  /** A drift must last this long (s) to score; it ends after the slip has stayed low for driftEndGrace (s). */
  driftMinTime: 0.42,
  driftEndGrace: 0.18,
  driftBankCap: 4500,
  barrierPad: 3,
  nearMissGap: 20,
  edgeKissGap: 14,
  sparkRadius: 26,
  magnetRadius: 165,
  magnetTime: 6,
  boostTime: 2.4,
  scrapeSpeedLoss: 0.84,
  scrapeCooldown: 0.3,
  shieldGrace: 0.7,
  comboPips: 3,
  comboMax: 8,
  comboDecay: 5,
  finishRunout: 160,
};

export const POINTS = {
  nearMiss: 150,
  edgeKiss: 70,
  spark: 25,
  trafficPass: 60,
  cleanFinish: 1000,
};
