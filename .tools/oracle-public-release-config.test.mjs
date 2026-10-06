import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalOracleEnabled, holdSharedOriginAccount, publishedModuleNames } from './oracle-public-release-config.mjs';
import { validateHostedReleaseEnvironment } from '../app/scripts/validate-hosted-release-env.mjs';

test('configuration is read from the active published HTML entry, not retained obsolete bundles', () => {
  assert.deepEqual(publishedModuleNames('<script type="module" src="./assets/index-current.js"></script><link rel="modulepreload" href="./assets/vendor.js">'), ['index-current.js']);
  assert.throws(() => publishedModuleNames('<script src="https://untrusted.example/index.js"></script>'), /PUBLISHED_ENTRY_SCRIPT_MISSING/);
  assert.throws(() => publishedModuleNames('<script src="./assets/../../secret.js"></script>'), /PUBLISHED_ENTRY_SCRIPT_MISSING/);
});

test('account hold closes dependent gates, preserves feedback and does not invent approvals', () => {
  const source = { VITE_ACCOUNT_PUBLIC_ENABLED: 'true', VITE_FEATURE_ACCOUNT_JOURNAL: 'true',
    VITE_FEATURE_SHARING: 'true', VITE_FEATURE_FILE_ANALYSIS_TCX: 'true', VITE_EMAIL_AUTH_ENABLED: 'true',
    VITE_FEATURE_FEEDBACK_BOARD: 'true', VITE_SUPABASE_URL: 'https://synthetic.example.test',
    VITE_SUPABASE_ANON_KEY: `sb_publishable_${'x'.repeat(24)}`, VITE_FEATURE_ORACLE_V2: 'false' };
  const held = holdSharedOriginAccount(source);
  assert.equal(source.VITE_ACCOUNT_PUBLIC_ENABLED, 'true');
  assert.equal(held.VITE_KILL_ACCOUNT, 'true');
  assert.equal(held.VITE_FEATURE_FEEDBACK_BOARD, 'true');
  assert.equal(held.VITE_FEATURE_ORACLE_V2, 'false');
  for (const name of ['VITE_ACCOUNT_PUBLIC_ENABLED', 'VITE_FEATURE_ACCOUNT_JOURNAL',
    'VITE_FEATURE_SHARING', 'VITE_FEATURE_FILE_ANALYSIS_TCX', 'VITE_EMAIL_AUTH_ENABLED']) assert.equal(held[name], 'false');
  assert.equal(held.VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED, undefined);
  assert.deepEqual(validateHostedReleaseEnvironment(held), []);
});

test('canonical guest packages default to the approved UI without changing account settings', () => {
  const config = Object.freeze({ VITE_ACCOUNT_PUBLIC_ENABLED: 'false', VITE_KILL_ACCOUNT: 'true' });
  assert.equal(canonicalOracleEnabled(config), true);
  assert.deepEqual(config, { VITE_ACCOUNT_PUBLIC_ENABLED: 'false', VITE_KILL_ACCOUNT: 'true' });
});

test('opening accounts later does not implicitly activate the Oracle account rollout', () => {
  assert.equal(canonicalOracleEnabled({ VITE_ACCOUNT_PUBLIC_ENABLED: 'true' }), false);
  assert.equal(canonicalOracleEnabled({ VITE_ACCOUNT_PUBLIC_ENABLED: 'true', VITE_KILL_ACCOUNT: 'true' }), true);
  assert.equal(canonicalOracleEnabled({ VITE_ACCOUNT_PUBLIC_ENABLED: 'true' }, '--oracle-v2=enabled'), true);
});

test('explicit disabled packages and the published Oracle kill switch remain authoritative', () => {
  assert.equal(canonicalOracleEnabled({}, '--oracle-v2=disabled'), false);
  assert.equal(canonicalOracleEnabled({ VITE_KILL_ORACLE_V2: 'true' }, '--oracle-v2=enabled'), false);
  assert.equal(canonicalOracleEnabled({ VITE_KILL_ORACLE_V2: 'true' }), false);
  assert.throws(() => canonicalOracleEnabled({}, '--oracle-v2=typo'), /INVALID_ORACLE_ROLLOUT_OPTION/);
});
