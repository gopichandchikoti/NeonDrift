import type { Progress } from '../services/progress-model';
import { clearedCount, districtCleared, totalStars } from '../services/unlocks';
import { DISTRICTS } from './levels/districts';
import type { RunResult } from './session';

export interface AchievementContext {
  progress: Progress;
  run: RunResult | null;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  test: (ctx: AchievementContext) => boolean;
}

const TICKS_PER_SECOND = 120;

const districtAchievements: AchievementDef[] = DISTRICTS.map((d) => ({
  id: `district-${d.id}`,
  name: `${d.name} cleared`,
  description: `Clear all ten stages of ${d.name}.`,
  test: ({ progress }) => districtCleared(progress, d.id),
}));

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-finish', name: 'First Lap', description: 'Finish any stage.',
    test: ({ progress }) => progress.totals.finishes >= 1,
  },
  {
    id: 'long-slide', name: 'Hold It', description: 'Hold a single drift for 4 seconds.',
    test: ({ progress }) => progress.totals.longestDrift >= 4 * TICKS_PER_SECOND,
  },
  {
    id: 'combo-5', name: 'Chain Reaction', description: 'Reach a x5 combo.',
    test: ({ progress }) => progress.totals.bestCombo >= 5,
  },
  {
    id: 'combo-8', name: 'Maximum Overdrive', description: 'Reach the x8 combo.',
    test: ({ progress }) => progress.totals.bestCombo >= 8,
  },
  {
    id: 'three-stars', name: 'Triple Crown', description: 'Earn three stars on a stage.',
    test: ({ progress }) => Object.values(progress.stages).some((r) => r.stars === 3),
  },
  {
    id: 'stars-30', name: 'Star Collector', description: 'Earn 30 stars in total.',
    test: ({ progress }) => totalStars(progress) >= 30,
  },
  {
    id: 'stars-100', name: 'Constellation', description: 'Earn 100 stars in total.',
    test: ({ progress }) => totalStars(progress) >= 100,
  },
  ...districtAchievements,
  {
    id: 'all-stages', name: 'Perfect Circuit', description: 'Clear all 60 stages.',
    test: ({ progress }) => clearedCount(progress) >= 60,
  },
  {
    id: 'sparks-500', name: 'Spark Hoarder', description: 'Collect 500 sparks.',
    test: ({ progress }) => progress.totals.sparks >= 500,
  },
  {
    id: 'near-50', name: 'Close Call', description: 'Make 50 near misses.',
    test: ({ progress }) => progress.totals.nearMisses >= 50,
  },
  {
    id: 'near-300', name: "Razor's Edge", description: 'Make 300 near misses.',
    test: ({ progress }) => progress.totals.nearMisses >= 300,
  },
  {
    id: 'traffic-100', name: 'Traffic Weaver', description: 'Pass 100 traffic cars.',
    test: ({ progress }) => progress.totals.trafficPassed >= 100,
  },
  {
    id: 'clean-run', name: 'Clean Sweep', description: 'Finish a stage without a single scrape or shield hit.',
    test: ({ run }) => run?.outcome === 'finished' && run.stage !== null && run.stats.scrapes === 0 && run.stats.shieldsUsed === 0,
  },
  {
    id: 'shield-save', name: 'Saved by the Shield', description: 'Let a shield absorb a hit.',
    test: ({ progress }) => progress.totals.shieldsUsed >= 1,
  },
  {
    id: 'boost-10', name: 'Boosted', description: 'Use the boost 10 times.',
    test: ({ progress }) => progress.totals.boosts >= 10,
  },
  {
    id: 'endless-5k', name: 'Open Road', description: 'Score 5,000 in Endless.',
    test: ({ progress }) => progress.endless.best >= 5000,
  },
  {
    id: 'endless-25k', name: 'Night Without End', description: 'Score 25,000 in Endless.',
    test: ({ progress }) => progress.endless.best >= 25000,
  },
  {
    id: 'daily-done', name: 'Daily Driver', description: 'Finish a daily challenge.',
    test: ({ progress }) => Object.values(progress.daily).some((d) => d.finished),
  },
  {
    id: 'daily-streak-3', name: 'Habit Forming', description: 'Play the daily challenge three days in a row.',
    test: ({ progress }) => progress.dailyStreak.count >= 3,
  },
  {
    id: 'crashes-25', name: 'Crash Test', description: 'Crash 25 times. It happens to everyone.',
    test: ({ progress }) => progress.totals.crashes >= 25,
  },
  {
    id: 'distance-100k', name: 'Marathon', description: 'Drive 100,000 units in total.',
    test: ({ progress }) => progress.totals.distance >= 100000,
  },
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
