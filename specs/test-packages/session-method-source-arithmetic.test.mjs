import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Research-only helpers: no application import, persistence, or approval issuer.
const report = readFileSync(new URL('../../reports/research/SESSION_METHOD_SOURCE_GAP_FOLLOWUP_2026-09-06.md', import.meta.url), 'utf8');
const blocks = [...report.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)];
assert.equal(blocks.length, 1, 'one auditable research fixture block');
const fixture = JSON.parse(blocks[0][1]);
const mutation = process.env.SOURCE_ARITHMETIC_MUTATION;

function positive(value) {
  assert.equal(typeof value, 'number');
  assert.ok(Number.isFinite(value) && value > 0, 'finite positive number');
  return value;
}

function count(value) {
  positive(value);
  assert.ok(Number.isSafeInteger(value), 'integer count');
  return value;
}

function scaleMeasuredSpeed(anchor, fraction) {
  assert.equal(anchor.kind, 'MEASURED_VVO2MAX', 'no implicit race/MAS/VDOT conversion');
  assert.equal(anchor.unit, 'm/s', 'speed units must be explicit');
  return positive(anchor.value) * (mutation === 'E03_FACTOR' ? 1 : positive(fraction));
}

function groupedRollOn({ sets, reps, workM, rollOnM, betweenSeconds, assumptionRef }) {
  count(sets); count(reps); positive(workM); positive(rollOnM);
  assert.equal(assumptionRef, 'E08_CARRY_120', 'conditional comparison requires an assumption');
  positive(betweenSeconds);
  const sequence = [];
  for (let set = 0; set < sets; set++) {
    for (let rep = 0; rep < reps; rep++) {
      sequence.push({ role: 'WORK', unit: 'm', value: workM });
      if (mutation !== 'E08_TERMINAL' || rep < reps - 1) {
        sequence.push({ role: 'ROLL_ON', unit: 'm', value: rollOnM });
      }
    }
    if (set < sets - 1) sequence.push({ role: 'BETWEEN_SET', unit: 's', value: betweenSeconds });
  }
  return sequence;
}

function sum(sequence, role, unit) {
  return sequence.filter(segment => segment.role === role).reduce((total, segment) => {
    assert.equal(segment.unit, unit, 'do not add seconds to metres');
    return total + positive(segment.value);
  }, 0);
}

function inclinePercent(incline) {
  positive(incline.value);
  if (incline.unit === 'percent') return incline.value;
  assert.equal(incline.unit, 'degree');
  assert.ok(incline.value < 90);
  return mutation === 'E09_DEGREES' ? incline.value : 100 * Math.tan(incline.value * Math.PI / 180);
}

function timedSequence({ reps, workSeconds, betweenSeconds, cooldownSeconds, warmupSeconds }) {
  count(reps);
  [workSeconds, betweenSeconds, cooldownSeconds, warmupSeconds].forEach(positive);
  const sequence = [{ role: 'WARMUP', unit: 's', value: warmupSeconds }];
  for (let rep = 0; rep < reps; rep++) {
    sequence.push({ role: 'WORK', unit: 's', value: workSeconds });
    if (rep < reps - 1) sequence.push({ role: 'BETWEEN_REP', unit: 's', value: betweenSeconds });
  }
  sequence.push({ role: mutation === 'E09_COOLDOWN' ? 'BETWEEN_REP' : 'COOLDOWN', unit: 's', value: cooldownSeconds });
  return sequence;
}

// Validates a research receipt; deliberately does not implement a D9 evaluator.
function validateSupportReceipt(input, receipt) {
  assert.equal(input.context.role, 'RESEARCH_ONLY');
  assert.equal(receipt.supportRef, input.supportRef);
  assert.equal(receipt.safetyStatus, input.safetyStatus, 'research cannot change safety state');
  assert.equal(receipt.contextRole, input.context.role);
  assert.deepEqual(receipt.sourceRefs, [input.context.sourceRef]);
  if (mutation !== 'E10_AUTHORITY') {
    assert.equal(receipt.exercise, null);
    assert.equal(receipt.numericRecovery, null);
    assert.equal(receipt.clearance, null);
    assert.equal(receipt.canStartBlockedPlan, false);
  }
  return receipt;
}

test('E03 measured-speed arithmetic and model boundary', () => {
  const f = fixture.E03;
  assert.equal(scaleMeasuredSpeed(f.anchor, f.workFraction), 4.75);
  assert.equal(scaleMeasuredSpeed(f.anchor, f.recoveryFraction), 2.5);
  assert.ok(Math.abs(scaleMeasuredSpeed({ ...f.anchor, value: 6 }, f.workFraction) - 5.7) < 1e-12);
  for (const kind of ['CURRENT_5000_RACE_SPEED', 'MAS_REGRESSION', 'VDOT_I']) {
    assert.throws(() => scaleMeasuredSpeed({ ...f.anchor, kind }, f.workFraction));
  }
  assert.throws(() => scaleMeasuredSpeed({ ...f.anchor, unit: 'km/h' }, f.workFraction));
  for (const value of [null, 0, -1, NaN, Infinity, '5']) {
    assert.throws(() => scaleMeasuredSpeed({ ...f.anchor, value }, f.workFraction));
  }
});

