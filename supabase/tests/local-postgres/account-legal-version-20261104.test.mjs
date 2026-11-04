import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { loadOracleMigrationChain, approveSyntheticOracleStorage, admitOracleStorage, setOracleAuth } from './oracle-auth-fixture.mjs';

// Disposable synthetic database only. The historical fixture intentionally keeps
// its original legal/storage version; this test performs the actual upgrade.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const migration = readFileSync(new URL('20261104145316_account_legal_version_20261104.sql', migrations), 'utf8');
const OLD = '2026-10-05', LEGAL = '2026-11-04';
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const C = 'c3333333-3333-4333-8333-333333333333';
const D = 'd4444444-4444-4444-8444-444444444444';
const targetNames = [
  'account_admission_access_allowed', 'account_storage_subject_allowed',
  'get_current_account_admission_status', 'account_subject_public_data_allowed',
  'enforce_current_account_legal_versions', 'claim_beta_seat',
];
const comparison = /((?:profile\.|new\.)?(?:privacy_policy_version|terms_of_service_version)(?:_input)?\s+(?:=|is distinct from)\s+)'2026-10-05'/g;
const value = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
const admin = async (sql, args = []) => { await db.exec('reset role'); return db.query(sql, args); };
const claim = (owner, version = LEGAL, session = owner) => value(
  'select public.claim_beta_seat($1,$2,$3::date,$4,$4) value', [owner, session, '1990-01-01', version]);
const consent = owner => value('select public.get_account_storage_consent($1) value', [owner]);
const network = owner => value('select public.account_network_access_allowed($1) value', [owner]);
const functions = async () => (await admin(`select p.oid, p.proname, p.proowner, p.proacl::text, p.prosecdef,
  p.provolatile, p.proconfig, pg_get_functiondef(p.oid) definition from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.oid`)).rows;
