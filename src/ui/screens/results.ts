import type { AppContext, ScreenView } from '../../app/context';
import { nextStage } from '../../game/levels/catalog';
import { objectiveSentence } from '../../game/levels/objectives';
import type { RunResult } from '../../game/session';
import type { RunReport } from '../../services/progress';
import { reducedMotion } from '../../services/settings';
import { stageUnlocked } from '../../services/unlocks';
import { formatScore, formatTime, h } from '../dom';
import { icon, starIcon } from '../icons';

export interface ResultActions {
  retry: () => void;
}

interface Heading {
  text: string;
  tone: 'good' | 'bad';
}

function headingFor(run: RunResult): Heading {
  if (run.mode === 'stage') {
    if (run.verdict.stars > 0) return { text: 'Stage clear', tone: 'good' };
    return { text: run.outcome === 'crashed' ? 'Crashed' : 'Objective missed', tone: 'bad' };
  }
  return run.outcome === 'finished' ? { text: 'Daily complete', tone: 'good' } : { text: 'Run over', tone: 'bad' };
}

function countUp(el: HTMLElement, to: number, reduced: boolean): void {
  if (reduced || to <= 0) {
    el.textContent = formatScore(to);
    return;
  }
  const start = performance.now();
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / 900);
    el.textContent = formatScore(to * (1 - (1 - t) ** 3));
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function scoreBanners(report: RunReport, run: RunResult): string[] {
  const out: string[] = [];
  if (report.firstClear) out.push('First clear!');
  else if (report.starsGained > 0) out.push(`+${report.starsGained} star${report.starsGained > 1 ? 's' : ''}`);
  if (report.bestScore) out.push('New best score');
  if (report.personalBest && run.mode !== 'stage') out.push('New personal best');
  if (report.rank !== null) out.push(`Local leaderboard: #${report.rank}`);
  return out;
}

function unlockBanners(report: RunReport): string[] {
  return [
    ...report.newCars.map((car) => `Car unlocked: ${car.name}`),
    ...report.newPalettes.map((palette) => `Colour unlocked: ${palette.name}`),
    ...(report.endlessOpened ? ['Endless mode and the Daily Challenge are open!'] : []),
    ...report.newAchievements.map((a) => `Trophy: ${a.name}`),
  ];
}

function starsRow(ctx: AppContext, run: RunResult, reduced: boolean): HTMLElement | null {
  if (!run.stage) return null;
  const earned = run.verdict.stars;
  const row = h('div', { class: 'results__stars', role: 'img', 'aria-label': `${earned} of 3 stars` });
  for (let n = 1; n <= 3; n++) {
    const delay = reduced ? 0 : 450 + n * 330;
    const star = starIcon(n <= earned);
    star.setAttribute('style', `animation-delay:${delay}ms`);
    if (n <= earned) setTimeout(() => ctx.audio.sfx.play('star', n - 1), delay);
    row.append(star);
  }
  return row;
}

function statCells(run: RunResult): Array<[string, string]> {
  const s = run.stats;
  return [
    ['Time', formatTime(run.seconds)],
    ['Drift', formatScore(s.driftPoints)],
    ['Near misses', String(s.nearMisses)],
    ['Sparks', String(s.sparks)],
    ['Best combo', `x${s.peakCombo}`],
    run.stage ? ['Cars passed', String(s.trafficPassed)] : ['Distance', formatScore(s.distance)],
  ];
}

function actions(ctx: AppContext, run: RunResult, retry: () => void): HTMLElement {
  const next = run.stage && run.verdict.stars > 0 ? nextStage(run.stage.id) : undefined;
  const advance = next !== undefined && stageUnlocked(ctx.progress.value, next.id) ? next : undefined;
  const retryButton = (primary: boolean): HTMLElement =>
    h('button', { class: primary ? 'btn btn--primary btn--big btn--block' : 'btn', type: 'button', onClick: retry }, icon('restart'), 'Retry');
  return h('div', { class: 'results__actions' },
    advance
      ? h('button', { class: 'btn btn--primary btn--big btn--block', type: 'button', onClick: () => ctx.nav.playStage(advance.id) },
        icon('play'), `Next: ${advance.name}`)
      : retryButton(true),
    h('div', { class: 'row' },
      advance ? retryButton(false) : null,
      h('button', { class: 'btn', type: 'button', onClick: () => ctx.nav.quitToStages() }, icon('car'), 'Stages'),
      h('button', { class: 'btn', type: 'button', onClick: () => ctx.nav.quitToMenu() }, icon('home'), 'Menu'),
    ),
  );
}

function runTitle(run: RunResult): string {
  if (run.stage) return `${run.stage.id} ${run.stage.name}`;
  return run.mode === 'daily' ? 'Daily challenge' : 'Endless';
}

export function buildResults(ctx: AppContext, run: RunResult, report: RunReport, handlers: ResultActions): ScreenView {
  const heading = headingFor(run);
  const reduced = reducedMotion(ctx.settings.value, matchMedia('(prefers-reduced-motion: reduce)').matches);
  const score = h('div', { class: 'results__score', 'aria-label': `Score ${run.stats.score}` }, '0');
  countUp(score, run.stats.score, reduced);
  const missed = run.stage && run.outcome === 'finished' && !run.verdict.objectiveMet
    ? h('p', { class: 'banner', role: 'status' }, `You reached the finish, but the objective was not met: ${objectiveSentence(run.stage)}.`)
    : null;
  const banners = [...scoreBanners(report, run), ...unlockBanners(report)].map((text) => h('div', { class: 'banner' }, text));
  const el = h('main', { class: 'screen results', 'aria-label': 'Results' },
    h('div', {},
      h('p', { class: 'muted', style: 'margin:0;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase' }, runTitle(run)),
      h('h1', { class: `results__title display results__title--${heading.tone}`, tabindex: '-1' }, heading.text),
    ),
    score,
    starsRow(ctx, run, reduced),
    missed,
    ...banners,
    h('dl', { class: 'stats' }, ...statCells(run).map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value)))),
    actions(ctx, run, handlers.retry),
  );
  return { el, title: heading.text };
}
