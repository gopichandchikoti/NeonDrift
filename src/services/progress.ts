import { ACHIEVEMENTS, type AchievementDef } from '../game/achievements';
import { CAR_DESIGNS, PALETTES, type CarDesign, type Palette } from '../game/cosmetics';
import type { RunResult } from '../game/session';
import {
  emptyProgress,
  LEADERBOARD_SIZE,
  PROGRESS_VERSION,
  sanitizeProgress,
  type Progress,
  type ScoreEntry,
  type StageRecord,
} from './progress-model';
import { SaveSlot, type LoadResult, type SaveSpec } from './storage/save-slot';
import type { KeyValueStore } from './storage/store';
import { carUnlocked, endlessUnlocked, paletteUnlocked } from './unlocks';

export interface RunReport {
  firstClear: boolean;
  starsGained: number;
  bestScore: boolean;
  personalBest: boolean;
  /** 1-based place on the local leaderboard, or null when it did not make the top ten. */
  rank: number | null;
  newAchievements: AchievementDef[];
  newCars: CarDesign[];
  newPalettes: Palette[];
  endlessOpened: boolean;
}

const clone = (p: Progress): Progress => JSON.parse(JSON.stringify(p)) as Progress;

/** Local calendar date as YYYY-MM-DD (the daily challenge and its streak run on this, not on UTC). */
export function dateKey(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dateKey(new Date(y, m - 1, d - 1));
}

function addTotals(p: Progress, run: RunResult): void {
  const t = p.totals;
  const s = run.stats;
  t.runs += 1;
  if (run.outcome === 'crashed') t.crashes += 1;
  else t.finishes += 1;
  t.nearMisses += s.nearMisses;
  t.edgeKisses += s.edgeKisses;
  t.sparks += s.sparks;
  t.trafficPassed += s.trafficPassed;
  t.boosts += s.boosts;
  t.scrapes += s.scrapes;
  t.driftPoints += s.driftPoints;
  t.distance += Math.round(s.distance);
  t.shieldsUsed += s.shieldsUsed;
  t.playSeconds += Math.round(run.seconds);
  t.bestCombo = Math.max(t.bestCombo, s.peakCombo);
  t.longestDrift = Math.max(t.longestDrift, s.longestDrift);
}

function emptyRecord(): StageRecord {
  return { stars: 0, bestScore: 0, bestTicks: null, attempts: 0, cleared: false };
}

function applyStage(p: Progress, run: RunResult, report: RunReport): void {
  const stage = run.stage;
  if (!stage) return;
  const record: StageRecord = p.stages[stage.id] ?? emptyRecord();
  record.attempts += 1;
  p.lastStage = stage.id;
  const stars = run.verdict.stars;
  if (stars > 0) {
    report.firstClear = !record.cleared;
    report.starsGained = Math.max(0, stars - record.stars);
    report.bestScore = run.stats.score > record.bestScore;
    record.cleared = true;
    record.stars = Math.max(record.stars, stars) as StageRecord['stars'];
    record.bestScore = Math.max(record.bestScore, run.stats.score);
    const ticks = run.stats.finishTicks;
    if (ticks !== null) record.bestTicks = record.bestTicks === null ? ticks : Math.min(record.bestTicks, ticks);
  }
  p.stages[stage.id] = record;
}

function insertScore(board: ScoreEntry[], entry: ScoreEntry): number | null {
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  board.length = Math.min(board.length, LEADERBOARD_SIZE);
  const index = board.indexOf(entry);
  return index >= 0 ? index + 1 : null;
}

function applyEndless(p: Progress, run: RunResult, today: string, report: RunReport): void {
  p.endless.runs += 1;
  report.personalBest = run.stats.score > p.endless.best;
  p.endless.best = Math.max(p.endless.best, run.stats.score);
  p.endless.bestDistance = Math.max(p.endless.bestDistance, Math.round(run.stats.distance));
  const entry = { score: run.stats.score, date: today, distance: Math.round(run.stats.distance) };
  report.rank = run.stats.score > 0 ? insertScore(p.leaderboard.endless, entry) : null;
}

/** Extends the streak when today follows the last day played, restarts it after a gap, ignores a repeat. */
function bumpStreak(streak: Progress['dailyStreak'], today: string): void {
  if (streak.last === today) return;
  streak.count = streak.last === previousDay(today) ? streak.count + 1 : 1;
  streak.last = today;
}

