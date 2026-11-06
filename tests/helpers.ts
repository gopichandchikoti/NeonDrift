import { Track } from '../src/game/physics/track';
import { parseTrack } from '../src/game/physics/track-dsl';
import type { ItemPlacement } from '../src/game/physics/track-types';
import { World } from '../src/game/systems/world';
import type { InputFrame, StageRules, TrackExtender, WorldEvent } from '../src/game/systems/world-types';

export interface Built {
  world: World;
  track: Track;
  events: WorldEvent[];
}

export interface BuildOptions {
  rules?: Partial<StageRules>;
  extender?: TrackExtender;
  extra?: ItemPlacement[];
}

/** A world on a track written in the stage format. The finish line is 160 before the end, as in the real stages. */
export function build(text: string, options: BuildOptions = {}): Built {
  const spec = parseTrack(text);
  const track = new Track(spec.segments);
  const world = new World({
    track,
    items: [...spec.items, ...(options.extra ?? [])],
    extender: options.extender,
    rules: { baseSpeed: 300, scrapeAngle: 0.4, finishS: track.length - 160, ...options.rules },
  });
  return { world, track, events: [] };
}

/** Steps until `done` or `max` ticks, collecting every event. */
export function run(
  built: Built,
  input: (tick: number) => Partial<InputFrame>,
  max = 120 * 60,
  done: (b: Built) => boolean = (b) => !b.world.running,
): Built {
  for (let t = 0; t < max && !done(built); t++) {
    built.world.step({ hold: false, steer: 0, boost: false, ...input(t) });
    built.events.push(...built.world.events);
    built.world.events.length = 0;
  }
  return built;
}

export const released = (): Partial<InputFrame> => ({});
export const held = (): Partial<InputFrame> => ({ hold: true });
export const types = (b: Built): string[] => b.events.map((e) => e.type);
