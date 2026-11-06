import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementById } from '../src/game/achievements';
import { CAR_DESIGNS, PALETTES, designById, designSvg, paletteById, pieceColor } from '../src/game/cosmetics';
import { STAGES } from '../src/game/levels/catalog';
import { STAGE_DEFS } from '../src/game/levels/stages';
import type { RunResult } from '../src/game/session';
import { createStats, type RunStats } from '../src/game/systems/world-types';
import { applyRun, dateKey, previousDay, ProgressStore } from '../src/services/progress';
import { emptyProgress, sanitizeProgress, type Progress } from '../src/services/progress-model';
import { MemoryStore } from '../src/services/storage/store';
import {
  carUnlocked, clearedCount, districtCleared, endlessUnlocked, MAX_STARS, nextToPlay, paletteUnlocked, stageUnlocked,
  totalStars,
} from '../src/services/unlocks';

const pick = <T>(list: readonly T[], index: number): T => list[index] as T;

function stageRun(id: string, over: Partial<RunStats> = {}, stars: 0 | 1 | 2 | 3 = 1, outcome: 'finished' | 'crashed' = 'finished'): RunResult {
  const stage = STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`no stage ${id}`);
  return {
    mode: 'stage', stage, outcome, seconds: 20,
    stats: { ...createStats(), score: 5000, distance: 4000, finishTicks: 2400, ticks: 2400, ...over },
    verdict: { finished: outcome === 'finished', objectiveMet: stars > 0, stars },
  };
}

const modeRun = (mode: 'endless' | 'daily', score: number, outcome: 'finished' | 'crashed' = 'crashed'): RunResult => ({
  mode, stage: null, outcome, seconds: 30, stats: { ...createStats(), score, distance: 3000 },
  verdict: { finished: outcome === 'finished', objectiveMet: true, stars: 0 },
});

/** A progress with the first `count` stages cleared. */
function cleared(count: number, stars: 0 | 1 | 2 | 3 = 1): Progress {
  const p = emptyProgress();
  for (const def of STAGE_DEFS.slice(0, count)) {
    p.stages[def.id] = { stars, bestScore: 1, bestTicks: null, attempts: 1, cleared: true };
  }
  return p;
}

describe('unlocking', () => {
  it('opens stages one after another, and a district only when the last one is cleared', () => {
    const p = emptyProgress();
    expect(stageUnlocked(p, '1-01')).toBe(true);
    expect(stageUnlocked(p, '1-02')).toBe(false);
    expect(stageUnlocked(p, 'nope')).toBe(false);
    expect(stageUnlocked(cleared(1), '1-02')).toBe(true);
    expect(stageUnlocked(cleared(10), '2-01')).toBe(true);
    expect(nextToPlay(emptyProgress())).toBe('1-01');
    expect(nextToPlay(cleared(3))).toBe('1-04');
    expect(nextToPlay(cleared(60))).toBe('6-10');
  });

  it('opens endless and the daily challenge with Electric Alley, and a colour with each district', () => {
    expect(endlessUnlocked(cleared(9))).toBe(false);
    expect(endlessUnlocked(cleared(10))).toBe(true);
    expect(districtCleared(cleared(10), 1)).toBe(true);
    expect(districtCleared(cleared(10), 2)).toBe(false);
    expect(paletteUnlocked(emptyProgress(), pick(PALETTES, 0))).toBe(true);
    expect(paletteUnlocked(emptyProgress(), pick(PALETTES, 1))).toBe(false);
    expect(paletteUnlocked(cleared(10), pick(PALETTES, 1))).toBe(true);
    expect(clearedCount(cleared(7))).toBe(7);
  });

  it('opens cars by total stars, with the first one free', () => {
    expect(CAR_DESIGNS).toHaveLength(8);
    expect(PALETTES).toHaveLength(6);
    expect(carUnlocked(emptyProgress(), pick(CAR_DESIGNS, 0))).toBe(true);
    expect(carUnlocked(emptyProgress(), pick(CAR_DESIGNS, 1))).toBe(false);
    expect(totalStars(cleared(10, 3))).toBe(30);
    expect(carUnlocked(cleared(10, 3), pick(CAR_DESIGNS, 3))).toBe(true);
    expect(carUnlocked(cleared(10, 3), pick(CAR_DESIGNS, 7))).toBe(false);
    expect(MAX_STARS).toBe(180);
    expect(CAR_DESIGNS.map((c) => c.stars)).toEqual([...CAR_DESIGNS.map((c) => c.stars)].sort((a, b) => a - b));
  });
});

