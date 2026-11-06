import type { StageDef } from '../types';

/** Skyline Switchbacks: bends that come in chains, and sliding gates that keep strict time. */
export const DISTRICT_5: StageDef[] = [
  {
    id: '5-01', district: 5, index: 1, name: 'Ramp Up', speed: 315,
    objective: { kind: 'finish', ask: 1 },
    note: 'A chain of matching bends. Find the rhythm.',
    track: `W200 S500 R70@240 L70@240 R70@240 L70@240 R70@240 L70@240 S300 R90@240 L90@240 R90@240 L90@240
      S300 R70@260 L70@260 S500`,
  },
  {
    id: '5-02', district: 5, index: 2, name: 'Switchback One', speed: 320,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Wider switchbacks with a breather between sets.',
    track: `W200 S450 R100@220 L100@220 R100@220 L100@220 S150 R100@220 L100@220 S200 L100@220 R100@220
      L100@220 R100@220 S500`,
  },
  {
    id: '5-03', district: 5, index: 3, name: 'Metronome', speed: 320,
    objective: { kind: 'finish', ask: 1 },
    note: 'Gates swing across the road on a steady beat. Go through while one is open.',
    track: `W210 S600 R60@380 S450[g.5:.6:2.4] L60@380 S450[g.3:.6:2.4 g.75:.6:2.4:.5] R70@360
      S450[g.5:.6:2.2] L70@360 S300 R60@380 S450[g.3:.6:2.0 g.75:.6:2.0:.5] L60@380 S500`,
    tutorial: [{ s: 900, text: 'GATES swing on a fixed beat: time your pass' }],
  },
  {
    id: '5-04', district: 5, index: 4, name: 'Gate Thread', speed: 325,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Gates in pairs. Thread them close for near misses.',
    track: `W200 S650[g.8:.7:2.2] R90@240 S250[g.3:.7:2.0 g.8:.7:2.0:.5] L90@240 S300[g.5:.8:2.4] R60@300
      L60@300 S300[g.3:.7:2.2 g.7:.7:2.2:.5] R80@260 S300[g.5:.7:2.0] L80@260 S250[g.5:.7:2.4] R90@240 S500`,
  },
  {
    id: '5-05', district: 5, index: 5, name: 'Tower Chain', speed: 340,
    objective: { kind: 'time', ask: 0.82 },
    note: 'Fast switchbacks around the towers with gates to time.',
    track: `W190 S500 R80@220 L80@220 R80@220 L80@220 R80@220 S200[g.5:.7:2.0] L80@220 R80@220 L80@220
      S250 R100@220 L100@220 S250[g.5:.7:2.2] R80@220 L80@220 R80@220 S500`,
  },
  {
    id: '5-06', district: 5, index: 6, name: 'Zigzag Sky', speed: 330,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Sparks follow the zigzag; gates guard the straights.',
    track: `W200 S450[s.4-.95:0] R70@230[s0-1:.55] L70@230[s0-1:-.55] R70@230[s0-1:.55] L70@230[s0-1:-.55]
      S250[g.5:.7:2.2 s.15-.45:0] R100@230[s0-1:.5] L100@230[s0-1:-.5] S300[s.1-.9:0] R70@230[s0-1:.55]
      L70@230[s0-1:-.55] S250[g.5:.7:2.0 s.15-.45:0] R70@230[s0-1:.55] L70@230[s0-1:-.55] S500[s.1-.9:0]`,
  },
  {
    id: '5-07', district: 5, index: 7, name: 'Swing Gates', speed: 335,
    objective: { kind: 'finish', ask: 1 },
    note: 'Gates inside the bends. Commit early, release late.',
    track: `W200 S550 R90@260[g.5:.6:2.2] S150 L90@260[g.5:.6:2.2:.5] S150 R90@260[g.5:.6:2.2]
      S250[g.3:.7:1.8 g.7:.7:1.8:.5] L110@230 S250 R110@230[g.5:.6:2.0] S200 L90@260 S500`,
  },
  {
    id: '5-08', district: 5, index: 8, name: 'Cloud Chain', speed: 340,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Long switchback chains are the best place to hold a drift.',
    track: `W190 S500 R110@220 L110@220 R110@220 L110@220 S150[g.5:.7:2.0] R110@220 L110@220 R110@220
      L110@220 S400`,
  },
  {
    id: '5-09', district: 5, index: 9, name: 'Crosswind', speed: 340,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Cones, blocks and gates across the bends.',
    track: `W190 S550[c.7:.5] R80@240[b.5:.6] L80@240[c.5:-.6] S200[g.5:.8:2.0] R100@220[c.5:.55]
      L100@220[b.5:-.55] S250[g.3:.7:2.0 g.75:.7:2.0:.5] R70@260[c.5:.6] L70@260[b.5:-.6]
      S300[c.3:.4 c.6:-.4] R90@240 S500`,
  },
  {
    id: '5-10', district: 5, index: 10, name: 'Skyline Finale', speed: 350,
    objective: { kind: 'time', ask: 0.82 },
    note: 'Switchbacks and gates at speed. Perfect lines only.',
    track: `W190 S600 R70@240 L70@240 S200[g.5:.7:2.0] R100@220 L100@220 S250[g.3:.7:1.9 g.7:.7:1.9:.5]
      R70@240 L110@200 R110@200 S300[g.5:.8:2.2] L70@240 R70@240 S300[g.5:.7:2.0] L100@220 R100@220 S500`,
  },
];
