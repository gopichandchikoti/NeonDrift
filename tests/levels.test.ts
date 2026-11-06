import { describe, expect, it } from 'vitest';
import { replayStage } from '../scripts/validate-levels/check';
import { CALIBRATION } from '../src/game/levels/calibration';
import { nextStage, resolveStage, stageById, STAGES, stagesOfDistrict } from '../src/game/levels/catalog';
import { DISTRICTS, districtById } from '../src/game/levels/districts';
import { FAIR, largestGap, meetingPoint, placeAll, type Placed } from '../src/game/levels/fairness';
import { normaliseTrack, stageHash } from '../src/game/levels/fingerprint';
import {
  judgeRun, objectiveProgress, objectiveSentence, objectiveTarget, OBJECTIVE_TITLES,
} from '../src/game/levels/objectives';
import { buildStage, createStageWorld, decodeInput, encodeInput } from '../src/game/levels/runner';
import { STAGE_DEFS } from '../src/game/levels/stages';
import type { Calibration, ObjectiveKind, StageDef } from '../src/game/levels/types';
import { shapeSignature, validateSet, validateStage } from '../src/game/levels/validate';
import { Track } from '../src/game/physics/track';
import { parseTrack } from '../src/game/physics/track-dsl';
import { createStats } from '../src/game/systems/world-types';

const def = (track: string, over: Partial<StageDef> = {}): StageDef => ({
  id: '1-01', district: 1, index: 1, name: 'Test', speed: 300, objective: { kind: 'finish', ask: 1 },
  note: 'A test stage.', track, ...over,
});
const messages = (d: StageDef): string[] => validateStage(d).map((i) => i.message);

describe('the 60 stages', () => {
  it('are six districts of ten, in order, with unique ids, names and roads', () => {
    expect(STAGE_DEFS).toHaveLength(60);
    expect(DISTRICTS).toHaveLength(6);
    for (const district of DISTRICTS) expect(stagesOfDistrict(district.id)).toHaveLength(10);
    expect(STAGE_DEFS.map((s) => s.id)).toEqual(
      DISTRICTS.flatMap((d) => Array.from({ length: 10 }, (_, i) => `${d.id}-${String(i + 1).padStart(2, '0')}`)),
    );
    expect(new Set(STAGE_DEFS.map((s) => s.name)).size).toBe(60);
    expect(new Set(STAGE_DEFS.map(shapeSignature)).size).toBe(60);
    expect(new Set(STAGE_DEFS.map((s) => normaliseTrack(s.track))).size).toBe(60);
  });

  it('pass every static rule: geometry, no crossing roads, fair hazard placement', () => {
    expect(validateSet(STAGE_DEFS)).toEqual([]);
    for (const stage of STAGE_DEFS) expect(validateStage(stage), stage.id).toEqual([]);
  });

  it('each have a current calibration that replays to a finish with the objective met, exactly', () => {
    for (const stage of STAGE_DEFS) {
      const result = replayStage(stage);
      expect(result, `${stage.id}: ${result.problem ?? ''}`).toMatchObject({ ok: true });
    }
  });

  it('are long enough to play: every stage lasts between 11 and 35 seconds for the autopilot', () => {
    for (const stage of STAGES) {
      const seconds = (stage.calibration?.ticks ?? 0) / 120;
      expect(seconds, stage.id).toBeGreaterThan(11);
      expect(seconds, stage.id).toBeLessThan(35);
    }
  });

  it('have ascending star thresholds and objective targets the autopilot already reached', () => {
    for (const stage of STAGES) {
      const cal = stage.calibration as Calibration;
      expect(stage.stars[0], stage.id).toBeGreaterThan(0);
      expect(stage.stars[1], stage.id).toBeGreaterThan(stage.stars[0]);
      expect(stage.stars[1], stage.id).toBeLessThanOrEqual(cal.score);
    }
  });

  it('use every objective kind, and every district introduces its signature hazard', () => {
    const kinds = new Set(STAGE_DEFS.map((s) => s.objective.kind));
    expect([...kinds].sort()).toEqual(['combo', 'drift', 'finish', 'sparks', 'time', 'traffic']);
    const has = (district: number, kind: string): boolean =>
      stagesOfDistrict(district).some((s) => parseTrack(s.track).items.some((i) => i.kind === kind));
    expect(has(1, 'traffic') || has(1, 'gate')).toBe(false);
    expect(has(4, 'traffic')).toBe(true);
    expect(has(5, 'gate')).toBe(true);
    expect(has(2, 'block')).toBe(true);
  });

  it('can be looked up, and know what comes next', () => {
    expect(stageById('3-02')?.name).toBe('Hairpin Intro');
    expect(stageById('9-99')).toBeUndefined();
    expect(nextStage('1-01')?.id).toBe('1-02');
    expect(nextStage('1-10')?.id).toBe('2-01');
    expect(nextStage('6-10')).toBeUndefined();
    expect(nextStage('nope')).toBeUndefined();
    expect(() => districtById(99)).toThrow();
  });

  it('give an uncalibrated stage empty targets instead of failing', () => {
    const resolved = resolveStage(STAGE_DEFS[0] as StageDef, null);
    expect(resolved).toMatchObject({ objectiveTarget: 0, stars: [0, 0], calibration: null });
  });
});

