'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findReusablePr, REQUIRED } = require('./ci-reuse-pr.cjs');
const { assertDeliveryResults } = require('./ci-delivery-scope.cjs');
const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), tree = 'd'.repeat(40);
function fixture() {
  const run = { id: 42, event: 'pull_request', path: '.github/workflows/ci.yml', head_sha: b,
    head_repository: { full_name: 'owner/repo' }, status: 'completed', conclusion: 'success',
    updated_at: '2026-10-16T00:00:00Z' };
  const jobs = REQUIRED.map(name => ({ name, status: 'completed', conclusion: 'success' }));
  const runs = [run];
  const args = { eventName: 'push', event: { ref: 'refs/heads/main', after: c }, repo: 'owner/repo', sha: c,
    now: Date.parse('2026-10-16T01:00:00Z'),
    git: cmd => cmd[0] === 'show' ? `${a} ${b}` : cmd[0] === 'merge-base' ? '' : tree,
    api: endpoint => endpoint.includes('/jobs?') ? { total_count: jobs.length, jobs } : { workflow_runs: runs },
  };
  return { args, run, jobs, runs };
}
test('reuses all completed PR gates only for an identical recently tested merge tree', () => {
  assert.deepEqual(findReusablePr(fixture().args), { full: false, reason: 'verified_pr_tree_reused',
    reused: true, reuse_run: '42', reuse_tree: tree });
});
test('direct push, different tree, base movement and explicit full run do not reuse', () => {
  for (const change of [
    f => { f.args.eventName = 'workflow_dispatch'; },
    f => { f.args.event.ref = 'refs/heads/other'; },
    f => { f.args.event.after = a; },
    f => { f.args.git = () => a; },
    f => { const git = f.args.git; f.args.git = cmd => cmd[0] === 'rev-parse' && cmd[1].startsWith(b) ? a : git(cmd); },
    f => { const git = f.args.git; f.args.git = cmd => { if (cmd[0] === 'merge-base') throw Error('not ancestor'); return git(cmd); }; },
    f => { f.args.api = () => { throw Error('unavailable'); }; },
  ]) { const f = fixture(); change(f); assert.equal(findReusablePr(f.args), null); }
});
test('rejects failed, cancelled, stale, foreign or incomplete evidence', () => {
  for (const change of [
    f => { f.run.conclusion = 'failure'; }, f => { f.run.conclusion = 'cancelled'; },
    f => { f.run.status = 'in_progress'; }, f => { f.run.head_sha = a; },
    f => { f.run.event = 'push'; }, f => { f.run.path = '.github/workflows/other.yml'; },
    f => { f.run.head_repository.full_name = 'fork/repo'; },
    f => { f.run.updated_at = '2026-10-14T00:00:00Z'; },
    f => { f.run.updated_at = '2026-10-17T00:00:00Z'; },
    f => { f.runs.unshift({ ...f.run, id: 43, conclusion: 'failure' }); },
    f => { f.jobs.pop(); }, f => { f.jobs.push({ ...f.jobs[0] }); },
    f => { f.args.api = endpoint => endpoint.includes('/jobs?') ? { total_count: 101, jobs: f.jobs } : { workflow_runs: f.runs }; },
  ]) { const f = fixture(); change(f); assert.equal(findReusablePr(f.args), null); }
  for (const name of REQUIRED) for (const state of ['failure', 'cancelled', 'skipped']) {
    const f = fixture(); f.jobs.find(j => j.name === name).conclusion = state;
    assert.equal(findReusablePr(f.args), null, `${name}:${state}`);
  }
});
test('delivery receipt distinguishes reuse from new execution and rejects missing evidence', () => {
  const needs = { 'delivery-scope': { result: 'success', outputs: {
    full: 'false', reused: 'true', reuse_run: '42', reuse_tree: tree,
  } }, test: { result: 'skipped' } };
  assert.equal(assertDeliveryResults(needs), 'VERIFIED_PR_TREE_REUSED:42');
  for (const key of ['reuse_run', 'reuse_tree']) {
    const copy = structuredClone(needs); delete copy['delivery-scope'].outputs[key];
    assert.throws(() => assertDeliveryResults(copy), /REUSE_EVIDENCE_MISSING/);
  }
});
