import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PROJECT_REF, BUNDLE_NAME, SOURCE_PINS, CLOSED_RECEIPTS, BASELINE_VERSIONS,
  INVENTORY_SQL, loadClosureSources, expectedBaseline, planClosure, renderApplySql,
  createMcpRequest, stripOuterWrapper, snapshotHash, summarizePlan, verificationSql } from './lounge-closure-operator.mjs';

// Only synthetic disposable data. No HTTP/DSN, credentials or actual records.
const local = new URL('../tests/local-postgres/', import.meta.url);
const require = createRequire(new URL('package.json', local));
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const migrationRoot = new URL('../migrations/', import.meta.url);
const files = readdirSync(migrationRoot);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const SA = 'a3333333-3333-4333-8333-333333333333';
const sources = loadClosureSources();
const selectFile = version => {
  const found = files.filter(name => name.startsWith(`${version}_`) && name.endsWith('.sql'));
  assert.equal(found.length, 1); return found[0];
};
let db, inventory, reviewedSnapshotSha256, plan, sql;
const evidence = current => ({ projectRef: PROJECT_REF, scope: 'TRAINORACLE_ENCRYPTED_APP_RECORDS',
  encrypted: true, plaintextFiles: false, privateRowsPrinted: false, ciphertextIntegrityVerified: true,
  isolatedAppRecordsRestoreVerified: true, ciphertextSha256: 'a'.repeat(64),
  metadataSnapshotSha256: current.snapshotSha256, quiescenceMode: 'IN_TRANSACTION_TABLE_LOCKS',
  operatorWritesQuiesced: false, publicActivationApproved: false });

async function makeBaseline() {
  const database = new PGlite({ extensions: { pgcrypto } });
  const fixture = readFileSync(new URL('oracle-auth-fixture.mjs', local), 'utf8');
  const bootstrap = fixture.match(/await db\.exec\(`([\s\S]*?)`\);/u)?.[1];
  assert.ok(bootstrap && !bootstrap.includes('${'));
  await database.exec(bootstrap);
  await database.exec(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text,
      created_by text,idempotency_key text unique,rollback text[]);`);
  for (const { version, name } of expectedBaseline()) {
    const file = CLOSED_RECEIPTS.find(entry => entry.version === version)
      ? `${name}.sql` : selectFile(version);
    const source = readFileSync(new URL(file, migrationRoot), 'utf8');
    await database.exec(source);
    await database.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)', [version, name, [source]]);
  }
  for (const user of [A, B]) {
    await database.query('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())', [user]);
    await database.query(`insert into public.user_private_profiles
      (user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','2026-08-26','2026-08-26',clock_timestamp())`, [user]);
    await database.query('insert into public.beta_enrollments(user_id) values($1)', [user]);
    await database.query(`insert into public.journal_entries(user_id,entry_id,saved_at,entry)
      values($1,'synthetic-existing-record','2026-10-12','{"synthetic":true}')`, [user]);
  }
  return database;
}
async function capture(database) { return (await database.query(INVENTORY_SQL)).rows[0].inventory; }
const journalCount = async database => Number((await database.query('select count(*) value from public.journal_entries')).rows[0].value);
const clone = value => structuredClone(value);

before(async () => {
  db = await makeBaseline();
  inventory = await capture(db); reviewedSnapshotSha256 = snapshotHash(inventory.snapshot);
  plan = planClosure(inventory, reviewedSnapshotSha256); sql = renderApplySql(plan, evidence(plan));
}, { timeout: 90000 });
after(async () => { await db?.close(); });

test('exact nine pinned bodies leave upstream 0064 and original migration bytes untouched', () => {
  assert.deepEqual(sources.map(source => source.version), ['0039', '0051', '0053', '0054', '0055', '0056', '0057', '0058', '0065']);
  assert.equal(SOURCE_PINS.length, 9); assert.equal(BASELINE_VERSIONS.length, 45);
  assert.ok(files.includes('0064_minigame_progress_account_storage.sql'));
  assert.ok(!files.includes('0064_lounge_grant_auth_channel_recheck.sql'));
  assert.equal(sources.some(source => source.version === '0064'), false);
});

