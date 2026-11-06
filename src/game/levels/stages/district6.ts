import type { StageDef } from '../types';

/** Midnight Grand Prix: every pattern from the earlier districts, at full speed. */
export const DISTRICT_6: StageDef[] = [
  {
    id: '6-01', district: 6, index: 1, name: 'Grid Start', speed: 340,
    objective: { kind: 'finish', ask: 1 },
    note: 'A fast warm-up lap with a block and a few slow cars.',
    track: `W200 S800 R90@240 S300 L90@240 S300 R120@220 S200[b.5:0] L120@220 S300[t.4:.4:160] R70@300 S300
      L70@300 S350[b.5:.5] R90@260 L90@260 S400[t.4:-.4:160] R60@320 S600`,
  },
  {
    id: '6-02', district: 6, index: 2, name: 'Full Throttle', speed: 360,
    objective: { kind: 'time', ask: 0.82 },
    note: 'Long straights and wide bends at the top speed.',
    track: `W190 S900 R50@420 S500 L70@360 S500 R50@420 S450 L50@420 S500 R80@320 S500 L80@320 S500
      R60@400 S500 L60@400 S800`,
  },
  {
    id: '6-03', district: 6, index: 3, name: 'Street Fighter', speed: 350,
    objective: { kind: 'traffic', ask: 0.7 },
    note: 'Fast traffic runs with lane changes.',
    track: `W200 S800[t.5:.5:150:-.5 t.8:-.5:160] R90@260[t.5:-.4:150] L90@260[t.5:.4:150]
      S350[t.2:.4:160:-.4 t.6:-.4:160:.4] R70@300 S300[t.5:0:150] L80@280 S450[t.3:.5:160 t.7:-.5:160]
      R90@260[t.5:.4:150] L90@260[t.5:-.4:150] S350[t.3:.4:160:-.4 t.7:-.4:160:.4] R60@320 S600`,
  },
  {
    id: '6-04', district: 6, index: 4, name: 'Neon Gauntlet', speed: 350,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Cones, blocks, gates and traffic: take every near miss you can.',
    track: `W190 S550[c.7:.5] R80@240[b.5:.6] L80@240[g.5:.6:2.0] S200[t.7:.5:150] R100@220[c.5:.6]
      L100@220[c.5:-.6] S250[g.5:.7:2.0 b.9:0] R90@240[t.5:-.4:150] S350[c.3:.5 b.6:-.5] L80@240[c.5:-.6]
      R80@240[b.5:.6] S250[g.5:.7:2.0] L90@240[c.5:.5] S400[t.4:.4:150 c.8:-.5] R70@280 S500`,
  },
  {
    id: '6-05', district: 6, index: 5, name: 'Midnight Run', speed: 355,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Huge bends with traffic and cones on the inside lines.',
    track: `W190 S600 R150@300 S200[t.5:.4:150] L150@300 S200 R130@280[c.5:.6] L130@280[c.5:-.6]
      S300[b.5:0] R100@260 S300 L130@300 R130@300 S200[t.5:-.4:150] L100@260 S450`,
  },
  {
    id: '6-06', district: 6, index: 6, name: 'Last Orders', speed: 355,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Sparks everywhere, and everything else in the way.',
    track: `W180 S550[s.5-.95:0] R90@240[s0-1:.55 c.5:-.6] L90@240[s0-1:-.55]
      S250[m.1:0 s.2-.9:.5:-.5 g.8:.6:2.0] R110@220[s0-1:.5] L110@220[s0-1:-.5] S300[s.1-.9:0 t.5:0:150]
      R70@280[s0-1:.5] S250[s.1-.9:.5:-.5] L90@240[s0-1:-.5] R90@240[s0-1:.5] S300[g.5:.6:2.0 s.15-.45:0]
      L70@280[s0-1:-.5] S500[s.1-.9:0]`,
  },
  {
    id: '6-07', district: 6, index: 7, name: 'Dead Heat', speed: 375,
    objective: { kind: 'time', ask: 0.82 },
    note: 'The fastest stage in the game. Smooth lines, no scrapes.',
    track: `W180 S900 R60@380 S450 L90@300 S300 R90@300 S450 L60@380 S500 R70@340 L70@340 S450 R90@300
      S300 L90@300 S450 R60@380 S800`,
  },
  {
    id: '6-08', district: 6, index: 8, name: 'The Long Night', speed: 360,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'A long mixed run. Hold the multiplier for as long as you can.',
    track: `W190 S700[c.6:.5 c.85:-.5] R90@250 L90@250[b.5:-.6] S250[t.5:.4:150] R110@230[c.5:.6]
      S200[g.5:.7:2.0] L110@230 R70@280[b.5:.6] S350[t.3:-.4:160 t.7:.4:160:-.4] L90@250 R90@250
      S250[c.3:.5 c.7:-.5] L120@220 S300[g.4:.7:1.9 g.8:.7:1.9:.5] R100@240 S250[c.5:.5]
      L100@240[b.5:-.55] R100@240[c.5:.55] S300[t.3:-.4:160 t.7:.4:160] L70@280 R70@280 S250[g.5:.7:2.0]
      R90@250[c.5:.6] S600`,
  },
  {
    id: '6-09', district: 6, index: 9, name: 'Final Hairpins', speed: 365,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Two hairpins and a run of switchbacks, with traffic and a gate.',
    track: `W180 S600 R170@180[c.5:.6] S300[t.5:.4:150] L170@180[c.5:-.6] S250[g.5:.7:2.0] R110@220 L110@220
      S300[b.5:0] R110@220 L110@220 S400[t.4:.4:150] R90@240 S500`,
  },
  {
    id: '6-10', district: 6, index: 10, name: 'Grand Prix', speed: 380,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'The finale. Every hazard, every corner, top speed.',
    track: `W180 S800[c.5:.5 c.8:-.5] R90@240[b.5:.6] L90@240[c.5:-.6] S250[t.5:.4:160:-.4] R120@210
      S200[g.5:.7:2.0] L120@210[c.5:.6] S300[t.3:.4:160 t.7:-.4:160] R80@250 L80@250[b.5:-.55]
      S250[m.1:0 s.3-.9:0] R100@230[c.5:-.35] L100@230[g.5:.6:1.9] S300[c.3:.5 b.6:-.5] R90@220 L90@220
      S250[t.5:.4:160] L90@250 R90@250 S250[c.5:.5] R130@220 S200[g.5:.7:2.0] L130@220[c.5:-.6]
      S300[t.3:-.4:160 t.7:.4:160:-.4] R80@250 L80@250[c.5:-.6] S250[c.5:0] R100@230
      L100@230 S500`,
  },
];
