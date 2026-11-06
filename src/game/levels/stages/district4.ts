import type { StageDef } from '../types';

/**
 * Metro Pulse: slow night traffic. A car that will change lane shows its blinker for about 0.4 s before it moves,
 * so every move can be read in time.
 */
export const DISTRICT_4: StageDef[] = [
  {
    id: '4-01', district: 4, index: 1, name: 'Night Bus', speed: 300,
    objective: { kind: 'traffic', ask: 0.7 },
    note: 'Slow traffic in fixed lanes. Overtake safely.',
    track: `W230 S800[t.55:.45:140 t.85:-.45:140] R60@380 S500[t.2:-.4:150 t.55:.4:150 t.9:0:150] L60@380
      S500[t.3:.4:150 t.7:-.4:150] R60@380 S400[t.4:.4:150] L80@340 S400[t.3:-.4:150 t.7:.4:150] R80@340 S600`,
    tutorial: [{ s: 200, text: 'TRAFFIC is slower than you: pick a side and pass' }],
  },
  {
    id: '4-02', district: 4, index: 2, name: 'Lane Signals', speed: 310,
    objective: { kind: 'traffic', ask: 0.7 },
    note: 'Watch the blinkers: a flashing car is about to change lanes.',
    track: `W230 S800[t.5:.5:150:-.5 t.85:-.5:150:.5] R50@420 S600[t.2:-.5:160:.5 t.5:.5:160:-.5 t.8:0:150]
      L50@420 S600[t.3:.45:150:-.45 t.7:-.45:150:.45] R50@420 S500[t.4:-.5:150:.5] L50@420 S700`,
    tutorial: [{ s: 300, text: 'BLINKER on: that car will change lane in a moment' }],
  },
  {
    id: '4-03', district: 4, index: 3, name: 'Delivery Van', speed: 305,
    objective: { kind: 'finish', ask: 1 },
    note: 'Traffic with the odd barrier block mixed in.',
    track: `W230 S750[t.55:.4:130 t.9:-.4:140] R70@340[b.5:-.6] S400[t.3:-.45:140 t.8:.45:140] L70@340
      S350[c.4:.5 t.7:-.4:150] R90@300 S400[t.4:0:140] L90@300 S350[b.5:.5] R70@340 S600`,
  },
  {
    id: '4-04', district: 4, index: 4, name: 'Rush Hour', speed: 320,
    objective: { kind: 'traffic', ask: 0.7 },
    note: 'Busy lanes: always choose the emptier side.',
    track: `W230 S800[t.5:.5:150 t.7:-.5:160 t.9:0:150] R60@360[t.3:-.4:150 t.7:.4:150]
      S350[t.2:.4:150:-.4 t.55:-.4:160:.4 t.85:0:150] L60@360[t.4:.4:150]
      S500[t.2:-.5:150 t.5:.5:160 t.8:-.5:150] R60@360[t.5:-.4:150] S400[t.3:.4:150:-.4 t.7:-.4:150:.4]
      L60@360 S500`,
  },
  {
    id: '4-05', district: 4, index: 5, name: 'Metro Weave', speed: 315,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Pass traffic tightly for near misses that build the combo.',
    track: `W220 S800[t.5:.5:140 t.8:-.5:140] R80@320 L80@320[t.5:.4:150] S300[t.2:-.4:150 t.6:.4:150]
      R100@300[c.5:.6] S300[t.2:.45:150 t.5:-.45:150 t.8:0:160] L60@400 S400[t.4:-.4:150:.4] R80@320
      L80@320[c.5:-.6] S300[t.3:.4:150 t.7:-.4:150] R70@360 S500`,
  },
  {
    id: '4-06', district: 4, index: 6, name: 'Blinker Dance', speed: 320,
    objective: { kind: 'traffic', ask: 0.7 },
    note: 'Every car swaps lanes. Wait for the blinker, then go.',
    track: `W220 S800[t.5:.5:150:-.5 t.7:-.5:150:.5 t.9:.5:150:-.5] R50@450
      S600[t.2:-.5:150:.5 t.5:.5:150:-.5 t.8:-.5:150:.5] L50@450 S600[t.3:.5:150:-.5 t.7:-.5:150:.5]
      R50@450 S500[t.3:-.5:150:.5 t.7:.5:150:-.5] L50@450 S500`,
  },
  {
    id: '4-07', district: 4, index: 7, name: 'Tunnel Run', speed: 335,
    objective: { kind: 'time', ask: 0.82 },
    note: 'A narrow tunnel road with the odd slow car. No room to waste.',
    track: `W190 S800[t.5:.4:150] R50@400 S500[t.3:-.4:150 t.75:.4:150] L50@400 S500[t.4:.4:150] R70@360
      S450[t.5:-.4:150] L70@360 S500[t.4:.4:150] R50@400 S400[t.5:-.4:150] L50@400 S500[t.4:.4:150]
      R60@380 S500`,
  },
  {
    id: '4-08', district: 4, index: 8, name: 'Overtake', speed: 325,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Traffic in the bends. Drift around them.',
    track: `W230 S500 R120@300[t.5:.3:140] S200 L120@300[t.4:-.3:140] S250[t.4:.4:150] R100@320[t.5:-.3:150]
      L100@320[t.5:.3:150] S350[t.3:-.4:150 t.7:.4:150] R130@300[t.5:.3:140] S150 L130@300[t.5:-.3:140]
      S400[t.3:.4:150] R70@360 S500`,
  },
  {
    id: '4-09', district: 4, index: 9, name: 'Express Lane', speed: 330,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Sparks on one side, a slow car on the other.',
    track: `W220 S800[s.5-.95:0 t.7:.55:150] R70@360[s0-1:-.5] S300[s0-1:-.5:.5 t.5:.5:150] L70@360[s0-1:.5]
      S300[m.1:0 s.2-.9:0] R90@320[s0-1:-.5 t.5:.5:150] S300[s.1-.9:.5:-.5] L90@320[s0-1:.5 t.5:-.5:150]
      S250[s.1-.9:0] R70@360[s0-1:-.5] S900[s.1-.9:.5:-.5 t.1:.5:150]`,
  },
  {
    id: '4-10', district: 4, index: 10, name: 'Metro Finale', speed: 335,
    objective: { kind: 'traffic', ask: 0.7 },
    note: 'Heavy traffic through bends and straights.',
    track: `W210 S800[t.5:.5:160:-.5 t.8:-.5:160] R80@320[t.5:-.4:150] L80@320[t.5:.4:150]
      S350[t.2:-.45:160:.45 t.55:.45:160:-.45 t.9:0:150] R60@400 S300[t.3:.4:150 t.7:-.4:150] L100@300
      S500[t.2:.4:160 t.5:-.4:160 t.8:.4:160:-.4] R80@320[t.5:.4:150] L80@320[t.5:-.4:150]
      S400[t.3:.45:160:-.45 t.7:-.45:160:.45] R60@400 S500`,
  },
];