test('only exact known outer wrappers are stripped; functions and nested DO blocks remain intact', () => {
  const wrapped = `-- approved\nbegin;\ncreate function example() returns void language plpgsql as $$begin\nperform 1;\nend;$$;\ncommit;`;
  assert.match(stripOuterWrapper(wrapped, '0057'), /as \$\$begin\nperform 1;\nend;\$\$;/u);
  assert.throws(() => stripOuterWrapper('begin; select 1; commit; select 2;', '0057'), /UNSUPPORTED_TRANSACTION_WRAPPER/u);
  assert.throws(() => stripOuterWrapper('begin; select 1; rollback; commit;', '0057'), /UNSUPPORTED_TRANSACTION_WRAPPER/u);
  assert.throws(() => stripOuterWrapper('begin; begin; select 1; commit;', '0057'), /UNSUPPORTED_TRANSACTION_WRAPPER/u);
  assert.throws(() => stripOuterWrapper('begin; select 1; commit;', '0039'), /UNEXPECTED_UNWRAPPED_TRANSACTION/u);
});

test('wrong project, missing/changed ledger, partial closure and opened transport are not plans', () => {
  for (const [change, expected] of [
    [value => { value.projectRef = 'wrong'; }, /PROJECT_MISMATCH/u],
    [value => { value.snapshot.ledger.pop(); }, /INVALID_INVENTORY/u],
    [value => { value.snapshot.privateRows = [{ synthetic: true }]; }, /INVALID_INVENTORY/u],
    [value => { value.snapshot.ledger[0].name = 'changed'; }, /BASELINE_48_MISMATCH/u],
    [value => { value.snapshot.ledger[0].statementsHash = 'not-a-hash'; }, /INVALID_LEDGER/u],
    [value => { value.snapshot.partial.consents = true; }, /PARTIAL_CLOSURE_STATE/u],
    [value => { value.snapshot.gates.loungeEnabled = true; }, /CLOSED_BASELINE_REQUIRED/u],
    [value => { value.snapshot.gates.features.AUTH_OAUTH = false; }, /CLOSED_BASELINE_REQUIRED/u],
  ]) { const modified = clone(inventory); change(modified); assert.throws(() => planClosure(modified, reviewedSnapshotSha256), expected); }
});

test('captured metadata cannot replace an independently reviewed baseline hash or break the outer DO delimiter', () => {
  assert.throws(() => planClosure(inventory), /REVIEWED_BASELINE_REQUIRED/u);
  const changedHash = clone(inventory); changedHash.snapshot.ledger[0].statementsHash = 'b'.repeat(32);
  assert.throws(() => planClosure(changedHash, reviewedSnapshotSha256), /REVIEWED_BASELINE_REQUIRED/u);
  const changedFunction = clone(inventory); changedFunction.snapshot.functions[0].hash = 'b'.repeat(32);
  assert.throws(() => planClosure(changedFunction, reviewedSnapshotSha256), /REVIEWED_BASELINE_REQUIRED/u);
  const emptyFunctions = clone(inventory); emptyFunctions.snapshot.functions = [];
  assert.throws(() => planClosure(emptyFunctions, snapshotHash(emptyFunctions.snapshot)), /INVALID_INVENTORY/u);
  const duplicateFunctions = clone(inventory); duplicateFunctions.snapshot.functions.push(clone(duplicateFunctions.snapshot.functions[0]));
  assert.throws(() => planClosure(duplicateFunctions, snapshotHash(duplicateFunctions.snapshot)), /INVALID_FUNCTION_FINGERPRINT/u);
  const collision = clone(inventory); collision.snapshot.functions[0].signature = 'public."$lounge_closure$"()';
  assert.throws(() => planClosure(collision, snapshotHash(collision.snapshot)), /DOLLAR_QUOTE_COLLISION/u);
  const changedPlan = clone(plan); changedPlan.reviewedSnapshotSha256 = 'b'.repeat(64);
  assert.throws(() => renderApplySql(changedPlan, evidence(changedPlan)), /REVIEWED_BASELINE_REQUIRED/u);
});

