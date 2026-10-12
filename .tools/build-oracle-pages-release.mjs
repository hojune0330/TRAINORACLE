import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalOracleEnabled, holdSharedOriginAccount, publishedModuleNames } from './oracle-public-release-config.mjs';
import { assertBuildSourceCommitted, assertFreshOutputDirectory, assertReleaseSnapshot,
  gitAt, packageInventory, remoteReleaseSnapshot } from './pages-release-safety.mjs';
import { acquireManualReleaseLock } from './manual-release-lock.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const app = resolve(repo, 'app');
const require = createRequire(resolve(app, 'package.json'));
const git = (...args) => gitAt(repo, ...args);
const sourceSha = git('rev-parse', 'HEAD');
const previousPagesSha = git('rev-parse', 'origin/gh-pages');
const { parseAst } = await import(pathToFileURL(require.resolve('rollup/parseAst')).href);
const configs = [];
// Only reuse configuration already published in the browser, not local secret files.
for (const name of publishedModuleNames(git('show', 'origin/gh-pages:index.html'))) {
  const source = git('show', `origin/gh-pages:assets/${name}`);
  if (!source.includes('VITE_SUPABASE_ANON_KEY')) continue;
  const stack = [parseAst(source)];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'ObjectExpression') {
      const entries = node.properties.filter(p => p.type === 'Property').map(p => [p.key.name ?? p.key.value, p.value]);
      if (entries.some(([key]) => key === 'VITE_SUPABASE_ANON_KEY')) {
        const config = {};
        for (const [key, value] of entries.filter(([key]) => String(key).startsWith('VITE_'))) {
          if (value.type !== 'Literal' || typeof value.value !== 'string') throw Error('NON_STATIC_PUBLIC_CONFIGURATION');
          config[key] = value.value;
        }
        configs.push(config);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === 'object') stack.push(value);
    }
  }
}
if (!configs.length) throw Error('PUBLIC_CONFIGURATION_MISSING');
const stable = config => JSON.stringify(Object.entries(config).sort(([a], [b]) => a.localeCompare(b)));
let configuration = configs[0];
if (configs.some(config => stable(config) !== stable(configuration))) throw Error('PUBLIC_CONFIGURATION_AMBIGUOUS');
const key = configuration.VITE_SUPABASE_ANON_KEY;
if (!key.startsWith('sb_publishable_') && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') {
  throw Error('NON_PUBLIC_KEY_REJECTED');
}
// Canonical guest UI is approved; explicit disabled builds remain available.
const oracleOption = process.argv.find(arg => arg.startsWith('--oracle-v2='));
const previewOnly = process.argv.includes('--preview-only');
const accountHeld = process.argv.includes('--account-held');
if (accountHeld) configuration = holdSharedOriginAccount(configuration);
if (previewOnly) {
  configuration.VITE_ACCOUNT_PUBLIC_ENABLED = 'false';
  configuration.VITE_KILL_ACCOUNT = 'true';
  for (const name of Object.keys(configuration)) {
    if (name.startsWith('VITE_FEATURE_') || /^VITE_(KAKAO|GOOGLE|EMAIL|PHONE)_AUTH_ENABLED$/.test(name)) {
      configuration[name] = 'false';
    }
  }
}
// A published emergency hold is never cleared by repackaging the same source.
const enabled = canonicalOracleEnabled(configuration, oracleOption);
configuration.VITE_FEATURE_ORACLE_V2 = String(enabled);
configuration.VITE_KILL_ORACLE_V2 ??= 'false';
for (const name of Object.keys(process.env)) if (name.startsWith('VITE_')) delete process.env[name];
Object.assign(process.env, configuration);
const { validateHostedReleaseEnvironment } = await import('../app/scripts/validate-hosted-release-env.mjs');
const issues = validateHostedReleaseEnvironment(configuration);
if (issues.length) throw Error(`PUBLIC_CONFIGURATION_REJECTED:${issues.join(',')}`);
if (process.argv.includes('--inspect-only')) {
  const claims = key.startsWith('sb_publishable_') ? null : JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  console.log(JSON.stringify({ sourceSha, previousPagesSha, settingCount: Object.keys(configuration).length,
    publicKey: claims?.role ?? 'publishable', oracleV2Enabled: enabled, previewOnly, accountHeld,
    accountEnabled: configuration.VITE_ACCOUNT_PUBLIC_ENABLED === 'true',
    emailEnabled: configuration.VITE_EMAIL_AUTH_ENABLED === 'true',
    kakaoEnabled: configuration.VITE_KAKAO_AUTH_ENABLED === 'true',
    googleEnabled: configuration.VITE_GOOGLE_AUTH_ENABLED === 'true' }));
} else {
  const release = acquireManualReleaseLock(repo, 'build');
  try {
    assertBuildSourceCommitted(repo);
    if (!previewOnly) {
      if (!accountHeld) throw Error('CANONICAL_ACCOUNT_HOLD_REQUIRED');
      assertReleaseSnapshot({ sourceSha, previousPagesSha }, remoteReleaseSnapshot(repo));
    }
    const outDir = resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6)
      ?? resolve(repo, `../.scratch/oracle-mari-${sourceSha.slice(0, 8)}${previewOnly ? '-preview' : ''}/dist`));
    assertFreshOutputDirectory(outDir, repo);
    mkdirSync(outDir, { recursive: true });
    execFileSync(process.execPath, ['scripts/check-build-runtime.mjs'], { cwd: app, stdio: 'inherit', env: process.env });
    const { build } = await import(pathToFileURL(require.resolve('vite')).href);
    await build({ root: app, envFile: false, build: { outDir, emptyOutDir: false } });
    assertBuildSourceCommitted(repo);
    if (git('rev-parse', 'HEAD') !== sourceSha) throw Error('BUILD_SOURCE_CHANGED');
    if (!previewOnly) assertReleaseSnapshot({ sourceSha, previousPagesSha }, remoteReleaseSnapshot(repo));
    writeFileSync(resolve(outDir, '.nojekyll'), '');
    writeFileSync(resolve(outDir, 'trainoracle-build-manifest.json'), JSON.stringify({
      kind: previewOnly ? 'TRAINORACLE_LOCAL_PREVIEW_BUILD' : 'TRAINORACLE_RELEASE_BUILD_PACKAGE', sourceSha, previousPagesSha,
      deploymentStatus: 'NOT_PUBLISHED', previewOnly, accountHeld,
      publicConfigurationSourceSha: previousPagesSha, oracleV2Enabled: enabled,
      files: packageInventory(outDir),
      backendVerification: 'NOT_CONFIRMED', builtAt: new Date().toISOString(),
    }, null, 2) + '\n');
    console.log(`Package ready: ${sourceSha}; Oracle V2 ${enabled ? 'enabled' : 'held'}.`);
  } finally {
    release();
  }
}