test('E08 ordered grouping preserves every terminal roll-on', () => {
  const f = fixture.E08;
  const build = (sets, reps, extra = {}) => groupedRollOn({
    sets, reps, workM: f.workM, rollOnM: f.rollOnM,
    betweenSeconds: f.assumedBetweenSetSeconds, assumptionRef: f.assumptionRef, ...extra,
  });
  const sequences = f.groupings.map(([sets, reps]) => build(sets, reps));
  for (const sequence of sequences) {
    assert.equal(sum(sequence, 'WORK', 'm'), 1800);
    assert.equal(sum(sequence, 'ROLL_ON', 'm'), 600);
    assert.equal(sequence.at(-1).role, 'ROLL_ON');
    sequence.forEach((segment, index) => {
      if (segment.role === 'BETWEEN_SET') assert.equal(sequence[index - 1].role, 'ROLL_ON');
    });
  }
  assert.deepEqual(sequences.map(s => sum(s, 'BETWEEN_SET', 's')), [240, 120]);
  assert.notDeepEqual(sequences[0], sequences[1]);
  assert.equal(sum(build(1, 1), 'BETWEEN_SET', 's'), 0);
  assert.equal(sum(build(1, 1), 'ROLL_ON', 'm'), 100);
  assert.throws(() => build(2, 3, { betweenSeconds: null }));
  assert.throws(() => build(2, 3, { assumptionRef: null }));
  assert.throws(() => sum(sequences[0], 'ROLL_ON', 's'));
});

test('E09 incline units are converted not relabelled', () => {
  assert.ok(Math.abs(inclinePercent(fixture.E09.incline) - 5.24077792830412) < 1e-12);
  assert.equal(inclinePercent({ value: 3, unit: 'percent' }), 3);
  assert.ok(Math.abs(inclinePercent({ value: 45, unit: 'degree' }) - 100) < 1e-10);
  assert.throws(() => inclinePercent({ value: 3, unit: 'unknown' }));
});

test('E09 between recovery and final cooldown retain distinct roles', () => {
  const sequence = timedSequence(fixture.E09);
  assert.equal(sum(sequence, 'WORK', 's'), 960);
  assert.equal(sum(sequence, 'BETWEEN_REP', 's'), 540);
  assert.equal(sum(sequence, 'COOLDOWN', 's'), 180);
  assert.equal(sequence.reduce((total, segment) => total + segment.value, 0), 2280);
  const single = timedSequence({ ...fixture.E09, reps: 1 });
  assert.equal(sum(single, 'BETWEEN_REP', 's'), 0);
  assert.equal(sum(single, 'COOLDOWN', 's'), 180);
  assert.throws(() => timedSequence({ ...fixture.E09, cooldownSeconds: null }));
});

test('E10 research receipt rejects invented recovery and authority', () => {
  for (const safetyStatus of fixture.E10.safetyStates) {
    const input = { ...fixture.E10, safetyStatus };
    const receipt = {
      supportRef: input.supportRef, safetyStatus, contextRole: input.context.role,
      sourceRefs: [input.context.sourceRef], exercise: null, numericRecovery: null,
      clearance: null, canStartBlockedPlan: false,
    };
    assert.deepEqual(validateSupportReceipt(input, structuredClone(receipt)), receipt);
    for (const patch of [
      { exercise: { kind: 'WALK', seconds: 840 } },
      { numericRecovery: { seconds: 840 } },
      { clearance: { sourceRef: input.context.sourceRef } },
      { canStartBlockedPlan: true },
      { safetyStatus: 'CLEARED' },
    ]) assert.throws(() => validateSupportReceipt(input, { ...receipt, ...patch }));
  }
});

test('research mutation checks fail the named test for each injected defect', { skip: Boolean(mutation) }, () => {
  const cases = [
    ['E03_FACTOR', 'E03 measured-speed arithmetic and model boundary'],
    ['E08_TERMINAL', 'E08 ordered grouping preserves every terminal roll-on'],
    ['E09_DEGREES', 'E09 incline units are converted not relabelled'],
    ['E09_COOLDOWN', 'E09 between recovery and final cooldown retain distinct roles'],
    ['E10_AUTHORITY', 'E10 research receipt rejects invented recovery and authority'],
  ];
  for (const [defect, name] of cases) {
    // A child must start its own runner, not inherit the parent's test-worker IPC context.
    const env = { ...process.env, SOURCE_ARITHMETIC_MUTATION: defect };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', fileURLToPath(import.meta.url)], {
      env, encoding: 'utf8', timeout: 15000,
    });
    assert.ifError(run.error);
    assert.equal(run.status, 1, `${defect} must fail assertions, not crash or pass`);
    assert.ok(run.stdout.split('\n').some(line => /^not ok \d+ - /.test(line) && line.endsWith(name)),
      `${defect} did not fail named test: ${name}\n${run.stdout}\n${run.stderr}`);
    console.log(`MUTATION_KILLED ${defect}: ${name}`);
  }
});
