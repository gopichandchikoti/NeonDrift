/** One authored piece of road. Arcs turn right for positive degrees and left for negative degrees. */
export type Segment =
  | { kind: 'straight'; length: number; width: number }
  | { kind: 'arc'; degrees: number; radius: number; width: number };

export type HazardKind = 'cone' | 'block' | 'gate' | 'traffic';
export type PickupKind = 'spark' | 'shield' | 'magnet';

/** An object placed on a segment: `at` is a fraction of the segment's length, `lat` a fraction of the half width. */
export interface ItemPlacement {
  kind: HazardKind | PickupKind;
  segment: number;
  at: number;
  lat: number;
  /** gate: lateral swing as a fraction of the half width. traffic: lane change target. */
  amp?: number;
  /** gate: seconds for one full swing. */
  period?: number;
  /** gate: starting phase as a fraction of a period. */
  phase?: number;
  /** traffic: forward speed in units per second. */
  speed?: number;
}

export interface TrackSpec {
  segments: Segment[];
  items: ItemPlacement[];
}

/** A corner as the track geometry sees it, used for steering assist, chevrons and the level validator. */
export interface Corner {
  startS: number;
  endS: number;
  dir: -1 | 1;
  radius: number;
  degrees: number;
}
