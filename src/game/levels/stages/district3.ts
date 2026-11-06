import type { StageDef } from '../types';

/** Sunset Circuit: a rooftop kart loop with tight corners and hairpins that punish a late press. */
export const DISTRICT_3: StageDef[] = [
  {
    id: '3-01', district: 3, index: 1, name: 'Kart Loop', speed: 300,
    objective: { kind: 'finish', ask: 1 },
    note: 'Tighter corners than the alley. Press a touch earlier.',
    track: `W210 S500 R90@200 S200 L90@200 S250 R120@180 S180 L120@180 S300 R90@200 S200 L90@200 S250
      R70@240 S300 L70@240 S500`,
  },
  {
    id: '3-02', district: 3, index: 2, name: 'Hairpin Intro', speed: 300,
    objective: { kind: 'finish', ask: 1 },
    note: 'Your first hairpin: a near U-turn. Hold it all the way round.',
    track: `W210 S550 R90@220 S250 L170@170 S350 R90@220 S400 L120@200 S250 R120@200 S500`,
    tutorial: [{ s: 900, text: 'HAIRPIN: hold the whole turn, release on exit' }],
  },
  {
    id: '3-03', district: 3, index: 3, name: 'Apex Hunter', speed: 310,
    objective: { kind: 'drift', ask: 0.65 },
    note: 'Quick alternating corners. Slide each one.',
    track: `W200 S450 R100@190 S150 L100@190 S150 R100@190 S150 L100@190 S150 R130@170 S200 L130@170
      S250 R90@200 L90@200 S200 R90@200 L90@200 S500`,
  },
  {
    id: '3-04', district: 3, index: 4, name: 'Rooftop Rush', speed: 330,
    objective: { kind: 'time', ask: 0.82 },
    note: 'Fast approach, tight exits. Scrapes cost seconds.',
    track: `W200 S600 R70@240 S300 L110@200 S250 R70@240 S300 L50@300 S250 R90@210 S300 L60@260 S250
      R90@210 S300 L90@210 S500`,
  },
  {
    id: '3-05', district: 3, index: 5, name: 'Chicane', speed: 315,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Quick left-right flicks. Short, sharp holds.',
    track: `W200 S500 R45@220 L45@220 S300 L45@220 R45@220 S300 R60@200 L60@200 R60@200 S200
      L90@190[c.5:-.5] S300 R45@220 L45@220 L45@220 R45@220 S250 R90@200[c.5:.6] S500`,
  },
  {
    id: '3-06', district: 3, index: 6, name: 'Golden Hour', speed: 315,
    objective: { kind: 'sparks', ask: 0.7 },
    note: 'Sparks sit just inside every apex.',
    track: `W200 S450[s.4-.95:0] R100@200[s0-1:.6] S150 L100@200[s0-1:-.6] S250[s.1-.9:-.5:.5 h.5:0]
      R120@180[s0-1:.6] L120@180[s0-1:-.6] S300[s.1-.9:0] R90@200[s0-1:.6] S120 L90@200[s0-1:-.6]
      S250[m.1:0 s.2-.9:0] R130@180[s0-1:.6] S500[s.1-.9:.4:-.4]`,
  },
  {
    id: '3-07', district: 3, index: 7, name: 'Double Hairpin', speed: 320,
    objective: { kind: 'finish', ask: 1 },
    note: 'Two U-turns in a row, one each way.',
    track: `W210 S550 R170@170 S300 L170@170 S400 R90@220 S300 L90@220 S250 R120@200 S250 L120@200 S500`,
  },
  {
    id: '3-08', district: 3, index: 8, name: 'Late Brake', speed: 325,
    objective: { kind: 'combo', ask: 0.6 },
    note: 'Cones sit on the inside of every corner: take the wide line.',
    track: `W190 S550 R90@180[c.5:.7] S120 L90@180[c.5:-.7] S120 R90@180[c.5:.7] S120 L90@180[c.5:-.7]
      S300[c.3:.4 c.6:-.4] R120@170 S250 L120@170[c.5:-.6] S250 R90@180[c.5:.7] L90@180 S500`,
  },
  {
    id: '3-09', district: 3, index: 9, name: 'Sundown Sways', speed: 320,
    objective: { kind: 'drift', ask: 0.7 },
    note: 'Big flowing S-curves at speed: the longest slides in the district.',
    track: `W200 S500 R120@230 L120@230 R120@230 L120@230 S300 L120@230 R120@230 L120@230 R120@230 S500`,
  },
  {
    id: '3-10', district: 3, index: 10, name: 'Sunset Finale', speed: 335,
    objective: { kind: 'time', ask: 0.82 },
    note: 'The whole circuit in one run, flat out.',
    track: `W190 S550 R80@220 S250 L120@180 S200 R120@180 S200 L80@220 S350 R150@170 S300 L70@260 S250
      R100@190 L100@190 S250 R70@240 S500`,
  },
];
