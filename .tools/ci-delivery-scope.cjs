'use strict';
const { execFileSync } = require('node:child_process');
const { readFileSync, appendFileSync } = require('node:fs');
const SHA = /^[a-f0-9]{40}$/;
function classifyPaths(paths) {
  // Only non-runtime operator notes qualify. Policies, source fixtures, assets,
  // manifests, workflows and unknown paths always keep the complete checks.
  const note = path => path === 'AGENTS.md' || path === 'README.md'
    || /^docs\/delivery\/[^\r\n]+\.md$/.test(path)
    || /^reports\/operations\/DELIVERY_[^/\r\n]+\.md$/.test(path);
  return paths.length > 0 && paths.every(path => typeof path === 'string' && !path.includes('..') && note(path))
    ? { full: false, reason: 'operator_notes_only' }
    : { full: true, reason: 'runtime_or_unknown_paths' };
}
function detectScope(eventName, event, git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) {
  if (!['pull_request', 'push'].includes(eventName)) return { full: true, reason: 'explicit_full_run' };
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before;
  const head = eventName === 'pull_request' ? event.pull_request?.head?.sha : event.after;
  if (![base, head].every(value => SHA.test(value || '') && !/^0+$/.test(value))) return { full: true, reason: 'unknown_revision' };
  try {
    const comparison = eventName === 'pull_request' ? git(['merge-base', base, head]).trim() : base;
    if (!SHA.test(comparison)) throw Error('unknown base');
    return classifyPaths(git(['diff', '--name-only', '--no-renames', '-z', comparison, head, '--']).split('\0').filter(Boolean));
  } catch { return { full: true, reason: 'diff_unavailable' }; }
}
function assertDeliveryResults(needs) {
  const scope = needs?.['delivery-scope'];
  if (scope?.result !== 'success' || !['true', 'false'].includes(scope.outputs?.full)) throw Error('SCOPE_NOT_VERIFIED');
  const entries = Object.entries(needs).filter(([name]) => name !== 'delivery-scope');
  if (!entries.length) throw Error('CHECK_INVENTORY_EMPTY');
  for (const [name, job] of entries) {
    const expected = scope.outputs.full === 'true' || name === 'identity-git-boundary' ? 'success' : 'skipped';
    if (job.result !== expected) throw Error('CHECK_INCOMPLETE:' + name);
  }
  return scope.outputs.full === 'true' ? 'FULL_CHECKS_PASSED' : 'OPERATOR_NOTES_ONLY_NO_RUNTIME_CHECKS';
}
module.exports = { classifyPaths, detectScope, assertDeliveryResults };
if (require.main === module) {
  let result;
  try { result = detectScope(process.env.GITHUB_EVENT_NAME, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))); }
  catch { result = { full: true, reason: 'event_unavailable' }; }
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${result.full}\nreason=${result.reason}\n`);
}
