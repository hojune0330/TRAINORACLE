'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyPaths, detectScope, assertDeliveryResults } = require('./ci-delivery-scope.cjs');
test('only an explicit allowlist of operator notes can omit runtime work', () => {
  assert.equal(classifyPaths(['AGENTS.md', 'docs/delivery/README.md']).full, false);
  for (const path of ['backend/policies/privacy.md', 'docs/policy.md', 'specs/active/contract.md',
    '.github/workflows/ci.yml', 'package-lock.json', 'src/a.ts', 'docs/delivery/a.json',
    'docs/delivery/../secret.md', 'new-file', '', 'README.md\napp/code.js']) {
    assert.equal(classifyPaths(['AGENTS.md', path]).full, true, path);
  }
  assert.equal(classifyPaths([]).full, true);
});

test('delivery gate rejects failures, cancellations and unproved skipped checks', () => {
  const complete = full => ({ 'delivery-scope': { result: 'success', outputs: { full } }, test: { result: full === 'true' ? 'success' : 'skipped' } });
  assert.equal(assertDeliveryResults(complete('true')), 'FULL_CHECKS_PASSED');
  assert.equal(assertDeliveryResults(complete('false')), 'OPERATOR_NOTES_ONLY_NO_RUNTIME_CHECKS');
  for (const full of ['true', 'false']) {
    for (const result of ['failure', 'cancelled', '', 'in_progress', full === 'true' ? 'skipped' : 'success']) {
      assert.throws(() => assertDeliveryResults({ ...complete(full), test: { result } }));
    }
    for (const result of ['failure', 'cancelled', 'skipped', '']) {
      assert.throws(() => assertDeliveryResults({ ...complete(full), 'delivery-scope': { result, outputs: { full } } }));
    }
  }
  assert.throws(() => assertDeliveryResults({ 'delivery-scope': { result: 'success', outputs: { full: 'false' } } }));
});
test('unknown events, revisions and unavailable Git diffs fall back to full checks', () => {
  assert.equal(detectScope('workflow_dispatch', {}).full, true);
  assert.equal(detectScope('push', {}).full, true);
  assert.equal(detectScope('push', { before: '0'.repeat(40), after: 'a'.repeat(40) }).full, true);
  assert.equal(detectScope('push', { before: 'a'.repeat(40), after: 'b'.repeat(40) }, () => { throw Error('missing history'); }).full, true);
});
test('PR comparison uses merge base and includes both sides of renamed paths', () => {
  const commands = [];
  const git = args => { commands.push(args); return args[0] === 'merge-base' ? 'c'.repeat(40) : 'src/runtime.js\0docs/delivery/moved.md\0'; };
  assert.equal(detectScope('pull_request', { pull_request: { base: { sha: 'a'.repeat(40) }, head: { sha: 'b'.repeat(40) } } }, git).full, true);
  assert.deepEqual(commands[1], ['diff', '--name-only', '--no-renames', '-z', 'c'.repeat(40), 'b'.repeat(40), '--']);
  assert.equal(detectScope('push', { before: 'a'.repeat(40), after: 'b'.repeat(40) }, () => 'docs/delivery/README.md\0').full, false);
});