test('body tampering and plan-fingerprint tampering are rejected before any request can be emitted', () => {
  const modifiedSources = clone(sources); modifiedSources[0].sql += '\n-- synthetic tampering';
  assert.throws(() => planClosure(inventory, reviewedSnapshotSha256, modifiedSources), /INVALID_SOURCE_PLAN/u);
  for (const [key, value] of [['version', '0099'], ['name', 'changed'], ['sourceHash', 'b'.repeat(32)]]) {
    const changedSources = clone(sources); changedSources[0][key] = value;
    assert.throws(() => planClosure(inventory, reviewedSnapshotSha256, changedSources), /INVALID_SOURCE_PLAN/u);
  }
  const changed = clone(plan); changed.snapshotSha256 = 'b'.repeat(64);
  assert.throws(() => renderApplySql(changed, evidence(changed)), /PLAN_FINGERPRINT_CHANGED/u);
});

test('no apply request without independently reviewed encrypted recovery, actual restore and quiescence receipts', () => {
  for (const [key, value] of [['isolatedAppRecordsRestoreVerified', false], ['ciphertextIntegrityVerified', false],
    ['operatorWritesQuiesced', true], ['quiescenceMode', 'UNPROVEN'], ['publicActivationApproved', true], ['plaintextFiles', true],
    ['metadataSnapshotSha256', 'b'.repeat(64)]]) {
    assert.throws(() => createMcpRequest(plan, { ...evidence(plan), [key]: value }), /APP_RECORD_RECOVERY_EVIDENCE_REQUIRED/u);
  }
  const request = createMcpRequest(plan, evidence(plan));
  assert.equal(request.project_id, PROJECT_REF); assert.equal(request.name, BUNDLE_NAME);
  assert.equal(request.query, sql); assert.equal(summarizePlan(plan).productionApplied, false);
  assert.equal(summarizePlan(plan).nativePasswordRequired, false);
});

test('the prepared request has one DO owner, bounded transaction-local timeouts and nine append-only receipts', () => {
  assert.equal((sql.match(/^do \$lounge_closure\$/gmu) ?? []).length, 1);
  assert.match(sql, /^begin;\nset local lock_timeout='10s';\nset local statement_timeout='120s';/mu);
  assert.match(sql, /set local idle_in_transaction_session_timeout='180s'/u);
  assert.equal((sql.match(/insert into supabase_migrations\.schema_migrations\(version,name,statements\)/gu) ?? []).length, 9);
  assert.equal(/(?:update|delete from|truncate) supabase_migrations\.schema_migrations/iu.test(sql), false);
  assert.match(sql, /LOUNGE_CLOSURE_0057_NOT_EMPTY/u);
  assert.ok(sql.indexOf('LOUNGE_CLOSURE_0057_NOT_EMPTY') < sql.indexOf('-- 0058_storage_withdrawal_erasure.sql'));
  assert.ok(sql.indexOf('LOUNGE_CLOSURE_TABLE_LOCK_COVERAGE') < sql.indexOf('LOUNGE_CLOSURE_INVENTORY_DRIFT'));
  assert.ok(sql.indexOf('LOUNGE_CLOSURE_INVENTORY_DRIFT') < sql.indexOf('-- 0039_coros_daily_encrypted_inbox.sql'));
});

test('actual missing write-lock coverage fails before any of the nine source migrations', async () => {
  const modified = sql.replace("execute format('lock table only %I.%I in share row exclusive mode',table_lock.schema_name,table_lock.table_name);", 'perform 1;');
  assert.notEqual(modified, sql);
  await assert.rejects(db.exec(modified), /LOUNGE_CLOSURE_TABLE_LOCK_COVERAGE/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory); assert.equal(await journalCount(db), 2);
});