describe('recording a run', () => {
  const today = '2026-11-04';

  it('stores a first clear with its stars, best score and fastest time', () => {
    const { progress, report } = applyRun(emptyProgress(), stageRun('1-01', {}, 2), today);
    expect(progress.stages['1-01']).toMatchObject({ stars: 2, bestScore: 5000, bestTicks: 2400, attempts: 1, cleared: true });
    expect(report).toMatchObject({ firstClear: true, bestScore: true });
    expect(report.newAchievements.map((a) => a.id)).toContain('first-finish');
    expect(progress.lastStage).toBe('1-01');
  });

  it('never loses stars, and only reports real improvements', () => {
    const first = applyRun(emptyProgress(), stageRun('1-01', {}, 3), today).progress;
    const worse = applyRun(first, stageRun('1-01', { score: 100, finishTicks: 9000 }, 1), today);
    expect(worse.progress.stages['1-01']).toMatchObject({ stars: 3, bestScore: 5000, bestTicks: 2400, attempts: 2 });
    expect(worse.report).toMatchObject({ firstClear: false, bestScore: false, starsGained: 0 });
    const better = applyRun(worse.progress, stageRun('1-01', { score: 9000, finishTicks: 2000 }, 3), today);
    expect(better.progress.stages['1-01']).toMatchObject({ bestScore: 9000, bestTicks: 2000 });
    expect(better.report.bestScore).toBe(true);
  });

  it('counts a failed attempt without clearing the stage, and never changes the saved original', () => {
    const before = emptyProgress();
    const { progress } = applyRun(before, stageRun('1-01', {}, 0, 'crashed'), today);
    expect(progress.stages['1-01']).toMatchObject({ cleared: false, stars: 0, attempts: 1 });
    expect(progress.totals.crashes).toBe(1);
    expect(before.stages).toEqual({});
  });

  it('adds the run to the lifetime totals and tracks the bests', () => {
    const stats = {
      nearMisses: 4, edgeKisses: 2, sparks: 30, trafficPassed: 6, boosts: 1, scrapes: 3, driftPoints: 700,
      shieldsUsed: 1, peakCombo: 5, longestDrift: 300,
    };
    const { progress } = applyRun(emptyProgress(), stageRun('1-01', stats), today);
    expect(progress.totals).toMatchObject({
      nearMisses: 4, sparks: 30, bestCombo: 5, longestDrift: 300, runs: 1, finishes: 1,
    });
  });

  it('opens new cars, colours and endless mode, and says so', () => {
    const { report } = applyRun(cleared(9, 1), stageRun('1-10', {}, 1), today);
    expect(report.endlessOpened).toBe(true);
    expect(report.newPalettes.map((p) => p.id)).toEqual(['magenta']);
    const stars = applyRun(cleared(3, 3), stageRun('1-04', {}, 3), today);
    expect(stars.report.newCars.length).toBeGreaterThan(0);
  });

  it('keeps a local top ten for endless runs and flags a personal best', () => {
    let p = emptyProgress();
    for (let i = 1; i <= 12; i++) p = applyRun(p, modeRun('endless', i * 100), today).progress;
    expect(p.leaderboard.endless).toHaveLength(10);
    expect(p.leaderboard.endless[0]?.score).toBe(1200);
    expect(p.endless).toMatchObject({ best: 1200, runs: 12 });
    const worse = applyRun(p, modeRun('endless', 50), today);
    expect(worse.report).toMatchObject({ personalBest: false, rank: null });
    const best = applyRun(p, modeRun('endless', 5000), today);
    expect(best.report).toMatchObject({ personalBest: true, rank: 1 });
    expect(applyRun(emptyProgress(), modeRun('endless', 0), today).report.rank).toBeNull();
  });

  it('records the daily challenge per date and runs a streak across consecutive days', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(dateKey(new Date(2026, 10, 4))).toBe('2026-11-04');
    let p = applyRun(emptyProgress(), modeRun('daily', 800, 'finished'), '2026-11-04').progress;
    expect(p.daily['2026-11-04']).toEqual({ score: 800, finished: true });
    p = applyRun(p, modeRun('daily', 300), '2026-11-04').progress;
    expect(p.daily['2026-11-04']).toEqual({ score: 800, finished: true });
    expect(p.dailyStreak).toEqual({ last: '2026-11-04', count: 1 });
    p = applyRun(p, modeRun('daily', 400), '2026-11-05').progress;
    p = applyRun(p, modeRun('daily', 400), '2026-11-06').progress;
    expect(p.dailyStreak.count).toBe(3);
    expect(p.achievements['daily-streak-3']).toBe('2026-11-06');
    p = applyRun(p, modeRun('daily', 400), '2026-11-09').progress;
    expect(p.dailyStreak.count).toBe(1);
  });
});