describe('the validator catches what it should', () => {
  const GOOD = 'W220 S1200 R90@260 S1800';

  it('accepts a sound stage', () => {
    expect(messages(def(GOOD))).toEqual([]);
  });

  it('rejects bad syntax, widths, radii and angles', () => {
    expect(messages(def('S400 R90'))[0]).toMatch(/syntax/);
    expect(messages(def('W120 S3500'))).toEqual(expect.arrayContaining([expect.stringMatching(/width 120/)]));
    expect(messages(def('W220 S800 R90@120 S500'))).toEqual(expect.arrayContaining([expect.stringMatching(/radius 120/)]));
    expect(messages(def('W260 S800 R90@170 S500'))).toEqual(expect.arrayContaining([expect.stringMatching(/folds/)]));
    expect(messages(def('W220 S800 R5@300 S500'))).toEqual(expect.arrayContaining([expect.stringMatching(/degrees/)]));
    expect(messages(def('W220 S40 S3500'))).toEqual(expect.arrayContaining([expect.stringMatching(/shorter than 60/)]));
  });

  it('rejects a road that is too short, too fast or that crosses itself', () => {
    expect(messages(def('S500'))).toEqual(expect.arrayContaining([expect.stringMatching(/length/)]));
    expect(messages(def(GOOD, { speed: 900 }))).toEqual(expect.arrayContaining([expect.stringMatching(/speed/)]));
    expect(messages(def('W200 S800 R180@200 S100 R180@200 S100 R180@200 S100 R180@200 S600'))).toEqual(
      expect.arrayContaining([expect.stringMatching(/crosses itself/)]),
    );
  });

  it('rejects unfair or badly placed hazards', () => {
    expect(messages(def('W220 S800[c.1:0] R90@260 S500'))).toEqual(expect.arrayContaining([expect.stringMatching(/near the start/)]));
    expect(messages(def('W220 S800 R90@260 S500[c.95:0]'))).toEqual(expect.arrayContaining([expect.stringMatching(/near the finish/)]));
    const wall = 'W190 S900[b.5:-.5 b.52:.5 b.54:0] R90@260 S1000';
    expect(messages(def(wall))).toEqual(expect.arrayContaining([expect.stringMatching(/leave a gap/)]));
    expect(messages(def('W220 S1000[g.5:.8:2 c.52:0] R90@260 S1000'))).toEqual(
      expect.arrayContaining([expect.stringMatching(/gate .* another hazard/)]),
    );
    expect(messages(def('W180 S1500[g.5:.8:2] R90@260 S1500'))).toEqual([]);
  });

  it('flags id, objective and text mistakes, and duplicates across a set', () => {
    expect(messages(def(GOOD, { id: 'x' }))).toEqual(expect.arrayContaining([expect.stringMatching(/bad id/)]));
    expect(messages(def(GOOD, { id: '1-02' }))).toEqual(expect.arrayContaining([expect.stringMatching(/does not match/)]));
    expect(messages(def(GOOD, { objective: { kind: 'finish', ask: 2 } }))).toEqual(expect.arrayContaining([expect.stringMatching(/ask/)]));
    expect(messages(def(GOOD, { name: ' ' }))).toEqual(expect.arrayContaining([expect.stringMatching(/missing name/)]));
    const copy = validateSet([def(GOOD), def(GOOD)]);
    expect(copy.map((i) => i.message).join(' ')).toMatch(/duplicates/);
    expect(copy.map((i) => i.message).join(' ')).toMatch(/expected 60/);
  });
});

describe('fairness rules', () => {
  it('measures the widest gap left by a cluster, and where traffic is really met', () => {
    const at = (lat: number, side = 26): Placed => ({ item: { kind: 'block', segment: 0, at: 0, lat: 0 }, s: 0, lat, side });
    expect(largestGap([], 100)).toBeCloseTo(194);
    expect(largestGap([at(0)], 100)).toBeCloseTo(71, 0);
    expect(largestGap([at(-45), at(45)], 100)).toBeLessThan(FAIR.minGap + 40);
    expect(meetingPoint(1000, 150, 300)).toBeCloseTo(1000 + 150 * 560 / 150, 0);
    expect(meetingPoint(200, 0, 300)).toBe(200);
  });

  it('place hazards in the order they are met', () => {
    const track = new Track(parseTrack('W220 S2000').segments);
    const items = parseTrack('W220 S2000[c.7:0 c.2:0 t.4:.4:150]').items;
    const placed = placeAll(track, items, 300);
    expect(placed.map((p) => p.item.kind).sort()).toEqual(['cone', 'cone', 'traffic']);
    expect(placed.map((p) => p.s)).toEqual([...placed.map((p) => p.s)].sort((a, b) => a - b));
  });
});

