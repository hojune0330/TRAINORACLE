// Deterministic strategy comparison, not a human fun/retention measurement.
// Run from app: node scripts/audit-solo-party.mjs > ../.scratch/solo-balance-audit.json
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourceHashes = Object.fromEntries(['src/domain/minigame/solo-defense.ts', 'src/domain/minigame/solo-push.ts', '../game-server/engine.mjs'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const bundle = await build({ stdin: { contents: `export * from './src/domain/minigame/solo-defense.ts'; export * from './src/domain/minigame/solo-push.ts';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { newSoloDefense, buyFacility, startDefenseWave, advanceSoloDefense, defenseInput, newSoloPush, startSoloPush, advanceSoloPush, pushInput, pushSeriesPoints } = api;
const policies = ['idle', 'hold', 'pace', 'jump-spam', 'dash-spam', 'reactive'];
function input(policy, p, enemies, frame) {
  if (policy === 'idle') return { run: false };
  if (policy === 'hold') return { run: true };
  const run = p.x < .57 && p.energy > 22;
  if (policy === 'jump-spam') return { run, action: frame % 12 === 0 ? 'jump' : undefined };
  if (policy === 'dash-spam') return { run, action: frame % 12 === 0 ? 'dash' : undefined };
  if (policy === 'reactive') return { run, action: enemies.some(e => Math.abs(e.x - p.x) < .135) && p.cooldown <= 0 ? 'dash' : enemies.some(e => e.x > p.x && e.x - p.x < .09) && p.dash <= 0 ? 'jump' : undefined };
  return { run };
}
const builds = {
  'cannon-cannon-upgrades': [[[0, 'cannon'], [1, 'cannon']], [[0, 'cannon']], [[1, 'cannon']]],
  'cannon-fan-flag': [[[0, 'cannon'], [1, 'fan']], [[0, 'cannon']], [[2, 'flag']]],
  'cannon-flag-upgrades': [[[0, 'cannon'], [1, 'flag']], [[0, 'cannon']], [[1, 'flag']]],
  'three-cannons': [[[0, 'cannon'], [2, 'cannon']], [[1, 'cannon']], [[1, 'cannon']]],
  'front-cannon-fan': [[[1, 'cannon'], [2, 'fan']], [[1, 'cannon']], [[0, 'cannon']]],
};
const defense = [];
for (const [name, plan] of Object.entries(builds)) for (const policy of policies) {
  const s = newSoloDefense(), waves = [];
  for (let wave = 0; wave < 3; wave++) {
    for (const [slot, kind] of plan[wave]) if (!buyFacility(s, slot, kind)) throw new Error(`Illegal build: ${name}/${wave}`);
    const before = { ...s.totals }, falls = s.runner.falls;
    startDefenseWave(s);
    let empty = 0, tail = 0, longestEmpty = 0, streak = 0;
    for (let f = 0; f < 4000 && ['countdown', 'playing'].includes(s.phase); f++) {
      const { run, action } = input(policy, s.runner, s.enemies, f);
      defenseInput(s, run, action); advanceSoloDefense(s, 1 / 60, run);
      if (s.phase === 'playing') {
        if (!s.enemies.length) { empty += 1 / 60; streak += 1 / 60; longestEmpty = Math.max(longestEmpty, streak); tail = streak; }
        else { streak = 0; tail = 0; }
      }
    }
    waves.push({ wave: wave + 1, killed: s.totals.killed - before.killed, missed: s.totals.passed + s.totals.unresolved - before.passed - before.unresolved,
      falls: s.runner.falls - falls, supplies: s.totals.collected - before.collected, pushed: s.totals.pushed - before.pushed,
      noEnemiesSeconds: +empty.toFixed(1), longestEmptySeconds: +longestEmpty.toFixed(1), emptyTailSeconds: +tail.toFixed(1) });
  }
  defense.push({ build: name, policy, ...s.totals, falls: s.runner.falls, unusedBudget: s.budget, waves });
}
const push = [];
for (const policy of policies) {
  const s = newSoloPush();
  for (let round = 0; round < 2; round++) {
    startSoloPush(s);
    for (let f = 0; f < 5700 && s.phase === 'playing'; f++) {
      const p = s.game.players[0], bot = s.game.players[1];
      const { run, action } = input(policy, { ...p, cooldown: p.cooldownUntil - s.game.time, dash: p.dashUntil - s.game.time }, policy === 'reactive' ? [bot, ...s.game.hazards] : s.game.hazards, f);
      pushInput(s, run, action); advanceSoloPush(s, 1 / 60, run);
    }
  }
  push.push({ policy, seriesPoints: pushSeriesPoints(s.results, 'you'), rounds: s.results });
}
process.stdout.write(JSON.stringify({ sourceHashes, method: '5 legal fixed build plans x 6 scripted input policies; 60Hz; fixed course; no human participants; policies are probes, not optimal solvers', defense, push }, null, 2) + '\n');
