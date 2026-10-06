import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Pass the read-only AthleteTime checkout path.');
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const sourcePath = path.join(sourceRoot, 'frontend/src/pages/PaceCalculatorPage/utils/paceCalculations.ts');
const source = await import(pathToFileURL(sourcePath).href);
const canonical = await import(pathToFileURL(path.join(root, 'impl/src/prescription/record-pace.ts')).href);
const sourceBytes = await readFile(sourcePath);
const checks = [];
const findings = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', detail: error.message }); }
}
function observe(name, actual, expected, tolerance = 1e-9, classification = 'SOURCE_DEFECT') {
  const equal = typeof actual === 'number' && typeof expected === 'number'
    ? Math.abs(actual - expected) <= tolerance : actual === expected;
  findings.push({ name, actual, expected, classification, status: equal ? 'NO_DISCREPANCY' : 'DISCREPANCY_REPRODUCED' });
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

// Synthetic values only; no user records, account calls, or runtime writes.
const events = [800, 1500, 3000, 5000, 10000, 21097.5, 42195];
const records = [121.5, 128, 240, 1200, 2400, 5400, 14400];
const segments = [60, 100, 200, 300, 400, 800, 1000];
for (const meters of events) for (const seconds of records) for (const segment of segments) {
  check(`direct arithmetic ${meters}/${seconds}/${segment}`, () => {
    const pace = source.calculatePaceFromTarget(seconds, meters);
    const actual = source.calculateFinishTime(pace, segment);
    near(actual, seconds * segment / meters);
    near(actual, canonical.raceAverageSeconds(seconds, meters, segment));
  });
}
for (const distance of [0.1, 0.8, 1.5, 5, 10, 21.0975, 42.195]) {
  check(`even splits conserve distance/time ${distance}`, () => {
    const splits = source.calculateSplits(distance, 5400, 'even');
    near(splits.at(-1).cumulativeDistance, distance);
    near(splits.reduce((sum, row) => sum + row.lapTime, 0), 5400);
    assert.ok(splits.every(row => row.lapTime > 0));
  });
}
for (const event of [800, 1500]) check(`track splits conserve ${event}`, () => {
  const splits = source.calculateTrackSplits(event, 121.5);
  near(splits.at(-1).cumulativeDistance, event);
  near(splits.at(-1).cumulativeTime, 121.5);
});
for (const variant of ['INSIDE', 'OUTSIDE']) check(`SC arithmetic conserves ${variant}`, () => {
  const splits = source.calculateSteepleSplits(570, variant);
  near(splits.at(-1).cumulativeDistance, 3000);
  near(splits.at(-1).cumulativeTime, 570);
});
for (let lane = 1; lane <= 8; lane++) check(`lane section conservation ${lane}`, () => {
  const lanes = source.calculateAllLanesData(60, lane);
  const selected = lanes.find(row => row.isSelected);
  near(selected.adjustedTime, 60);
  near(Object.values(selected.sectionDistances).reduce((sum, n) => sum + n, 0), selected.distance);
  near(Object.values(selected.sectionTimes).reduce((sum, n) => sum + n, 0), 60);
  assert.ok(lanes.every((row, i) => i === 0 || row.distance > lanes[i - 1].distance));
});
check('canonical fractional 800m reference', () => near(canonical.raceAverageSeconds(121.5, 800, 200), 30.375));
check('canonical decimal carry', () => assert.equal(canonical.formatPaceSeconds(59.999, 1), '1분 0초'));
check('canonical half compatibility', () => near(canonical.raceAverageSeconds(5400, 21097, 1000), canonical.raceAverageSeconds(5400, 21097.5, 1000)));
for (const value of [NaN, Infinity, -1, 0]) check(`canonical rejects source ${String(value)}`, () => {
  assert.equal(canonical.raceAverageSeconds(value, 800, 200), null);
});
check('canonical blocks under-60m conversion', () => assert.equal(canonical.raceAverageSeconds(128, 800, 50), null));

for (const strategy of ['negative', 'positive']) for (const [distance, target] of [[10, 2400], [21.0975, 5400], [42.195, 14400], [0.8, 128]]) {
  const splits = source.calculateSplits(distance, target, strategy);
  observe(`${strategy} final time ${distance}km`, splits.at(-1).cumulativeTime, target);
}
observe('track formatter decimal carry', source.formatSplitTime(59.999), '1:00.0');
observe('general formatter decimal carry', source.formatTime(59.999), '1:00.0');
observe('km display differs from TrainOracle rounding policy', source.formatPace(239.9), '4:00', 1e-9, 'TARGET_POLICY_DIFFERENCE');
observe('zero source distance yields non-finite output', Number.isFinite(source.calculatePaceFromTarget(1200, 0)), true, 1e-9, 'REUSE_BOUNDARY_RISK');
observe('negative source time lacks rejection', source.calculatePaceFromTarget(-1200, 5000), null, 1e-9, 'REUSE_BOUNDARY_RISK');
observe('invalid lane lacks rejection', source.calculateLaneDistance(0), null, 1e-9, 'REUSE_BOUNDARY_RISK');
// Verify a suspected constant mismatch rather than assuming it is a defect.
observe('lane 3 constant agrees at 2 decimals', source.LANE_DISTANCES[3].toFixed(2), source.calculateLaneDistance(3).toFixed(2));

// Repair design only: length-weighted normalization is not an adopted race tactic.
function normalizedSplits(distanceKm, seconds, strategy) {
  const count = Math.ceil(distanceKm);
  const segments = Array.from({ length: count }, (_, index) => {
    const start = index, end = Math.min(index + 1, distanceKm), length = end - start;
    const progress = ((start + end) / 2) / distanceKm;
    const weight = strategy === 'even' ? 1 : strategy === 'negative' ? 1.01 - 0.02 * progress : 0.99 + 0.02 * progress;
    return { length, weight };
  });
  const total = segments.reduce((sum, row) => sum + row.length * row.weight, 0);
  return segments.map(row => ({ distanceKm: row.length, seconds: seconds * row.length * row.weight / total }));
}
for (const strategy of ['even', 'negative', 'positive']) for (const distance of [0.8, 1.5, 5, 10, 21.0975, 42.195]) {
  check(`repair design normalized conservation ${strategy}/${distance}`, () => {
    const rows = normalizedSplits(distance, 5400, strategy);
    near(rows.reduce((sum, row) => sum + row.distanceKm, 0), distance);
    near(rows.reduce((sum, row) => sum + row.seconds, 0), 5400);
    assert.ok(rows.every(row => row.seconds > 0));
  });
}

const result = {
  status: checks.some(row => row.status === 'FAIL') ? 'AUDIT_HARNESS_FAILED' : 'AUDIT_COMPLETED_SOURCE_DEFECTS_FOUND',
  checkedAt: new Date().toISOString(),
  inputScope: 'SYNTHETIC_ONLY',
  sourceRoot,
  sourceFileSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  sourceEdited: false,
  runtimeIntegrated: false,
  passed: checks.filter(row => row.status === 'PASS').length,
  failed: checks.filter(row => row.status === 'FAIL').length,
  observationsWithDiscrepancy: findings.filter(row => row.status === 'DISCREPANCY_REPRODUCED').length,
  sourceDefectCases: findings.filter(row => row.status === 'DISCREPANCY_REPRODUCED' && row.classification === 'SOURCE_DEFECT').length,
  targetPolicyDifferences: findings.filter(row => row.status === 'DISCREPANCY_REPRODUCED' && row.classification === 'TARGET_POLICY_DIFFERENCE').length,
  reuseBoundaryRisks: findings.filter(row => row.status === 'DISCREPANCY_REPRODUCED' && row.classification === 'REUSE_BOUNDARY_RISK').length,
  checks, findings,
  repairDesign: 'Not production code; normalization conservation only, no scientific strategy adoption.',
};
await writeFile(new URL('./athletetime-pace-audit-20261005.results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, checks: undefined }, null, 2));
if (result.failed) process.exitCode = 1;
