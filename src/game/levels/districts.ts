export interface DistrictTheme {
  /** Ground beyond the road, road surface, and lane paint. */
  ground: number;
  road: number;
  paint: number;
  /** The two barrier neons (left and right edge) and the corner chevrons. */
  edgeLeft: number;
  edgeRight: number;
  chevron: number;
  /** Rooftops, their side walls, and the neon signs on them. */
  roof: number;
  wall: number;
  signs: number[];
  rain: boolean;
}

export interface District {
  id: number;
  name: string;
  /** The new pattern this district introduces, in a few words (shown on its card). */
  teaches: string;
  blurb: string;
  theme: DistrictTheme;
  /** Barrier impacts shallower than this are forgiving scrapes rather than crashes (radians). */
  scrapeAngle: number;
}

export const DISTRICTS: readonly District[] = [
  {
    id: 1,
    name: 'Electric Alley',
    teaches: 'Hold, release, drift',
    blurb: 'Wide lit lanes behind the arcades. Learn the rhythm: hold into a bend, let go to straighten.',
    scrapeAngle: 0.46,
    theme: {
      ground: 0x0a0814, road: 0x16131f, paint: 0x2b2640, edgeLeft: 0x37e2ff, edgeRight: 0xff3fa4,
      chevron: 0xfff36b, roof: 0x1a1628, wall: 0x0f0c18, signs: [0x37e2ff, 0xff3fa4, 0xfff36b], rain: false,
    },
  },
  {
    id: 2,
    name: 'Rainline Docks',
    teaches: 'Long sweepers and S-bends',
    blurb: 'Wet quays and crane lights. It only looks slippery: the grip is exactly the same, the bends are longer.',
    scrapeAngle: 0.42,
    theme: {
      ground: 0x061016, road: 0x101b22, paint: 0x23404b, edgeLeft: 0x2ff3c5, edgeRight: 0x4d86ff,
      chevron: 0xc6fff1, roof: 0x112129, wall: 0x09141a, signs: [0x2ff3c5, 0x4d86ff, 0xff9d4d], rain: true,
    },
  },
  {
    id: 3,
    name: 'Sunset Circuit',
    teaches: 'Tight corners and hairpins',
    blurb: 'A rooftop kart loop at golden hour. Short bends that punish a late press.',
    scrapeAngle: 0.38,
    theme: {
      ground: 0x150a10, road: 0x22141c, paint: 0x4a2a35, edgeLeft: 0xffb13b, edgeRight: 0xff5f6d,
      chevron: 0xfff0c2, roof: 0x2a1720, wall: 0x170c12, signs: [0xffb13b, 0xff5f6d, 0xffe08a], rain: false,
    },
  },
  {
    id: 4,
    name: 'Metro Pulse',
    teaches: 'Traffic that signals and changes lanes',
    blurb: 'Night buses and delivery vans. Every lane change is signalled first: read the blinkers.',
    scrapeAngle: 0.36,
    theme: {
      ground: 0x090c08, road: 0x141812, paint: 0x2f3a26, edgeLeft: 0xb6ff3b, edgeRight: 0xa66bff,
      chevron: 0xe9ffc4, roof: 0x171c14, wall: 0x0c0f0a, signs: [0xb6ff3b, 0xa66bff, 0xff5a7a], rain: false,
    },
  },
  {
    id: 5,
    name: 'Skyline Switchbacks',
    teaches: 'Chained switchbacks and sliding gates',
    blurb: 'Ramps between towers. Bends come in chains, and the gates keep time: thread them.',
    scrapeAngle: 0.34,
    theme: {
      ground: 0x070a14, road: 0x121728, paint: 0x283252, edgeLeft: 0x9ef0ff, edgeRight: 0xff7ad9,
      chevron: 0xffffff, roof: 0x141a2e, wall: 0x0a0e1c, signs: [0x9ef0ff, 0xff7ad9, 0x7affc0], rain: false,
    },
  },
  {
    id: 6,
    name: 'Midnight Grand Prix',
    teaches: 'Everything, faster',
    blurb: 'The city closes its streets for one night. Every pattern you have learned, at full speed.',
    scrapeAngle: 0.32,
    theme: {
      ground: 0x08060a, road: 0x151116, paint: 0x3a2c33, edgeLeft: 0xffd84a, edgeRight: 0xff3b5c,
      chevron: 0xfff6d6, roof: 0x1b1519, wall: 0x0d0a0c, signs: [0xffd84a, 0xff3b5c, 0x37e2ff], rain: false,
    },
  },
];

export function districtById(id: number): District {
  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) throw new Error(`no district ${id}`);
  return district;
}

/** Endless and daily runs use their own theme rotation. */
export const ENDLESS_THEMES: readonly number[] = [1, 3, 2, 5, 4, 6];
