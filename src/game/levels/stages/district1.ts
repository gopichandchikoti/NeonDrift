import type { StageDef } from '../types';

/** Electric Alley: wide lit lanes that teach hold, release and the first drifts. */
export const DISTRICT_1: StageDef[] = [
  {
    id: '1-01', district: 1, index: 1, name: 'First Light', speed: 270,
    objective: { kind: 'finish', ask: 1 },
    note: 'Gentle bends. Hold to turn in, release to straighten.',
    track: `W260 S600 R60@360 S420 L60@360 S420 R80@320 S380 L80@320 S420 R90@300 S400 L90@300
      S450 R50@420 S300 L100@320 S300 R100@320 S600`,
    tutorial: [
      { s: 250, text: 'HOLD anywhere to turn into the bend' },
      { s: 900, text: 'RELEASE to straighten the car' },
      { s: 2200, text: 'Hold longer for a wider slide' },
    ],
  },
  {
    id: '1-02', district: 1, index: 2, name: 'Neon Bends', speed: 275,
    objective: { kind: 'finish', ask: 1 },
    note: 'A chain of right angles. Time the press, then let go.',
    track: `W250 S550 R90@300 S300 L90@300 S300 R90@280 S260 L90@280 S300 R120@260 S420 L120@260
      S350 R90@300 S250 L90@300 S250 R60@340 L60@340 S500`,
    tutorial: [{ s: 380, text: 'Press just before the bend, let go as you leave it' }],
  },
  {
    id: '1-03', district: 1, index: 3, name: 'Let It Slide', speed: 280,
    objective: { kind: 'drift', ask: 0.6 },
    note: 'Long sweepers. A long hold turns into a drift that pays points.',
    track: `W250 S550 R120@330 S250 L140@340 S250 R120@330 S250 L110@360 S300 R140@320 S200 L100@380 S500`,
    tutorial: [{ s: 300, text: 'Hold through the whole bend to build a drift score' }],
  },
  {
    id: '1-04', district: 1, index: 4, name: 'Spark Run', speed: 280,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Sparks trace the racing line. Follow them for points.',
    track: `W250 S600[s.5-.95:0] R60@320[s0-1:.5] S300[s0-.9:.5:-.5] L90@300[s0-1:-.5] S300[s.1-.9:-.5:.5]
      R90@300[s0-1:.5] S300[s.1-.9:.5:0] L60@340[s0-1:-.4] S250[s.1-.9:-.4:.4] R100@300[s0-1:.5]
      S200[s0-1:.5:-.5] L100@300[s0-1:-.5] S500[s.1-.9:-.5:0]`,
  },
  {
    id: '1-05', district: 1, index: 5, name: 'Cone Garden', speed: 285,
    objective: { kind: 'finish', ask: 1 },
    note: 'Cones on the straights. Pass one closely for a near miss.',
    track: `W240 S600[c.6:.3] R60@330[c.5:-.7] S400[c.3:.4 c.6:-.4] L70@330 S360[c.25:-.5 c.5:.5 c.75:-.5]
      R70@320 S400[c.5:0] L60@340 S320[c.3:.45 c.7:-.45] R90@300 S300[c.5:.4] L90@300 S300[c.3:-.4 c.7:.4]
      R60@360 S500`,
    tutorial: [{ s: 300, text: 'A close pass is a NEAR MISS: it feeds your combo' }],
  },
  {
    id: '1-06', district: 1, index: 6, name: 'Switch Alley', speed: 285,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Back-to-back switches. Clean moves build the multiplier.',
    track: `W240 S550 R90@260[c.5:.7] L90@260[c.5:-.7] R90@260[c.5:.7] L90@260 S250[c.3:.4 c.6:-.4]
      R70@300 L70@300[c.5:-.6] S300[c.5:0] R90@280 L90@280[c.5:.6] S200 R90@280[c.5:-.6] L90@280 S500`,
  },
  {
    id: '1-07', district: 1, index: 7, name: 'Back Street Blitz', speed: 295,
    objective: { kind: 'time', ask: 0.82 },
    note: 'Fast and flowing. Scrapes cost speed, so keep it clean.',
    track: `W240 S650 L50@400 S400 R80@340 S320 L80@340 S500 R50@420 S350 L70@360 S400 R70@360 S500
      L60@400 S300 R100@320 S300 L100@320 S600`,
  },
  {
    id: '1-08', district: 1, index: 8, name: 'Shield Up', speed: 290,
    objective: { kind: 'finish', ask: 1 },
    note: 'Grab the shield: it absorbs one hit.',
    track: `W230 S600[h.3:0 c.8:.4] R70@300 S300[b.4:.4 b.7:-.4] L70@300 S350[h.2:-.5 c.5:.3 c.8:-.3]
      R90@280 S250[b.5:0] L90@280 S300[c.4:.5 c.7:-.5] R70@300 S300[b.5:.5] L70@300[c.5:-.6]
      S300[h.2:0 c.6:.4] R90@280 S500`,
    tutorial: [{ s: 200, text: 'The shield token saves you from one crash' }],
  },
  {
    id: '1-09', district: 1, index: 9, name: 'Magnet Lane', speed: 290,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'The magnet pulls sparks in from the sides for a few seconds.',
    track: `W240 S500[m.2:0 s.45-.95:0] R90@300[s0-1:-.6] S250[s0-1:.6] L90@300[s0-1:.6] S300[s0-1:-.6]
      R60@320[s0-.8:-.5] S300[s.1-.9:0] L80@300[s0-1:.5] S200[m.1:0 s.2-.9:.5:-.5] R80@300[s0-1:-.5]
      S300[s.1-.9:.5:0] L60@340[s0-1:.4] S500[s.1-.9:0]`,
    tutorial: [{ s: 120, text: 'MAGNET: sparks fly to you for 6 seconds' }],
  },
  {
    id: '1-10', district: 1, index: 10, name: 'Alley Finale', speed: 300,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Everything so far: bends, cones, a block, a shield.',
    track: `W230 S600 R100@280[c.5:.6] S280[b.5:0] L100@280 S300[c.3:-.5 c.6:.5] R130@260 S220 L130@260
      S300[h.5:0] R70@300 L70@300[c.6:.55] S300 R110@280[b.5:-.5] S200 L110@280 S300[c.3:.45 c.6:-.45]
      R60@340 S500`,
  },
];