describe('objectives', () => {
  const cal: Calibration = {
    score: 5000, ticks: 2400, driftPoints: 3000, peakCombo: 6, sparks: 40, trafficPassed: 10, input: [], hash: '',
  };
  const target = (kind: ObjectiveKind, ask: number): number => objectiveTarget({ kind, ask }, cal);

  it('turns the authored ask into a number from what the autopilot reached', () => {
    expect(target('finish', 1)).toBe(0);
    expect(target('drift', 0.5)).toBe(1500);
    expect(target('combo', 0.6)).toBe(3);
    expect(target('combo', 0.1)).toBe(2);
    expect(target('sparks', 0.5)).toBe(20);
    expect(target('traffic', 0.7)).toBe(7);
    expect(target('time', 0.8)).toBe(3000);
  });

  it('describes every kind in words and has a title for it', () => {
    for (const kind of ['finish', 'drift', 'combo', 'sparks', 'traffic', 'time'] as const) {
      const sentence = objectiveSentence({ objective: { kind, ask: 1 }, objectiveTarget: 9 });
      expect(sentence.length).toBeGreaterThan(8);
      expect(OBJECTIVE_TITLES[kind].length).toBeGreaterThan(5);
    }
    expect(objectiveSentence({ objective: { kind: 'time', ask: 1 }, objectiveTarget: 2400 })).toContain('20.0 s');
  });

  it('track progress toward each objective and say when it is met', () => {
    const stats = { ...createStats(), driftPoints: 500, peakCombo: 3, sparks: 5, trafficPassed: 2, ticks: 1000 };
    const at = (kind: ObjectiveKind, goal: number): ReturnType<typeof objectiveProgress> =>
      objectiveProgress({ objective: { kind, ask: 1 }, objectiveTarget: goal }, stats);
    expect(at('drift', 1000)).toMatchObject({ value: 500, met: false, fraction: 0.5 });
    expect(at('combo', 3).met).toBe(true);
    expect(at('sparks', 8).fraction).toBeCloseTo(0.625);
    expect(at('traffic', 2).met).toBe(true);
    expect(at('finish', 0).met).toBe(true);
    expect(at('time', 1500)).toMatchObject({ met: true, value: 500 });
    expect(objectiveProgress({ objective: { kind: 'time', ask: 1 }, objectiveTarget: 900 }, stats).met).toBe(false);
  });

  it('award stars only for a finished run that met its objective', () => {
    const stage = stageById('1-03');
    if (!stage) throw new Error('missing stage');
    const stats = { ...createStats(), score: stage.stars[1], driftPoints: stage.objectiveTarget + 1 };
    expect(judgeRun(stage, stats, true).stars).toBe(3);
    expect(judgeRun(stage, { ...stats, score: stage.stars[0] }, true).stars).toBe(2);
    expect(judgeRun(stage, { ...stats, score: 1 }, true).stars).toBe(1);
    expect(judgeRun(stage, stats, false).stars).toBe(0);
    const missed = judgeRun(stage, { ...stats, driftPoints: 0 }, true);
    expect(missed).toMatchObject({ stars: 0, finished: true, objectiveMet: false });
  });
});

describe('stage plumbing', () => {
  it('round-trips an input recording through run-length encoding', () => {
    const holds = [false, false, true, true, true, false, true];
    expect(decodeInput(encodeInput(holds))).toEqual(holds);
    expect(encodeInput([true, true])).toEqual([0, 2]);
    expect(encodeInput([])).toEqual([0]);
  });

  it('changes the fingerprint when the road, the speed or the shield changes, but not for reformatting', () => {
    const base = def('W220 S800 R90@260 S500');
    expect(stageHash(def('W220   S800\n R90@260 S500'))).toBe(stageHash(base));
    expect(stageHash(def('W220 S800 R90@270 S500'))).not.toBe(stageHash(base));
    expect(stageHash({ ...base, speed: 310 })).not.toBe(stageHash(base));
    expect(stageHash({ ...base, startShield: true })).not.toBe(stageHash(base));
  });

  it('builds a stage world with the district rules, the stage speed and the finish line', () => {
    const stage = STAGE_DEFS[5] as StageDef;
    const world = createStageWorld(stage, { sensitivity: 1.1 });
    expect(world.rules.baseSpeed).toBe(stage.speed);
    expect(world.rules.sensitivity).toBe(1.1);
    expect(world.rules.scrapeAngle).toBe(districtById(1).scrapeAngle);
    expect(world.rules.finishS).toBeCloseTo(buildStage(stage).track.length - 160);
    expect(CALIBRATION[stage.id]?.hash).toBe(stageHash(stage));
  });
});