test('a frozen repeatable-read snapshot cannot be presented as writer-drained current metadata', async () => {
  const modified = sql.replace(/^begin;$/mu, 'begin isolation level repeatable read;');
  await assert.rejects(db.exec(modified), /LOUNGE_CLOSURE_READ_COMMITTED_REQUIRED/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory);
});

test('public parents with an unlocked cross-schema descendant are rejected before source execution', async () => {
  await db.exec(`create schema closure_synthetic_other;
    create table closure_synthetic_other.synthetic_child () inherits(public.journal_entries);`);
  const withChild = await capture(db), childPlan = planClosure(withChild, snapshotHash(withChild.snapshot));
  await assert.rejects(db.exec(renderApplySql(childPlan, evidence(childPlan))), /LOUNGE_CLOSURE_LOCK_SCOPE_UNSUPPORTED/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), withChild);
  await db.exec('drop schema closure_synthetic_other cascade'); assert.deepEqual(await capture(db), inventory);
});

test('actual disposable SQL failure after the first migration restores the whole original catalog and all 48 receipts', async () => {
  const needle = '  -- 0051_current_account_admission.sql';
  assert.equal(sql.split(needle).length, 2);
  await assert.rejects(db.exec(sql.replace(needle, `  raise exception 'SYNTHETIC_AFTER_FIRST_MIGRATION';\n${needle}`)), /SYNTHETIC_AFTER_FIRST_MIGRATION/u);
  await db.exec('rollback');
  assert.deepEqual(await capture(db), inventory, 'early failure must restore named inventory, not only row counts');
  assert.equal(await journalCount(db), 2);
});

test('actual late failure rolls back all nine DDL bodies and all nine individually appended receipts', async () => {
  const needle = '  select coalesce(jsonb_agg(item order by';
  assert.equal(sql.split(needle).length, 2);
  await assert.rejects(db.exec(sql.replace(needle, `  raise exception 'SYNTHETIC_AFTER_ALL_MIGRATIONS';\n${needle}`)), /SYNTHETIC_AFTER_ALL_MIGRATIONS/u);
  await db.exec('rollback');
  assert.deepEqual(await capture(db), inventory, 'late failure must restore named original inventory');
  assert.equal(await journalCount(db), 2);
});

test('the before-0058 empty guard detects an inserted withdrawal and preserves synthetic purpose records', async () => {
  const needle = '  if exists(select 1 from public.account_storage_consents)';
  const injected = `  insert into public.account_storage_consents(user_id,revision,purpose_version,health_storage,journal_text_storage,decided_session_id)
    values('${A}',1,'2026-10-05',false,false,'${SA}');\n${needle}`;
  await assert.rejects(db.exec(sql.replace(needle, injected)), /LOUNGE_CLOSURE_0057_NOT_EMPTY/u);
  await db.exec('rollback'); assert.equal(await journalCount(db), 2);
  assert.deepEqual(await capture(db), inventory);
});

test('defect injection proves the named empty guard prevents real purpose erasure, not a string-only check', async t => {
  const guard = /  if exists\(select 1 from public\.account_storage_consents\)\n    or exists\(select 1 from public\.account_storage_operation_reviews\) then\n    raise exception 'LOUNGE_CLOSURE_0057_NOT_EMPTY';\n  end if;/u;
  assert.match(sql, guard);
  const modified = sql.replace(guard, `  insert into public.account_storage_consents(user_id,revision,purpose_version,health_storage,journal_text_storage,decided_session_id)
    values('${A}',1,'2026-10-05',false,false,'${SA}');`)
    .replace("  insert into supabase_migrations.schema_migrations(version,name,statements)\n    values('0058'", `  if (select count(*) from public.journal_entries)<>2 then raise exception 'NAMED_PURPOSE_ERASURE_FAILURE'; end if;
  insert into supabase_migrations.schema_migrations(version,name,statements)\n    values('0058'`);
  await assert.rejects(db.exec(modified), /NAMED_PURPOSE_ERASURE_FAILURE/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory);
  t.diagnostic('Detected failing assertion by name: NAMED_PURPOSE_ERASURE_FAILURE');
});