async function storedState() {
  const result = {};
  for (const table of ['user_private_profiles', 'beta_enrollments', 'account_storage_consents',
    'account_storage_consent_events', 'account_storage_operation_reviews', 'service_feature_controls']) {
    result[table] = (await admin(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from public.${table} t`)).rows[0].value;
  }
  return result;
}
let originalFunctions, originalState, originalConsent;
before(async () => {
  await loadOracleMigrationChain(db);
  for (const file of ['0063_lounge_identity_deletion_outbox.sql', '0064_minigame_progress_account_storage.sql',
    '0065_lounge_grant_auth_channel_recheck.sql', '20261104103908_garmin_integration_runtime.sql']) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  await admin("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','AUTH_OAUTH','ACCOUNT_JOURNAL_V2')");
  await approveSyntheticOracleStorage(db);
  for (const owner of [A, B, C, D]) {
    await admin('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())', [owner]);
    await admin('insert into auth.sessions(id,user_id) values($1,$1)', [owner]);
  }
  await admitOracleStorage(db, A, A);
  originalConsent = await consent(A);
  for (const owner of [B, D]) {
    await setOracleAuth(db, owner, owner);
    assert.equal(await claim(owner, OLD), 'ADMITTED_NEW');
  }
  originalFunctions = await functions(); originalState = await storedState();
}, { timeout: 60000 });
after(() => db.close());

test('an unexpected current comparison fails before changing any function or row', async () => {
  const target = originalFunctions.find(row => row.proname === 'enforce_current_account_legal_versions');
  await db.exec('begin');
  await db.exec(target.definition.replace("'2026-10-05'", "'synthetic-unexpected-version'"));
  await assert.rejects(db.exec(migration), /ACCOUNT_LEGAL_DEFINITION_UNEXPECTED/);
  await db.exec('rollback');
  assert.deepEqual(await functions(), originalFunctions);
  assert.deepEqual(await storedState(), originalState);
});

test('an unlisted legal predicate fails closed without partially upgrading known functions', async () => {
  await db.exec(`begin; create function public.synthetic_unlisted_legal() returns boolean language plpgsql as $$
    declare privacy_policy_version text := 'old'; begin return privacy_policy_version = '2026-10-05'; end; $$;`);
  await assert.rejects(db.exec(migration), /ACCOUNT_LEGAL_UNLISTED_FUNCTION/);
  await db.exec('rollback');
  assert.deepEqual(await functions(), originalFunctions);
});

test('upgrade changes only the twelve legal comparisons, preserving ACLs, all purpose functions and stored choices', async () => {
  await db.exec(migration);
  const changed = [];
  for (const actual of await functions()) {
    const previous = originalFunctions.find(row => row.oid === actual.oid);
    assert.ok(previous, `unexpected new function ${actual.proname}`);
    if (actual.definition !== previous.definition) {
      changed.push(actual.proname);
      assert.equal((previous.definition.match(comparison) ?? []).length, 2);
      assert.deepEqual(actual, { ...previous, definition: previous.definition.replace(comparison, "$1'2026-11-04'") });
    } else assert.deepEqual(actual, previous);
  }
  assert.deepEqual(changed.sort(), [...targetNames].sort());
  assert.deepEqual(await storedState(), originalState);
  await setOracleAuth(db, A, A);
  assert.equal(await value('select public.get_current_account_admission_status($1) value', [A]), 'LEGAL_RECONSENT_REQUIRED');
  assert.equal(await network(A), false);
  assert.deepEqual(await consent(A), originalConsent);
});

test('explicit legal acceptance preserves existing health/text consent and does not infer it for new or existing accounts', async () => {
  await setOracleAuth(db, A, A);
  assert.equal(await claim(A, OLD), 'LEGAL_VERSION_INVALID');
  assert.equal(await claim(A), 'ADMITTED_EXISTING');
  await assert.rejects(admin('update public.user_private_profiles set privacy_policy_version=$2 where user_id=$1', [A, OLD]), /invalid legal consent version/);
  await setOracleAuth(db, A, A);
  assert.deepEqual(await consent(A), originalConsent);
  assert.equal(await network(A), true);
  for (const [owner, expected] of [[B, 'ADMITTED_EXISTING'], [C, 'ADMITTED_NEW']]) {
    await setOracleAuth(db, owner, owner);
    assert.equal(await claim(owner), expected);
    const stored = await consent(owner);
    assert.equal(stored.purposeVersion, OLD);
    assert.equal(stored.healthStorage, false); assert.equal(stored.journalTextStorage, false);
    assert.equal(stored.revision, 0); assert.equal(await network(owner), false);
  }
  await setOracleAuth(db, B, B);
  await assert.rejects(value('select public.set_account_storage_consent($1,$1,0,$2,true,true) value', [B, LEGAL]), /STORAGE_CONSENT_VERSION_REQUIRED/);
});

test('owner/session checks, purpose withdrawals, operations switch and deletion of an older legal account remain effective', async () => {
  await setOracleAuth(db, A, A);
  assert.equal(await claim(B), 'IDENTITY_MISMATCH');
  assert.equal(await claim(A, LEGAL, B), 'SESSION_MISMATCH');
  await admin('update public.account_storage_operation_reviews set approved=false');
  await setOracleAuth(db, A, A);
  assert.equal(await network(A), false);
  await admin('update public.account_storage_operation_reviews set approved=true');
  await setOracleAuth(db, A, A);
  const withdrawn = await value('select public.set_account_storage_consent($1,$1,1,$2,false,false) value', [A, OLD]);
  assert.equal(withdrawn.purposeVersion, OLD); assert.equal(withdrawn.revision, 2);
  assert.equal(await network(A), false);
  await setOracleAuth(db, D, D);
  assert.equal(await value('select public.get_current_account_admission_status($1) value', [D]), 'LEGAL_RECONSENT_REQUIRED');
  assert.ok(await value('select public.request_account_deletion($1) value', [D]));
  assert.equal(await value('select public.get_current_account_admission_status($1) value', [D]), 'DELETION_REQUESTED');
  await setOracleAuth(db, B, B);
  await admin('update auth.sessions set not_after=clock_timestamp()-interval \'1 second\' where id=$1', [B]);
  await setOracleAuth(db, B, B);
  assert.equal(await claim(B), 'AUTH_METHOD_UNSUPPORTED');
});
