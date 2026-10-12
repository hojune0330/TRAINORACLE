import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import test from 'node:test';
import { gitAt } from './pages-release-safety.mjs';
import { acquireManualReleaseLock } from './manual-release-lock.mjs';

const TEMP_PREFIX = 'trainoracle-manual-release-lock-test-';
const LOCK_FILENAME = 'trainoracle-manual-release.lock';

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
  const absoluteRoot = resolve(root);
  t.after(() => {
    if (dirname(absoluteRoot) !== resolve(tmpdir()) || !basename(absoluteRoot).startsWith(TEMP_PREFIX)) {
      throw Error('TEST_CLEANUP_OUTSIDE_TEMP');
    }
    rmSync(absoluteRoot, { recursive: true, force: true });
  });
  return root;
}

function syntheticRepo(t) {
  const root = tempRoot(t);
  const repo = join(root, 'repo');
  mkdirSync(repo);
  execFileSync('git', ['init', '--quiet', repo], { stdio: 'pipe' });
  gitAt(repo, 'config', 'user.name', 'Synthetic Release Lock Test');
  gitAt(repo, 'config', 'user.email', 'release-lock@example.invalid');
  writeFileSync(join(repo, 'fixture.txt'), 'synthetic-only\n');
  gitAt(repo, 'add', '--all');
  gitAt(repo, 'commit', '--quiet', '-m', 'synthetic fixture');
  return { root, repo };
}

function lockPath(repo) {
  const commonDirectory = gitAt(repo, 'rev-parse', '--git-common-dir');
  return join(isAbsolute(commonDirectory) ? resolve(commonDirectory) : resolve(repo, commonDirectory), LOCK_FILENAME);
}

function assertBusy(repo, operation = 'publish') {
  const expectedPath = lockPath(repo);
  assert.throws(() => acquireManualReleaseLock(repo, operation), error =>
    error.code === 'MANUAL_RELEASE_BUSY'
      && error.lockPath === expectedPath
      && error.message.includes(expectedPath));
}

test('one repository excludes a second manual build or publish and stores only lease metadata', t => {
  const { repo } = syntheticRepo(t);
  const release = acquireManualReleaseLock(repo, 'build');
  const path = lockPath(repo);
  try {
    const metadata = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(Object.keys(metadata).sort(), ['host', 'operation', 'ownerToken', 'pid', 'startedAt']);
    assert.match(metadata.ownerToken, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
    assert.equal(metadata.operation, 'build');
    assert.equal(metadata.pid, process.pid);
    assert.equal(typeof metadata.host, 'string');
    assert.ok(Number.isFinite(Date.parse(metadata.startedAt)));
    assertBusy(repo, 'build');
    assertBusy(repo, 'publish');
  } finally {
    release();
  }
});

test('a linked worktree contends through the shared Git common directory', t => {
  const { root, repo } = syntheticRepo(t);
  const linked = join(root, 'linked-worktree');
  gitAt(repo, 'worktree', 'add', '--detach', linked, 'HEAD');
  assert.equal(lockPath(repo), lockPath(linked));
  const release = acquireManualReleaseLock(repo, 'build');
  try {
    assertBusy(linked, 'publish');
  } finally {
    release();
  }
});

test('different synthetic repositories can hold independent locks simultaneously', t => {
  const first = syntheticRepo(t);
  const second = syntheticRepo(t);
  assert.notEqual(lockPath(first.repo), lockPath(second.repo));
  const releaseFirst = acquireManualReleaseLock(first.repo, 'build');
  let releaseSecond;
  try {
    releaseSecond = acquireManualReleaseLock(second.repo, 'publish');
    assert.ok(existsSync(lockPath(first.repo)));
    assert.ok(existsSync(lockPath(second.repo)));
  } finally {
    releaseSecond?.();
    releaseFirst();
  }
});

test('release is idempotent and permits a later acquisition', t => {
  const { repo } = syntheticRepo(t);
  const path = lockPath(repo);
  const release = acquireManualReleaseLock(repo, 'publish');
  release();
  release();
  assert.equal(existsSync(path), false);
  const releaseAgain = acquireManualReleaseLock(repo, 'build');
  releaseAgain();
  assert.equal(existsSync(path), false);
});

test('stale and invalid existing locks are reported busy and left byte-for-byte intact', t => {
  const staleRepo = syntheticRepo(t).repo;
  const stalePath = lockPath(staleRepo);
  const staleText = `${JSON.stringify({ ownerToken: 'old-owner', pid: 1, host: 'old-host',
    operation: 'build', startedAt: '2000-01-01T00:00:00.000Z' })}\n`;
  writeFileSync(stalePath, staleText);
  assertBusy(staleRepo, 'publish');
  assert.equal(readFileSync(stalePath, 'utf8'), staleText);

  const invalidRepo = syntheticRepo(t).repo;
  const invalidPath = lockPath(invalidRepo);
  const invalidText = '{ invalid metadata; preserve me';
  writeFileSync(invalidPath, invalidText);
  assertBusy(invalidRepo, 'build');
  assert.equal(readFileSync(invalidPath, 'utf8'), invalidText);
});

test('release leaves a lock file alone when its owner token has changed', t => {
  const { repo } = syntheticRepo(t);
  const path = lockPath(repo);
  const release = acquireManualReleaseLock(repo, 'build');
  const original = JSON.parse(readFileSync(path, 'utf8'));
  const changedText = `${JSON.stringify({ ...original, ownerToken: 'different-owner-token' })}\n`;
  writeFileSync(path, changedText);
  release();
  assert.equal(readFileSync(path, 'utf8'), changedText);
});

test('an existing symlink is rejected without following or replacing its target', t => {
  const { root, repo } = syntheticRepo(t);
  const path = lockPath(repo);
  const target = join(root, 'keep.txt');
  writeFileSync(target, 'synthetic target stays intact\n');
  try {
    symlinkSync(target, path, 'file');
  } catch (error) {
    if (['EACCES', 'EPERM', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Symlink creation is not permitted in this environment (${error.code}).`);
      return;
    }
    throw error;
  }
  assertBusy(repo, 'build');
  assert.equal(lstatSync(path).isSymbolicLink(), true);
  assert.equal(readFileSync(target, 'utf8'), 'synthetic target stays intact\n');
});

test('operation names outside build and publish are rejected before creating a lock', t => {
  const { repo } = syntheticRepo(t);
  assert.throws(() => acquireManualReleaseLock(repo, 'inspect'), /MANUAL_RELEASE_OPERATION_INVALID/u);
  assert.equal(existsSync(lockPath(repo)), false);
});
