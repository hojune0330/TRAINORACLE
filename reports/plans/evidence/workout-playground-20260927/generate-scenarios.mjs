import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Planning prompts only. This script never imports or executes the application.
const seed = 20260927;
let state = seed >>> 0;
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 4294967296;
}
const profiles = [
  ['P01', 'first-time marathon; no record; guest'],
  ['P02', 'experienced 5km; current fractional-second record'],
  ['P03', 'youth 800m; self-directed; current record'],
  ['P04', 'youth 1500m; coach-required authorization'],
  ['P05', 'university athlete; two sessions; editing PM'],
  ['P06', 'working runner; explicit total-time cap'],
  ['P07', 'returning runner; only an old personal best'],
  ['P08', 'new pain signal during editing'],
  ['P09', 'beginner; knows elapsed time but not distance'],
  ['P10', 'track runner; distance-based repetitions'],
  ['P11', 'road runner; no measured track'],
  ['P12', 'treadmill user; speed units differ from pace'],
  ['P13', 'elite marathon runner; short high-output work'],
  ['P14', 'MIX workout; distance-defined active recovery'],
  ['P15', 'near competition; phase changes while editing'],
  ['P16', 'repetitive tapping; tries every increase button'],
  ['P17', 'one-handed; small screen; accidental double tap'],
  ['P18', 'screen reader and keyboard; no swipe'],
  ['P19', '200 percent text; reduced motion'],
  ['P20', 'offline account; second device changes plan'],
  ['P21', 'account switch; pending save response'],
  ['P22', 'already started or journal-linked session'],
  ['P23', 'one eligible method; exploration exhausts pool'],
  ['P24', 'repeated cycle; deliberately wants same workout'],
];
const actions = [
  'OTHER', 'REPS_UP', 'REPS_DOWN', 'DISTANCE_UP', 'DISTANCE_DOWN',
  'TIME_UP', 'TIME_DOWN', 'EASIER', 'PACE_FASTER', 'MORE_REST',
  'LESS_REST', 'SPLIT_SETS', 'UNDO', 'REDO', 'RESET', 'OPEN_REASON',
  'CLOSE_REASON', 'BACK', 'REOPEN', 'APPLY', 'DOUBLE_APPLY',
  'ACK_LOST', 'OFFLINE', 'ONLINE', 'RECORD_CHANGED', 'DATE_CHANGED',
  'ACCOUNT_CHANGED', 'SAFETY_CHANGED', 'DELETE_PLAN', 'LOG_RESULT',
  'START_SESSION', 'RULE_REVOKED',
];
const scenarios = profiles.flatMap(([persona, context]) => Array.from({ length: 4 }, (_, index) => ({
  id: `${persona}-${index + 1}`,
  persona,
  context,
  initial: 'open current workout; request preview only',
  actions: Array.from({ length: 8 }, () => actions[Math.floor(random() * actions.length)]),
  reviewStatus: 'DESK_REVIEW_INPUT_NOT_EXECUTED_APP_TEST',
})));
const actionCounts = Object.fromEntries(actions.map(action => [action,
  scenarios.reduce((sum, item) => sum + item.actions.filter(value => value === action).length, 0),
]));
assert.equal(new Set(scenarios.map(item => item.id)).size, 96);
assert.equal(profiles.length, 24);
assert.ok(Object.values(actionCounts).every(count => count > 0));
const result = {
  kind: 'SYNTHETIC_PLANNING_SCENARIOS',
  seed,
  algorithm: 'LCG32: state = (1664525 * state + 1013904223) modulo 2^32',
  generatorSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  independentAgents: 0,
  realParticipants: 0,
  appTestsExecuted: 0,
  scientificDoseChecksExecuted: 0,
  verdict: 'NO_PRODUCT_PASS_FAIL_CLAIM',
  coverage: { personas: profiles.length, traces: scenarios.length, steps: scenarios.length * 8, actionCounts },
  scenarios,
};
const output = new URL('./scenarios.json', import.meta.url);
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output: fileURLToPath(output), coverage: result.coverage, verdict: result.verdict }));
for (const item of scenarios) console.log(`${item.id}: ${item.actions.join(' > ')}`);
