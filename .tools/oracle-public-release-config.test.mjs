import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holdSharedOriginAccount } from './oracle-public-release-config.mjs';
import { validateHostedReleaseEnvironment } from '../app/scripts/validate-hosted-release-env.mjs';

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