function applyDaily(p: Progress, run: RunResult, today: string, report: RunReport): void {
  const before = p.daily[today] ?? { score: 0, finished: false };
  report.personalBest = run.stats.score > before.score;
  p.daily[today] = {
    score: Math.max(before.score, run.stats.score),
    finished: before.finished || run.outcome === 'finished',
  };
  bumpStreak(p.dailyStreak, today);
  const entry = { score: run.stats.score, date: today, distance: Math.round(run.stats.distance) };
  report.rank = run.stats.score > 0 ? insertScore(p.leaderboard.daily, entry) : null;
}

/** What is unlocked right now: ids of cars and palettes, and whether Endless is open. */
function unlockedSet(p: Progress): { cars: string[]; palettes: string[]; endless: boolean } {
  return {
    cars: CAR_DESIGNS.filter((c) => carUnlocked(p, c)).map((c) => c.id),
    palettes: PALETTES.filter((c) => paletteUnlocked(p, c)).map((c) => c.id),
    endless: endlessUnlocked(p),
  };
}

/** Applies a finished run to a copy of the progress and reports what changed. The input is never modified. */
export function applyRun(before: Progress, run: RunResult, today: string): { progress: Progress; report: RunReport } {
  const p = clone(before);
  const report: RunReport = {
    firstClear: false, starsGained: 0, bestScore: false, personalBest: false, rank: null,
    newAchievements: [], newCars: [], newPalettes: [], endlessOpened: false,
  };
  const was = unlockedSet(before);
  addTotals(p, run);
  if (run.mode === 'stage') applyStage(p, run, report);
  else if (run.mode === 'endless') applyEndless(p, run, today, report);
  else applyDaily(p, run, today, report);
  const now = unlockedSet(p);
  report.newCars = CAR_DESIGNS.filter((c) => now.cars.includes(c.id) && !was.cars.includes(c.id));
  report.newPalettes = PALETTES.filter((c) => now.palettes.includes(c.id) && !was.palettes.includes(c.id));
  report.endlessOpened = now.endless && !was.endless;
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id] || !a.test({ progress: p, run })) continue;
    p.achievements[a.id] = today;
    report.newAchievements.push(a);
  }
  return { progress: p, report };
}

const spec: SaveSpec<Progress> = {
  key: 'neon-drift.progress',
  version: PROGRESS_VERSION,
  defaults: emptyProgress,
  migrate: (data) => data,
  validate: (data) => (typeof data === 'object' && data !== null ? sanitizeProgress(data) : null),
};

/** Progress held in memory and saved after every change (with a rolling backup and corruption fallback). */
export class ProgressStore {
  private readonly slot: SaveSlot<Progress>;
  private current: Progress;
  readonly loadInfo: LoadResult<Progress>;
  /** False when the browser refused to store anything: play continues, but nothing will be remembered. */
  saveWorks = true;

  constructor(store: KeyValueStore) {
    this.slot = new SaveSlot(store, spec);
    this.loadInfo = this.slot.load();
    this.current = this.enforceGarage(this.loadInfo.value);
  }

  get value(): Progress {
    return this.current;
  }

  private enforceGarage(p: Progress): Progress {
    const car = CAR_DESIGNS.find((c) => c.id === p.garage.car);
    const palette = PALETTES.find((c) => c.id === p.garage.palette);
    if (!car || !carUnlocked(p, car)) p.garage.car = 'pulse';
    if (!palette || !paletteUnlocked(p, palette)) p.garage.palette = 'cyan';
    return p;
  }

  private commit(next: Progress): void {
    this.current = this.enforceGarage(next);
    this.saveWorks = this.slot.save(this.current);
  }

  record(run: RunResult, today: string): RunReport {
    const { progress, report } = applyRun(this.current, run, today);
    this.commit(progress);
    return report;
  }

  update(change: (draft: Progress) => void): void {
    const draft = clone(this.current);
    change(draft);
    this.commit(draft);
  }

  /** The whole save as text, for the export button. */
  exportText(): string {
    return JSON.stringify({ game: 'neon-drift', version: PROGRESS_VERSION, progress: this.current });
  }

  /** Replaces the save from exported text. Returns false (and changes nothing) when the text is not a valid export. */
  importText(text: string): boolean {
    try {
      const parsed = JSON.parse(text) as { game?: unknown; version?: unknown; progress?: unknown };
      if (parsed.game !== 'neon-drift' || typeof parsed.version !== 'number' || parsed.version > PROGRESS_VERSION) return false;
      if (typeof parsed.progress !== 'object' || parsed.progress === null) return false;
      this.commit(sanitizeProgress(parsed.progress));
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.commit(emptyProgress());
  }
}