test('actual function hash drift prevents all migration writes before source execution', async () => {
  await db.exec(`create or replace function public.account_network_access_allowed(target_user uuid)
    returns boolean language sql stable security definer set search_path=pg_catalog as $$select false;$$;`);
  const drifted = await capture(db);
  await assert.rejects(db.exec(sql), /LOUNGE_CLOSURE_INVENTORY_DRIFT/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), drifted);
  await db.close(); db = await makeBaseline(); inventory = await capture(db);
  reviewedSnapshotSha256 = snapshotHash(inventory.snapshot);
  plan = planClosure(inventory, reviewedSnapshotSha256); sql = renderApplySql(plan, evidence(plan));
});

test('actual generated postchecks reject changed source receipts and any historical-ledger rewrite', async () => {
  const wrongReceipt = sql.replace("values('0055','session_bound_account_admission'", "values('0055','synthetic_wrong_receipt'");
  assert.notEqual(wrongReceipt, sql);
  await assert.rejects(db.exec(wrongReceipt), /LOUNGE_CLOSURE_SOURCE_RECEIPT_POSTCHECK/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory);
  const marker = '  -- 0055_session_bound_account_admission.sql';
  const extraStatement = sql.replace(marker, `  update supabase_migrations.schema_migrations set statements=array_append(statements,'synthetic-extra') where version='0054';\n${marker}`);
  await assert.rejects(db.exec(extraStatement), /LOUNGE_CLOSURE_SOURCE_RECEIPT_POSTCHECK/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory);
  const changedHistory = sql.replace(marker, `  update supabase_migrations.schema_migrations set name='synthetic_tamper' where version='0001';\n${marker}`);
  await assert.rejects(db.exec(changedHistory), /LOUNGE_CLOSURE_LEDGER_POSTCHECK/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory);
  const changedGate = sql.replace(marker, `  update public.service_feature_controls set enabled=not enabled where feature_key='ACCOUNT';\n${marker}`);
  await assert.rejects(db.exec(changedGate), /LOUNGE_CLOSURE_EXISTING_GATES_CHANGED/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), inventory);
});

test('successful actual SQL preserves synthetic records and old receipt hashes, appends exactly nine and keeps all activation gates closed', async () => {
  await db.exec(sql);
  const after = await capture(db);
  assert.equal(after.snapshot.ledger.length, 57);
  assert.deepEqual(after.snapshot.ledger.filter(row => !sources.some(source => source.version === row.version)), inventory.snapshot.ledger);
  for (const source of sources) assert.equal(after.snapshot.ledger.find(row => row.version === source.version)?.name, source.name);
  assert.equal(await journalCount(db), 2);
  assert.equal(after.snapshot.gates.loungeEnabled, false);
  assert.equal(after.snapshot.gates.features.AUTH_OAUTH, false);
  assert.equal(after.snapshot.gates.features.AUTH_PASSWORDLESS, false);
  assert.equal((await db.query('select public.account_storage_operations_ready() ready')).rows[0].ready, false);
  assert.equal(after.snapshot.ledger.some(row => row.version === '0064'), false);
  const verified = (await db.query(verificationSql())).rows[0].verification;
  assert.equal(Number(verified.ledgerCount), 57); assert.equal(verified.targetReceipts.length, 9);
  assert.ok(verified.targetReceipts.every(row => row.present === true && row.sourceHashMatches === true));
  assert.deepEqual(verified.bundleReceipts, []);
  assert.equal(verified.sensitiveStorageOperationsReady, false);
  await assert.rejects(db.exec(sql), /LOUNGE_CLOSURE_INVENTORY_DRIFT/u);
  await db.exec('rollback'); assert.deepEqual(await capture(db), after);
});
