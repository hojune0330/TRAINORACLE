'use strict';
const { execFileSync } = require('node:child_process');
const SHA = /^[a-f0-9]{40}$/;
const REQUIRED = [
  'delivery-scope', 'contract-tests', 'app-quality',
  'app-unit (UTC, UTC, test:unit)', 'app-unit (KST, Asia/Seoul, test:unit:kst)',
  ...['desktop-chromium', 'mobile-chromium', 'touch-narrow', 'reduced-motion'].flatMap(p =>
    ['built-preview', 'browser-fixtures'].map(lane => `app-browser-generic (${p}, ${lane})`)),
  'app-browser-dedicated', 'app-browser', 'delivery-complete',
];

// Reuse only the just-tested, identical merge tree, never an arbitrary green SHA.
// Direct pushes, squash/rebase merges and unavailable evidence retain full checks.
function findReusablePr({ eventName, event, repo, sha, now = Date.now(), git, api }) {
  if (eventName !== 'push' || event.ref !== 'refs/heads/main' || event.after !== sha
    || !SHA.test(sha || '') || !/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return null;
  try {
    const parents = git(['show', '-s', '--format=%P', sha]).trim().split(' ');
    if (parents.length !== 2 || !parents.every(p => SHA.test(p))) return null;
    git(['merge-base', '--is-ancestor', parents[0], parents[1]]);
    const tree = git(['rev-parse', `${sha}^{tree}`]).trim();
    if (!SHA.test(tree) || git(['rev-parse', `${parents[1]}^{tree}`]).trim() !== tree) return null;
    const runs = api(`repos/${repo}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${parents[1]}&per_page=20`).workflow_runs;
    // Do not resurrect an older success if the latest run failed or was cancelled.
    const run = runs?.filter(r => r.head_sha === parents[1]).sort((a, b) => b.id - a.id)[0];
    const age = now - Date.parse(run?.updated_at);
    if (!run || run.event !== 'pull_request' || run.path !== '.github/workflows/ci.yml'
      || run.head_repository?.full_name !== repo || run.status !== 'completed'
      || run.conclusion !== 'success' || !Number.isFinite(age) || age < 0 || age > 86400000
      || !Number.isSafeInteger(run.id) || run.id <= 0) return null;
    const inventory = api(`repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    if (!Array.isArray(inventory.jobs) || inventory.total_count !== inventory.jobs.length) return null;
    if (!REQUIRED.every(name => {
      const jobs = inventory.jobs.filter(j => j.name === name);
      return jobs.length === 1 && jobs[0].status === 'completed' && jobs[0].conclusion === 'success';
    })) return null;
    return { full: false, reason: 'verified_pr_tree_reused', reused: true, reuse_run: String(run.id), reuse_tree: tree };
  } catch { return null; }
}

function liveReuse(eventName, event) {
  return findReusablePr({ eventName, event, repo: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA,
    git: args => execFileSync('git', args, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }),
    api: endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], {
      encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
    })),
  });
}
module.exports = { findReusablePr, liveReuse, REQUIRED };