describe('trophies', () => {
  it('have unique ids and read well', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(3);
      expect(a.description.endsWith('.')).toBe(true);
    }
    expect(achievementById('first-finish')?.name).toBe('First Lap');
    expect(achievementById('nope')).toBeUndefined();
  });

  it('are earned from play, once, with the date', () => {
    const clean = stageRun('1-01', { scrapes: 0, shieldsUsed: 0 });
    const a = applyRun(emptyProgress(), clean, '2026-11-04');
    expect(a.report.newAchievements.map((x) => x.id)).toEqual(expect.arrayContaining(['first-finish', 'clean-run']));
    const b = applyRun(a.progress, clean, '2026-11-05');
    expect(b.report.newAchievements).toEqual([]);
    expect(b.progress.achievements['first-finish']).toBe('2026-11-04');
    const dirty = applyRun(emptyProgress(), stageRun('1-01', { scrapes: 1 }), '2026-11-04');
    expect(dirty.progress.achievements['clean-run']).toBeUndefined();
  });

  it('cover districts, stars, collections and the endless goals', () => {
    const all = applyRun(cleared(59, 3), stageRun('6-10', {}, 3), '2026-11-04');
    const ids = Object.keys(all.progress.achievements);
    expect(ids).toEqual(expect.arrayContaining(['all-stages', 'stars-100', 'three-stars', 'district-6', 'district-1']));
    const endless = applyRun(emptyProgress(), modeRun('endless', 30000), '2026-11-04');
    expect(Object.keys(endless.progress.achievements)).toEqual(expect.arrayContaining(['endless-5k', 'endless-25k']));
  });
});

