/**
 * The level gate (also run by `npm run build`). For all 60 stages it checks:
 *   1. static rules: syntax, widths, radii, no self-crossing road, object placement, fair hazard clusters,
 *      unique ids/names/tracks/road shapes, ten stages in each of six districts;
 *   2. that the stored autopilot calibration is current (stage and physics hash);
 *   3. reachability: the autopilot's recorded hold/release input is replayed on the real simulation and must reach
 *      the finish and meet the stage objective, with exactly the recorded score and time (determinism).
 *
 * Scripted checks do not replace playing the stages; see ARCHITECTURE.md#verification-and-release-status.
 */
import { CALIBRATION } from '../../src/game/levels/calibration';
import { resolveStage } from '../../src/game/levels/catalog';
import { stageHash } from '../../src/game/levels/fingerprint';
import { objectiveProgress } from '../../src/game/levels/objectives';
import { createStageWorld, decodeInput } from '../../src/game/levels/runner';
import { STAGE_DEFS } from '../../src/game/levels/stages';
import type { StageDef } from '../../src/game/levels/types';
import { validateSet, validateStage, type Issue } from '../../src/game/levels/validate';

export interface ReplayResult {
  id: string;
  ok: boolean;
  problem?: string;
  score: number;
  ticks: number;
}

export function replayStage(def: StageDef): ReplayResult {
  const cal = CALIBRATION[def.id];
  if (!cal) return { id: def.id, ok: false, problem: 'no calibration (run npm run levels:calibrate)', score: 0, ticks: 0 };
  if (cal.hash !== stageHash(def)) {
    return { id: def.id, ok: false, problem: 'calibration is stale (stage or physics changed)', score: 0, ticks: 0 };
  }
  const world = createStageWorld(def);
  for (const hold of decodeInput(cal.input)) {
    if (!world.running) break;
    world.step({ hold, steer: 0, boost: false });
    world.events.length = 0;
  }
  const stage = resolveStage(def, cal);
  const score = world.stats.score;
  const ticks = world.stats.finishTicks ?? world.tick;
  const result = { id: def.id, score, ticks };
  if (world.status !== 'finished') return { ...result, ok: false, problem: `replay ${world.status}` };
  if (score !== cal.score || ticks !== cal.ticks) {
    return { ...result, ok: false, problem: `replay differs: score ${score} vs ${cal.score}, ticks ${ticks} vs ${cal.ticks}` };
  }
  if (!objectiveProgress(stage, world.stats).met) return { ...result, ok: false, problem: 'objective not met in replay' };
  return { ...result, ok: true };
}

export function runChecks(): { issues: Issue[]; replays: ReplayResult[] } {
  const issues: Issue[] = [...validateSet(STAGE_DEFS)];
  for (const def of STAGE_DEFS) issues.push(...validateStage(def));
  const replays = STAGE_DEFS.map(replayStage);
  for (const r of replays) if (!r.ok) issues.push({ stage: r.id, message: r.problem ?? 'replay failed' });
  return { issues, replays };
}

if (process.argv[1]?.endsWith('check.ts')) {
  const { issues, replays } = runChecks();
  const passed = replays.filter((r) => r.ok).length;
  for (const issue of issues) console.log(`  ✗ ${issue.stage}: ${issue.message}`);
  console.log(`levels: ${STAGE_DEFS.length} stages, ${passed} replayed to a finish with the objective met, ${issues.length} issue(s).`);
  process.exit(issues.length ? 1 : 0);
}
