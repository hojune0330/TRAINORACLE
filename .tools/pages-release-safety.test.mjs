import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { BUILD_MANIFEST, DEPLOY_RECEIPT, assertBuildSourceCommitted, assertFreshOutputDirectory,
  assertReleaseSnapshot, gitAt, packageInventory, remoteReleaseSnapshot, verifyReleasePackage } from './pages-release-safety.mjs';
import { publishRelease } from './publish-oracle-pages-release.mjs';

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), 'trainoracle-release-test-'));
  t.after(() => {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('trainoracle-release-test-')) {
      throw Error('TEST_CLEANUP_OUTSIDE_TEMP');
    }
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

function commit(repo, label) {
  gitAt(repo, 'add', '--all');
  gitAt(repo, '-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', 'commit', '-m', label);
  return gitAt(repo, 'rev-parse', 'HEAD');
}

function fixture(t) {
  const root = temp(t);
  const remote = join(root, 'remote.git');
  const repo = join(root, 'source');
  const pagesRepo = join(root, 'pages');
  const bundle = join(root, 'bundle');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'pipe' });
  execFileSync('git', ['clone', remote, repo], { stdio: 'pipe' });
  gitAt(repo, 'switch', '--orphan', 'gh-pages');
  write(repo, 'index.html', '<script src="./assets/old.js"></script>');
  write(repo, 'assets/old.js', 'retained old entry');
  write(repo, 'previews/existing/index.html', 'retained preview');
  write(repo, 'CNAME', 'synthetic.example.invalid');
  commit(repo, 'initial pages');
  gitAt(repo, 'push', 'origin', 'gh-pages');
  gitAt(repo, 'switch', '--orphan', 'main');
  write(repo, 'app/source.js', 'source');
  write(repo, 'impl/shared.js', 'shared source');
  commit(repo, 'source');
  gitAt(repo, 'push', 'origin', 'main');
  execFileSync('git', ['clone', '--branch', 'gh-pages', remote, pagesRepo], { stdio: 'pipe' });
  gitAt(pagesRepo, 'config', 'user.name', 'Release Test');
  gitAt(pagesRepo, 'config', 'user.email', 'release@example.invalid');
  write(bundle, 'index.html', '<script src="./assets/new.js"></script>');
  write(bundle, 'assets/new.js', 'new entry');
  write(bundle, '.nojekyll', '');
  const manifest = { kind: 'TRAINORACLE_RELEASE_BUILD_PACKAGE', ...remoteReleaseSnapshot(repo),
    previewOnly: false, accountHeld: true, deploymentStatus: 'NOT_PUBLISHED', files: packageInventory(bundle) };
  manifest.publicConfigurationSourceSha = manifest.previousPagesSha;
  write(bundle, BUILD_MANIFEST, JSON.stringify(manifest));
  return { root, repo, pagesRepo, bundle, manifest };
}

test('stale main and stale Pages configuration are distinct rebuild failures', () => {
  const expected = { sourceSha: 'a'.repeat(40), previousPagesSha: 'b'.repeat(40) };
  assertReleaseSnapshot(expected, expected);
  assert.throws(() => assertReleaseSnapshot(expected, { ...expected, sourceSha: 'c'.repeat(40) }), /SOURCE_NOT_CURRENT_MAIN/);
  assert.throws(() => assertReleaseSnapshot(expected, { ...expected, previousPagesSha: 'c'.repeat(40) }), /PAGES_CHANGED_REBUILD_REQUIRED/);
});

test('output refuses the source directory and a reused nonempty build folder without deleting either', t => {
  const root = temp(t);
  const source = join(root, 'source');
  write(source, 'app.js', 'keep');
  assert.throws(() => assertFreshOutputDirectory(root, source), /CONTAINS_SOURCE/);
  assert.throws(() => assertFreshOutputDirectory(source, source), /CONTAINS_SOURCE/);
  const output = join(root, 'output');
  write(output, 'old.js', 'keep');
  assert.throws(() => assertFreshOutputDirectory(output, source), /NOT_EMPTY/);
  assert.equal(readFileSync(join(output, 'old.js'), 'utf8'), 'keep');
  assertFreshOutputDirectory(join(root, 'fresh'), source);
});

test('preview assets and secret-file names cannot enter a root package', t => {
  const root = temp(t);
  const preview = join(root, 'preview');
  write(preview, 'previews/example/index.html', 'no');
  assert.throws(() => packageInventory(preview), /RESERVED_PATH/);
  const secret = join(root, 'secret');
  write(secret, '.env.production', 'synthetic');
  assert.throws(() => packageInventory(secret), /RESERVED_PATH/);
});

test('source guards reject untracked application code and tracked shared-library edits', t => {
  const { repo } = fixture(t);
  assertBuildSourceCommitted(repo);
  write(repo, 'app/new-runtime.js', 'new');
  assert.throws(() => assertBuildSourceCommitted(repo), /UNTRACKED/);
  rmSync(join(repo, 'app/new-runtime.js'));
  write(repo, 'impl/shared.js', 'changed');
  assert.throws(() => assertBuildSourceCommitted(repo), /NOT_COMMITTED/);
});

