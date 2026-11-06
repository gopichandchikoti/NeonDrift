import { STEP, type Track } from '../physics/track';
import type { Segment } from '../physics/track-types';

/** How far back (in samples) the old road must be before a crossing counts: the road right behind is not a crossing. */
const IGNORE_RECENT = Math.ceil(700 / STEP);

/**
 * True when the candidate segments would run into an older part of the road. The candidate is previewed on its own
 * and compared with the existing centreline; nothing is changed.
 */
export function crossesOlder(track: Track, segments: readonly Segment[]): boolean {
  const ahead = track.preview(segments);
  const limit = track.xs.length - IGNORE_RECENT;
  for (let j = 0; j < ahead.xs.length; j += 2) {
    const x = ahead.xs[j] as number;
    const y = ahead.ys[j] as number;
    const reach = (ahead.halfWidths[j] ?? 0) + 12;
    for (let i = 0; i < limit; i += 2) {
      const dx = (track.xs[i] ?? 0) - x;
      if (Math.abs(dx) > 400) continue;
      if (Math.hypot(dx, (track.ys[i] ?? 0) - y) < reach + (track.halfWidths[i] ?? 0)) return true;
    }
  }
  return false;
}
