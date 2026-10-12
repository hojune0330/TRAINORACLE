import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const BUILD_MANIFEST = 'trainoracle-build-manifest.json';
export const DEPLOY_RECEIPT = 'trainoracle-deploy-receipt.json';

export function gitAt(repo, ...args) {
  return execFileSync('git', ['-c', `safe.directory=${resolve(repo)}`, ...args], {
    cwd: repo, encoding: 'utf8', maxBuffer: 48 * 1024 * 1024,
  }).trim();
}

export function remoteReleaseSnapshot(repo) {
  const refs = new Map(gitAt(repo, 'ls-remote', '--exit-code', 'origin',
    'refs/heads/main', 'refs/heads/gh-pages').split(/\r?\n/u).map(line => line.split(/\s+/u))
    .map(([sha, ref]) => [ref, sha]));
  const snapshot = { sourceSha: refs.get('refs/heads/main'), previousPagesSha: refs.get('refs/heads/gh-pages') };
  if (Object.values(snapshot).some(sha => !/^[a-f0-9]{40}$/u.test(sha ?? ''))) {
    throw Error('REMOTE_RELEASE_REFS_MISSING');
  }
  return snapshot;
}

export function assertReleaseSnapshot(expected, actual) {
  if (expected.sourceSha !== actual.sourceSha) throw Error('RELEASE_SOURCE_NOT_CURRENT_MAIN');
  if (expected.previousPagesSha !== actual.previousPagesSha) throw Error('PAGES_CHANGED_REBUILD_REQUIRED');
}

export function assertBuildSourceCommitted(repo) {
  if (hasTrackedChanges(repo)) throw Error('BUILD_SOURCE_NOT_COMMITTED');
  if (gitAt(repo, 'ls-files', '--others', '--exclude-standard', '--',
    'app', 'impl', 'runtime-evidence', '.tools', '*.css')) throw Error('BUILD_SOURCE_HAS_UNTRACKED_FILES');
}

export function hasTrackedChanges(repo) {
  try {
    gitAt(repo, 'diff', '--quiet', '--no-ext-diff', 'HEAD');
    return false;
  } catch (error) {
    if (error.status === 1) return true;
    throw error;
  }
}

export function assertFreshOutputDirectory(directory, repo) {
  const path = resolve(directory);
  const inside = value => !isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`);
  const fromOutput = relative(path, resolve(repo));
  if (inside(fromOutput)) {
    throw Error('BUILD_OUTPUT_CONTAINS_SOURCE');
  }
  if (inside(relative(resolve(repo), path))) throw Error('BUILD_OUTPUT_INSIDE_SOURCE');
  if (existsSync(path) && (lstatSync(path).isSymbolicLink() || readdirSync(path).length)) {
    throw Error('BUILD_OUTPUT_NOT_EMPTY');
  }
}

export function packageInventory(directory) {
  const files = Object.create(null);
  function visit(folder, prefix = '') {
    if (lstatSync(folder).isSymbolicLink()) throw Error('PACKAGE_LINK_REJECTED');
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (/(?:^|\/)\.git(?:\/|$)/iu.test(name) || /^previews(?:\/|$)/iu.test(name)
        || /(?:^|\/)\.env(?:\.|$)/iu.test(name)
        || [DEPLOY_RECEIPT, 'trainoracle-rollback-receipt.json'].includes(name)) {
        throw Error(`PACKAGE_RESERVED_PATH:${name}`);
      }
      if (entry.isSymbolicLink()) throw Error('PACKAGE_LINK_REJECTED');
      if (entry.isDirectory()) visit(join(folder, entry.name), `${name}/`);
      else if (!entry.isFile()) throw Error('PACKAGE_SPECIAL_FILE_REJECTED');
      else if (name !== BUILD_MANIFEST) {
        files[name] = createHash('sha256').update(readFileSync(join(folder, entry.name))).digest('hex');
      }
    }
  }
  visit(directory);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function verifyReleasePackage(directory) {
  if (lstatSync(directory).isSymbolicLink() || lstatSync(join(directory, BUILD_MANIFEST)).isSymbolicLink()) {
    throw Error('PACKAGE_LINK_REJECTED');
  }
  const manifest = JSON.parse(readFileSync(join(directory, BUILD_MANIFEST), 'utf8'));
  if (manifest.kind !== 'TRAINORACLE_RELEASE_BUILD_PACKAGE' || manifest.previewOnly !== false
    || manifest.accountHeld !== true || manifest.deploymentStatus !== 'NOT_PUBLISHED') {
    throw Error('PACKAGE_NOT_HELD_CANONICAL_RELEASE');
  }
  if (![manifest.sourceSha, manifest.previousPagesSha].every(sha => /^[a-f0-9]{40}$/u.test(sha ?? ''))
    || manifest.publicConfigurationSourceSha !== manifest.previousPagesSha) {
    throw Error('PACKAGE_SOURCE_INVALID');
  }
  const files = packageInventory(directory);
  if (!files['index.html'] || !files['.nojekyll'] || !manifest.files
    || JSON.stringify(files) !== JSON.stringify(manifest.files)) throw Error('PACKAGE_CONTENT_CHANGED');
  return { manifest, files };
}
