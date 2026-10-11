import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUILD_MANIFEST, DEPLOY_RECEIPT, assertReleaseSnapshot, gitAt, hasTrackedChanges, remoteReleaseSnapshot,
  verifyReleasePackage } from './pages-release-safety.mjs';
import { acquireManualReleaseLock } from './manual-release-lock.mjs';

export function publishRelease(options) {
  // Inspection remains read-only. Only mutating release work takes the shared local lease.
  if (!options.publish) return publishUnlocked(options);
  const release = acquireManualReleaseLock(options.repo, 'publish');
  try {
    return publishUnlocked(options);
  } finally {
    release();
  }
}

function publishUnlocked({ repo, bundle, pagesRepo, publish = false }) {
  const { manifest, files } = verifyReleasePackage(bundle);
  assertReleaseSnapshot(manifest, remoteReleaseSnapshot(repo));
  const target = realpathSync(pagesRepo);
  if (realpathSync(gitAt(target, 'rev-parse', '--show-toplevel')) !== target
    || realpathSync(repo) === target || relative(target, realpathSync(bundle)).split(sep)[0] !== '..') {
    throw Error('PAGES_TARGET_NOT_ISOLATED');
  }
  if (gitAt(target, 'remote', 'get-url', 'origin') !== gitAt(repo, 'remote', 'get-url', 'origin')) {
    throw Error('PAGES_REMOTE_MISMATCH');
  }
  if (gitAt(target, 'rev-parse', 'HEAD') !== manifest.previousPagesSha) throw Error('PAGES_TARGET_NOT_CURRENT');
  if (hasTrackedChanges(target) || gitAt(target, 'ls-files', '--others', '--exclude-standard')) {
    throw Error('PAGES_TARGET_NOT_CLEAN');
  }
  const paths = [...Object.keys(files), BUILD_MANIFEST, DEPLOY_RECEIPT];
  // Check all destination paths before copying; retained previews and old bundles are never removed.
  for (const path of paths) {
    let cursor = target;
    for (const part of path.split('/')) {
      cursor = join(cursor, part);
      if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw Error('PAGES_TARGET_LINK_REJECTED');
    }
    if (path.startsWith('assets/') && existsSync(cursor)
      && !readFileSync(cursor).equals(readFileSync(join(bundle, path)))) {
      // A clean Windows checkout can contain CRLF while the published Git blob has LF.
      const builtBlob = gitAt(target, 'hash-object', '--no-filters', join(bundle, path));
      if (gitAt(target, 'rev-parse', `HEAD:${path}`) !== builtBlob) {
        throw Error(`RETAINED_ASSET_COLLISION:${path}`);
      }
    }
  }
  if (!publish) return { status: 'READY_NOT_PUBLISHED', sourceSha: manifest.sourceSha,
    previousPagesSha: manifest.previousPagesSha, files: paths.length };

  assertReleaseSnapshot(manifest, remoteReleaseSnapshot(repo));
  const expectedBlobs = new Map();
  const blobForBytes = bytes => execFileSync('git', ['-c', `safe.directory=${target}`,
    'hash-object', '--no-filters', '--stdin'], { cwd: target, input: bytes, encoding: 'utf8' }).trim();
  for (const path of paths.filter(path => path !== DEPLOY_RECEIPT)) {
    const destination = join(target, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(bundle, path), destination);
  }
  for (const [path, digest] of Object.entries(files)) {
    const verifiedBytes = readFileSync(join(target, path));
    if (createHash('sha256').update(verifiedBytes).digest('hex') !== digest) {
      throw Error('COPIED_PACKAGE_CONTENT_CHANGED');
    }
    expectedBlobs.set(path, blobForBytes(verifiedBytes));
  }
  const manifestBytes = readFileSync(join(target, BUILD_MANIFEST));
  if (JSON.stringify(JSON.parse(manifestBytes.toString('utf8'))) !== JSON.stringify(manifest)) {
    throw Error('COPIED_PACKAGE_MANIFEST_CHANGED');
  }
  expectedBlobs.set(BUILD_MANIFEST, blobForBytes(manifestBytes));
  const receiptBytes = Buffer.from(JSON.stringify({
    kind: 'TRAINORACLE_PAGES_DEPLOYMENT', sourceSha: manifest.sourceSha,
    previousPagesSha: manifest.previousPagesSha, method: 'PRESERVING_GUARDED_MANUAL',
    deployedAt: new Date().toISOString(), backendVerification: 'NOT_CONFIRMED',
  }, null, 2) + '\n');
  writeFileSync(join(target, DEPLOY_RECEIPT), receiptBytes);
  expectedBlobs.set(DEPLOY_RECEIPT, blobForBytes(receiptBytes));
  // A same-size copy can retain a Windows stat-cache signature. Disk verification
  // alone does not prove git add actually staged those bytes. Freeze raw blob IDs.
  const assertBlobs = tree => {
    for (const [path, expected] of expectedBlobs) {
      if (gitAt(target, 'rev-parse', `${tree}:${path}`) !== expected) {
        throw Error(`PUBLISHED_BLOB_MISMATCH:${tree || 'INDEX'}:${path}`);
      }
    }
  };
  // Stage only this verified package; an unrelated late file must remain untouched.
  // A NUL-delimited input also avoids Windows' command-line length limit.
  // Rehash tracked files even if their cached size/timestamps appear unchanged.
  // Keep release bytes exact; an explicit filter that changes them fails below.
  for (const options of [[], ['--renormalize']]) {
    execFileSync('git', ['-c', `safe.directory=${target}`, '-c', 'core.autocrlf=false',
      '--literal-pathspecs', 'add', ...options, '--pathspec-from-file=-', '--pathspec-file-nul'], {
      cwd: target, input: paths.join('\0') + '\0', stdio: 'pipe',
    });
  }
  const changed = gitAt(target, '-c', 'core.quotePath=false', 'diff', '--cached', '--name-only').split(/\r?\n/u);
  if (changed.some(path => !paths.includes(path)) || gitAt(target, 'diff', '--cached', '--name-only', '--diff-filter=D')) {
    throw Error('UNEXPECTED_STAGED_PAGES_CHANGE');
  }
  assertBlobs('');
  gitAt(target, 'commit', '-m', `deploy: preserving app from main ${manifest.sourceSha.slice(0, 8)}`);
  const pagesSha = gitAt(target, 'rev-parse', 'HEAD');
  assertBlobs(pagesSha);
  assertReleaseSnapshot(manifest, remoteReleaseSnapshot(repo));
  // A concurrent publisher wins cleanly: never rebase, force, or retry this prepared commit.
  gitAt(target, 'push', 'origin', `${pagesSha}:refs/heads/gh-pages`);
  return { status: 'PUSH_ACCEPTED_LIVE_NOT_VERIFIED', sourceSha: manifest.sourceSha,
    pagesSha };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!option('bundle') || !option('pages-worktree')) throw Error('BUNDLE_AND_PAGES_WORKTREE_REQUIRED');
  const unknown = process.argv.slice(2).filter(arg => arg !== '--publish'
    && !arg.startsWith('--bundle=') && !arg.startsWith('--pages-worktree='));
  if (unknown.length) throw Error('UNKNOWN_PUBLISH_OPTION');
  console.log(JSON.stringify(publishRelease({ repo: fileURLToPath(new URL('../', import.meta.url)),
    bundle: resolve(option('bundle')), pagesRepo: resolve(option('pages-worktree')),
    publish: process.argv.includes('--publish') })));
}
