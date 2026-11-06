import type { StageDef } from '../types';

/** Rainline Docks: wet-looking quays with long sweepers, S-bends and container blocks. The grip never changes. */
export const DISTRICT_2: StageDef[] = [
  {
    id: '2-01', district: 2, index: 1, name: 'Wet Pavement', speed: 295,
    objective: { kind: 'finish', ask: 1 },
    note: 'Long sweepers. It looks slick, but the car grips exactly as before.',
    track: `W230 S600 R100@460 S300 L100@460 S300 R130@420 S250 L130@420 S300 R90@480 S250 L90@480 S600`,
  },
  {
    id: '2-02', district: 2, index: 2, name: 'Long Sweep', speed: 300,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Huge arcs of road. Hold and let the slide build.',
    track: `W230 S500 R160@380 S200 L160@380 S300 R120@460 S200 L120@460 S300 R90@500 S500`,
  },
  {
    id: '2-03', district: 2, index: 3, name: 'Container Slalom', speed: 300,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Container blocks force you to pick a side. Pass tight.',
    track: `W220 S600[b.7:-.3] R50@500[b.3:.5 b.7:-.5] S250[b.5:-.4] L50@500[b.3:-.5 b.7:.5] S300[b.5:.3]
      R70@420[c.5:.6] S250[b.5:0] L70@420 S300[b.4:.4 c.7:-.4] R60@480[b.5:-.5] S250[b.5:.4] L60@480
      S650[c.2:.5 c.45:-.5]`,
  },
  {
    id: '2-04', district: 2, index: 4, name: 'Harbour Esse', speed: 305,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Sparks swing across the S-bends: ride the line.',
    track: `W230 S550 R90@340[s0-1:.6] L90@340[s0-1:-.6] R90@340[s0-1:.6] L90@340[s0-1:-.6] S300[s.1-.9:0]
      R100@360[s0-1:.5] L100@360[s0-1:-.5] R100@360[s0-1:.5] L100@360[s0-1:-.5] S300[s.1-.9:0 h.5:0]
      R70@400[s0-1:.5] L70@400[s0-1:-.5] S500`,
  },
  {
    id: '2-05', district: 2, index: 5, name: 'Pier Dash', speed: 320,
    objective: { kind: 'time', ask: 0.82 },
    note: 'Long fast straights joined by wide bends. Stay off the barriers.',
    track: `W230 S800 R40@600 S500 L60@520 S450 R60@520 S450 L40@600 S600 R80@460 S300 L80@460 S700`,
  },
  {
    id: '2-06', district: 2, index: 6, name: 'Fog Horn', speed: 305,
    objective: { kind: 'finish', ask: 1 },
    note: 'Narrower road and staggered blocks. Read the gaps early.',
    track: `W210 S600[b.8:-.3] R80@400 S200[b.4:.45] L80@400 S250[b.4:-.4 b.8:.4] R110@360 S300[b.5:0]
      L60@500 S300[h.2:0 b.6:.3] R70@440 S250[b.5:-.4] L70@440 S250[b.5:.4] R60@480 S500`,
  },
  {
    id: '2-07', district: 2, index: 7, name: 'Tide Table', speed: 310,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Wide alternating arcs: the sweetest drifts in the game.',
    track: `W230 S500 L140@400 S150 R140@400 S150 L140@400 S150 R140@400 S150 L110@440 S150 R110@440 S500`,
  },
  {
    id: '2-08', district: 2, index: 8, name: 'Dockside Chain', speed: 310,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Cones and blocks in the bends. Keep the chain alive.',
    track: `W220 S600[c.7:.3] R80@380[b.6:.6] L80@380[c.4:-.6 c.7:.6] S200[b.5:0] R100@340 L100@340[c.5:.5]
      S250[c.3:-.4 c.6:.4] R70@420[b.5:-.55] S250[c.5:0] L90@360[c.5:.6] R90@360[b.5:-.6]
      S250[c.3:.4 c.6:-.4] L60@440 S500`,
  },
  {
    id: '2-09', district: 2, index: 9, name: 'Lantern Row', speed: 315,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Take the magnet early, then sweep up the lantern sparks.',
    track: `W220 S450[m.1:0 s.4-.95:0] R80@400[s.1-.9:.6] S200[s0-1:.6:-.6] L80@400[s.1-.9:-.6]
      S300[s0-1:-.6:.6 h.5:0] R120@380[s0-1:.5] L60@500[s0-1:-.5] S300[s.1-.9:0] R90@400[s0-1:.5]
      L90@400[s0-1:-.5] S200[m.1:0 s.2-.9:0] R70@440[s0-1:.5] S500[s.1-.9:-.5:.5]`,
  },
  {
    id: '2-10', district: 2, index: 10, name: 'Rainline Finale', speed: 325,
    objective: { kind: 'drift', ask: 0.7 },
    note: 'Big chained sweepers with obstacles on the inside lines.',
    track: `W220 S550 R110@360[c.5:.6] S200 L150@360 S150 R150@360[b.5:.6] S200 L100@420
      S250[c.3:.4 c.7:-.4] R90@400 S200 L120@380[c.5:-.6] R120@380[c.5:.6] S300[b.5:0] L70@460 S500`,
  },
];
