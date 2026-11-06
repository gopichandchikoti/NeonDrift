import { CAR_DESIGNS, PALETTES } from '../game/cosmetics';
import { STAGE_DEFS } from '../game/levels/stages';

export interface StageRecord {
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  /** Fastest finish in sim ticks, or null if never finished. */
  bestTicks: number | null;
  attempts: number;
  cleared: boolean;
}

export interface ScoreEntry {
  score: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  distance: number;
}

export interface Totals {
  runs: number;
  crashes: number;
  finishes: number;
  nearMisses: number;
  edgeKisses: number;
  sparks: number;
  trafficPassed: number;
  boosts: number;
  scrapes: number;
  driftPoints: number;
  distance: number;
  shieldsUsed: number;
  playSeconds: number;
  bestCombo: number;
  longestDrift: number;
}

export interface Progress {
  stages: Record<string, StageRecord>;
  endless: { best: number; bestDistance: number; runs: number };
  daily: Record<string, { score: number; finished: boolean }>;
  dailyStreak: { last: string | null; count: number };
  leaderboard: { endless: ScoreEntry[]; daily: ScoreEntry[] };
  achievements: Record<string, string>;
  totals: Totals;
  garage: { car: string; palette: string };
  tutorialDone: boolean;
  lastStage: string | null;
}

export const PROGRESS_VERSION = 1;
export const LEADERBOARD_SIZE = 10;

export const EMPTY_TOTALS: Totals = {
  runs: 0, crashes: 0, finishes: 0, nearMisses: 0, edgeKisses: 0, sparks: 0, trafficPassed: 0, boosts: 0,
  scrapes: 0, driftPoints: 0, distance: 0, shieldsUsed: 0, playSeconds: 0, bestCombo: 1, longestDrift: 0,
};

export function emptyProgress(): Progress {
  return {
    stages: {},
    endless: { best: 0, bestDistance: 0, runs: 0 },
    daily: {},
    dailyStreak: { last: null, count: 0 },
    leaderboard: { endless: [], daily: [] },
    achievements: {},
    totals: { ...EMPTY_TOTALS },
    garage: { car: 'pulse', palette: 'cyan' },
    tutorialDone: false,
    lastStage: null,
  };
}

type Raw = Record<string, unknown>;
const asRecord = (value: unknown): Raw => (typeof value === 'object' && value !== null ? (value as Raw) : {});
const count = (value: unknown, max = 1e9): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanStage(value: unknown): StageRecord | null {
  const raw = asRecord(value);
  const stars = count(raw.stars, 3) as 0 | 1 | 2 | 3;
  const ticks = typeof raw.bestTicks === 'number' && Number.isFinite(raw.bestTicks) ? count(raw.bestTicks) : null;
  return {
    stars,
    bestScore: count(raw.bestScore),
    bestTicks: ticks,
    attempts: count(raw.attempts),
    cleared: raw.cleared === true || stars > 0,
  };
}

function cleanEntries(value: unknown): ScoreEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.map(asRecord).flatMap((e) => {
    const date = typeof e.date === 'string' && DATE.test(e.date) ? e.date : null;
    return date ? [{ score: count(e.score), date, distance: count(e.distance) }] : [];
  });
  return entries.sort((a, b) => b.score - a.score).slice(0, LEADERBOARD_SIZE);
}

function cleanStages(value: unknown): Record<string, StageRecord> {
  const known = new Set(STAGE_DEFS.map((s) => s.id));
  const out: Record<string, StageRecord> = {};
  for (const [id, record] of Object.entries(asRecord(value))) {
    const clean = known.has(id) ? cleanStage(record) : null;
    if (clean) out[id] = clean;
  }
  return out;
}

function cleanDaily(value: unknown): Progress['daily'] {
  const out: Progress['daily'] = {};
  for (const [key, entry] of Object.entries(asRecord(value))) {
    if (!DATE.test(key)) continue;
    const raw = asRecord(entry);
    out[key] = { score: count(raw.score), finished: raw.finished === true };
  }
  return out;
}

function cleanTotals(value: unknown): Totals {
  const raw = asRecord(value);
  const out: Totals = { ...EMPTY_TOTALS };
  for (const key of Object.keys(EMPTY_TOTALS) as Array<keyof Totals>) out[key] = count(raw[key]);
  out.bestCombo = Math.max(1, out.bestCombo);
  return out;
}

function cleanAchievements(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, when] of Object.entries(asRecord(value))) {
    if (typeof when === 'string' && DATE.test(when.slice(0, 10))) out[id] = when.slice(0, 10);
  }
  return out;
}

/** Turns anything that was stored or imported into a complete, in-range Progress. Never throws. */
export function sanitizeProgress(data: unknown): Progress {
  const raw = asRecord(data);
  const garage = asRecord(raw.garage);
  const endless = asRecord(raw.endless);
  const streak = asRecord(raw.dailyStreak);
  const board = asRecord(raw.leaderboard);
  const car = CAR_DESIGNS.find((c) => c.id === garage.car)?.id ?? 'pulse';
  const palette = PALETTES.find((p) => p.id === garage.palette)?.id ?? 'cyan';
  const last = typeof raw.lastStage === 'string' && STAGE_DEFS.some((s) => s.id === raw.lastStage) ? raw.lastStage : null;
  return {
    stages: cleanStages(raw.stages),
    endless: { best: count(endless.best), bestDistance: count(endless.bestDistance), runs: count(endless.runs) },
    daily: cleanDaily(raw.daily),
    dailyStreak: {
      last: typeof streak.last === 'string' && DATE.test(streak.last) ? streak.last : null,
      count: count(streak.count),
    },
    leaderboard: { endless: cleanEntries(board.endless), daily: cleanEntries(board.daily) },
    achievements: cleanAchievements(raw.achievements),
    totals: cleanTotals(raw.totals),
    garage: { car, palette },
    tutorialDone: raw.tutorialDone === true,
    lastStage: last,
  };
}