test('dry run does not copy, commit or publish; actual publish preserves previews and old assets', t => {
  const f = fixture(t);
  const before = remoteReleaseSnapshot(f.repo);
  assert.equal(publishRelease(f).status, 'READY_NOT_PUBLISHED');
  assert.deepEqual(remoteReleaseSnapshot(f.repo), before);
  assert.match(readFileSync(join(f.pagesRepo, 'index.html'), 'utf8'), /old.js/u);
  const result = publishRelease({ ...f, publish: true });
  assert.equal(result.status, 'PUSH_ACCEPTED_LIVE_NOT_VERIFIED');
  assert.equal(remoteReleaseSnapshot(f.repo).previousPagesSha, result.pagesSha);
  assert.equal(readFileSync(join(f.pagesRepo, 'previews/existing/index.html'), 'utf8'), 'retained preview');
  assert.equal(readFileSync(join(f.pagesRepo, 'assets/old.js'), 'utf8'), 'retained old entry');
  assert.equal(readFileSync(join(f.pagesRepo, 'CNAME'), 'utf8'), 'synthetic.example.invalid');
  assert.match(readFileSync(join(f.pagesRepo, 'index.html'), 'utf8'), /new.js/u);
  assert.equal(JSON.parse(readFileSync(join(f.pagesRepo, DEPLOY_RECEIPT))).sourceSha, f.manifest.sourceSha);
});

test('a second publisher cannot reuse a package prepared before another deployment', t => {
  const f = fixture(t);
  publishRelease({ ...f, publish: true });
  const afterFirst = remoteReleaseSnapshot(f.repo);
  assert.throws(() => publishRelease({ ...f, publish: true }), /PAGES_CHANGED_REBUILD_REQUIRED/);
  assert.deepEqual(remoteReleaseSnapshot(f.repo), afterFirst);
});

test('a new main commit blocks publication without changing Pages', t => {
  const f = fixture(t);
  write(f.repo, 'app/source.js', 'new source');
  commit(f.repo, 'next source');
  gitAt(f.repo, 'push', 'origin', 'main');
  assert.throws(() => publishRelease({ ...f, publish: true }), /SOURCE_NOT_CURRENT_MAIN/);
  assert.match(readFileSync(join(f.pagesRepo, 'index.html'), 'utf8'), /old.js/u);
});

test('modified or extra package files and non-held previews are rejected', t => {
  const f = fixture(t);
  write(f.bundle, 'assets/new.js', 'tampered');
  assert.throws(() => verifyReleasePackage(f.bundle), /PACKAGE_CONTENT_CHANGED/);
  write(f.bundle, 'assets/new.js', 'new entry');
  write(f.bundle, 'extra.js', 'unexpected');
  assert.throws(() => verifyReleasePackage(f.bundle), /PACKAGE_CONTENT_CHANGED/);
  rmSync(join(f.bundle, 'extra.js'));
  write(f.bundle, BUILD_MANIFEST, JSON.stringify({ ...f.manifest, accountHeld: false }));
  assert.throws(() => verifyReleasePackage(f.bundle), /NOT_HELD_CANONICAL_RELEASE/);
  write(f.bundle, BUILD_MANIFEST, JSON.stringify({ ...f.manifest, previewOnly: true }));
  assert.throws(() => verifyReleasePackage(f.bundle), /NOT_HELD_CANONICAL_RELEASE/);
});

test('dirty destination and retained asset collisions fail before copying', t => {
  const f = fixture(t);
  write(f.pagesRepo, 'operator-draft.txt', 'do not touch');
  assert.throws(() => publishRelease(f), /PAGES_TARGET_NOT_CLEAN/);
  rmSync(join(f.pagesRepo, 'operator-draft.txt'));
  write(f.bundle, 'assets/old.js', 'changed same-name asset');
  write(f.bundle, BUILD_MANIFEST, JSON.stringify({ ...f.manifest, files: packageInventory(f.bundle) }));
  assert.throws(() => publishRelease({ ...f, publish: true }), /RETAINED_ASSET_COLLISION/);
  assert.match(readFileSync(join(f.pagesRepo, 'index.html'), 'utf8'), /old.js/u);
});

test('an unchanged published asset tolerates clean Windows checkout line endings', t => {
  const f = fixture(t);
  gitAt(f.pagesRepo, 'config', 'core.autocrlf', 'true');
  write(f.pagesRepo, '.gitattributes', 'assets/*.js text eol=crlf\n');
  write(f.pagesRepo, 'assets/shared.js', 'same entry\n');
  commit(f.pagesRepo, 'shared asset');
  gitAt(f.pagesRepo, 'push', 'origin', 'gh-pages');
  rmSync(join(f.pagesRepo, 'assets/shared.js'));
  gitAt(f.pagesRepo, 'checkout-index', '--force', '--', 'assets/shared.js');
  assert.equal(readFileSync(join(f.pagesRepo, 'assets/shared.js'), 'utf8'), 'same entry\r\n');
  assert.equal(gitAt(f.pagesRepo, 'diff', '--', 'assets/shared.js'), '');
  write(f.bundle, 'assets/shared.js', 'same entry\n');
  const snapshot = remoteReleaseSnapshot(f.repo);
  write(f.bundle, BUILD_MANIFEST, JSON.stringify({ ...f.manifest, ...snapshot,
    publicConfigurationSourceSha: snapshot.previousPagesSha, files: packageInventory(f.bundle) }));
  assert.equal(publishRelease(f).status, 'READY_NOT_PUBLISHED');
});