describe('the save', () => {
  it('survives garbage: every field is repaired or dropped', () => {
    const messy = sanitizeProgress({
      stages: { '1-01': { stars: 9, bestScore: -5, bestTicks: 'x', attempts: 2.7 }, 'fake-stage': { stars: 3 }, '1-02': 'bad' },
      endless: { best: 'lots' }, daily: { '2026-11-04': { score: 5, finished: 1 }, nonsense: { score: 1 } },
      dailyStreak: { last: 'yesterday', count: -3 },
      leaderboard: { endless: [{ score: 5, date: '2026-01-01' }, { score: 9, date: 'bad' }, 3], daily: 'no' },
      achievements: { 'first-finish': '2026-11-04T10:00:00Z', x: 5 },
      totals: { runs: 3.9, bestCombo: 0 },
      garage: { car: 'fake', palette: 'fake' },
      lastStage: 'unknown',
    });
    expect(messy.stages['1-01']).toMatchObject({ stars: 3, bestScore: 0, bestTicks: null, attempts: 2, cleared: true });
    expect(messy.stages['fake-stage']).toBeUndefined();
    expect(messy.stages['1-02']).toMatchObject({ stars: 0, cleared: false });
    expect(messy.endless.best).toBe(0);
    expect(messy.daily).toEqual({ '2026-11-04': { score: 5, finished: false } });
    expect(messy.dailyStreak).toEqual({ last: null, count: 0 });
    expect(messy.leaderboard.endless).toEqual([{ score: 5, date: '2026-01-01', distance: 0 }]);
    expect(messy.leaderboard.daily).toEqual([]);
    expect(messy.achievements).toEqual({ 'first-finish': '2026-11-04' });
    expect(messy.totals).toMatchObject({ runs: 3, bestCombo: 1 });
    expect(messy.garage).toEqual({ car: 'pulse', palette: 'cyan' });
    expect(messy.lastStage).toBeNull();
    expect(sanitizeProgress(undefined)).toEqual(emptyProgress());
  });

  it('is saved after every change and comes back identical', () => {
    const store = new MemoryStore();
    const a = new ProgressStore(store);
    a.record(stageRun('1-01', {}, 2), '2026-11-04');
    const b = new ProgressStore(store);
    expect(b.value.stages['1-01']?.stars).toBe(2);
    expect(b.loadInfo.source).toBe('primary');
  });

  it('exports and imports as text, rejecting anything that is not a Neon Drift save', () => {
    const a = new ProgressStore(new MemoryStore());
    a.record(stageRun('1-01', {}, 3), '2026-11-04');
    const text = a.exportText();
    const b = new ProgressStore(new MemoryStore());
    expect(b.importText(text)).toBe(true);
    expect(b.value.stages['1-01']?.stars).toBe(3);
    for (const bad of ['', 'nope', '{}', JSON.stringify({ game: 'other', version: 1, progress: {} }),
      JSON.stringify({ game: 'neon-drift', version: 99, progress: {} }), JSON.stringify({ game: 'neon-drift', version: 1, progress: null })]) {
      expect(b.importText(bad)).toBe(false);
    }
    expect(b.value.stages['1-01']?.stars).toBe(3);
  });

  it('puts a locked car back to the starter when a save asks for one it has not earned', () => {
    const store = new MemoryStore();
    const p = emptyProgress();
    p.garage = { car: 'phantom', palette: 'white' };
    store.set('neon-drift.progress', JSON.stringify({ version: 1, data: p }));
    expect(new ProgressStore(store).value.garage).toEqual({ car: 'pulse', palette: 'cyan' });
  });

  it('can update in place and reset, and notices when saving is blocked', () => {
    const store = new MemoryStore();
    const a = new ProgressStore(store);
    a.update((p) => {
      p.tutorialDone = true;
    });
    expect(new ProgressStore(store).value.tutorialDone).toBe(true);
    a.reset();
    expect(a.value).toEqual(emptyProgress());
    const blocked = new ProgressStore({ get: () => null, set: () => false, remove: () => undefined });
    blocked.record(stageRun('1-01'), '2026-11-04');
    expect(blocked.saveWorks).toBe(false);
  });
});

describe('cosmetics', () => {
  it('draw every design in every palette, and fall back to the starter for an unknown id', () => {
    for (const design of CAR_DESIGNS) {
      for (const palette of PALETTES) expect(designSvg(design, palette)).toContain('<polygon');
      expect(design.pieces.some((p) => p.layer === 'body')).toBe(true);
      expect(design.pieces.every((p) => p.pts.length % 2 === 0)).toBe(true);
    }
    expect(designById('nope').id).toBe('pulse');
    expect(paletteById('nope').id).toBe('cyan');
    const palette = pick(PALETTES, 0);
    expect(new Set(['body', 'accent', 'dark', 'glass'].map((l) => pieceColor(l as 'body', palette))).size).toBeGreaterThan(2);
  });

  it('keep every car inside the same footprint, so style never changes the hit box', () => {
    for (const design of CAR_DESIGNS) {
      const xs = design.pieces.flatMap((p) => p.pts.filter((_, i) => i % 2 === 0));
      const ys = design.pieces.flatMap((p) => p.pts.filter((_, i) => i % 2 === 1));
      expect(Math.max(...xs.map(Math.abs)), design.id).toBeLessThanOrEqual(17.5);
      expect(Math.max(...ys.map(Math.abs)), design.id).toBeLessThanOrEqual(9.5);
    }
  });
});
