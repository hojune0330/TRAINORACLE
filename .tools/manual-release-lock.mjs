import { randomUUID } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { gitAt } from './pages-release-safety.mjs';

const LOCK_FILENAME = 'trainoracle-manual-release.lock';

function busyError(lockPath) {
  const error = new Error(`MANUAL_RELEASE_BUSY: ${lockPath}`);
  error.code = 'MANUAL_RELEASE_BUSY';
  error.lockPath = lockPath;
  return error;
}

function statIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function fileIdentity(stat) {
  if (!stat || !Number.isFinite(stat.ino) || stat.ino === 0) return null;
  return `${stat.dev}:${stat.ino}`;
}

function sameFile(left, right) {
  const leftIdentity = fileIdentity(left);
  const rightIdentity = fileIdentity(right);
  if (leftIdentity === null || rightIdentity === null) return null;
  return leftIdentity === rightIdentity;
}

function removeCreatedLockAfterWriteFailure(lockPath, createdStat) {
  if (!createdStat) return;
  try {
    const current = statIfPresent(lockPath);
    if (!current || current.isSymbolicLink() || !current.isFile()) return;
    if (sameFile(createdStat, current) === true) unlinkSync(lockPath);
  } catch {
    // A failed write must not turn into a second failure that risks touching another lock.
  }
}

function stillOwned(lockPath, ownerToken, createdStat) {
  try {
    const before = statIfPresent(lockPath);
    if (!before || before.isSymbolicLink() || !before.isFile()) return false;
    if (sameFile(createdStat, before) === false) return false;
    const metadata = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (metadata?.ownerToken !== ownerToken) return false;
    const after = statIfPresent(lockPath);
    if (!after || after.isSymbolicLink() || !after.isFile()) return false;
    return sameFile(before, after) !== false && sameFile(createdStat, after) !== false;
  } catch {
    return false;
  }
}

function manualReleaseLockPath(repo) {
  const repository = resolve(repo);
  const commonDirectory = gitAt(repository, 'rev-parse', '--git-common-dir');
  const resolvedCommonDirectory = isAbsolute(commonDirectory)
    ? resolve(commonDirectory)
    : resolve(repository, commonDirectory);
  return join(resolvedCommonDirectory, LOCK_FILENAME);
}

/**
 * Acquire one synchronous local lease shared by build and publish in every linked worktree.
 * Existing locks are intentionally never inspected for staleness or removed automatically.
 */
export function acquireManualReleaseLock(repo, operation) {
  if (operation !== 'build' && operation !== 'publish') {
    throw new Error('MANUAL_RELEASE_OPERATION_INVALID');
  }

  const lockPath = manualReleaseLockPath(repo);
  if (statIfPresent(lockPath)) throw busyError(lockPath);

  let fd;
  try {
    fd = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST' || statIfPresent(lockPath)) throw busyError(lockPath);
    throw error;
  }

  const metadata = {
    ownerToken: randomUUID(),
    pid: process.pid,
    host: hostname(),
    operation,
    startedAt: new Date().toISOString(),
  };
  let createdStat;
  let failure;
  try {
    createdStat = fstatSync(fd);
    writeFileSync(fd, `${JSON.stringify(metadata)}\n`, { encoding: 'utf8' });
  } catch (error) {
    failure = error;
  }
  try {
    closeSync(fd);
  } catch (error) {
    failure ??= error;
  }

  if (failure) {
    removeCreatedLockAfterWriteFailure(lockPath, createdStat);
    throw failure;
  }
  if (!stillOwned(lockPath, metadata.ownerToken, createdStat)) {
    throw new Error(`MANUAL_RELEASE_LOCK_CHANGED: ${lockPath}`);
  }

  let released = false;
  return function releaseManualReleaseLock() {
    if (released) return;
    released = true;
    if (!stillOwned(lockPath, metadata.ownerToken, createdStat)) return;
    try {
      unlinkSync(lockPath);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw new Error(`MANUAL_RELEASE_LOCK_RELEASE_FAILED: ${lockPath}`, { cause: error });
    }
  };
}
