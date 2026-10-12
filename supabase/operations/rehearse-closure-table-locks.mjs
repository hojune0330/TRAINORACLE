// Disposable synthetic loopback PostgreSQL rehearsal; never opens the installed
// cluster, provider/project connection, credentials, or actual application rows.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { INVENTORY_SQL, CLOSED_RECEIPTS, expectedBaseline, loadClosureSources, planClosure,
  snapshotHash, renderApplySql, verificationSql } from './lounge-closure-operator.mjs';

if (!process.argv.includes('--synthetic-loopback')) throw Error('SYNTHETIC_LOOPBACK_FLAG_REQUIRED');
// URL decode through the standard utility; no computed external DATA directory.
const { fileURLToPath } = await import('node:url');
const repo = fileURLToPath(new URL('../..', import.meta.url));
const scratch = join(repo, '.tmp', `closure-native-${randomUUID()}`), data = join(scratch, 'data');
const bin = 'C:/Program Files/PostgreSQL/17/bin';
mkdirSync(scratch, { recursive: true });
const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
const port = listener.address().port; await new Promise(accept => listener.close(accept));
const env = { SystemRoot: 'C:/Windows', WINDIR: 'C:/Windows', PATH: `${bin};C:/Windows/System32`,
  TEMP: scratch, TMP: scratch, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: String(port),
  PGDATABASE: 'postgres', PGUSER: 'postgres', PGCONNECT_TIMEOUT: '3', PGPASSFILE: join(scratch, 'absent.pgpass') };
const run = (name, args, options = {}) => execFileSync(join(bin, `${name}.exe`), args,
  { env, cwd: scratch, windowsHide: true, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], timeout: 60000, ...options });
const query = sql => run('psql', ['-X', '--no-psqlrc', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { input: sql, timeout: 45000 }).trim();
const capture = () => JSON.parse(query(INVENTORY_SQL));
let started = false, writer = null, phase = 'INITDB';
try {
  run('initdb', ['-D', data, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--locale=C', '--encoding=UTF8', '--no-instructions']);
  phase = 'START_SYNTHETIC_CLUSTER';
  // Windows postmaster descendants must not inherit this Node call's pipes.
  run('pg_ctl', ['-D', data, '-l', join(scratch, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', '-t', '15', 'start'], {stdio:'ignore'}); started = true;
  phase = 'BOOTSTRAP_SYNTHETIC_AUTH';
  const fixture = readFileSync(new URL('../tests/local-postgres/oracle-auth-fixture.mjs', import.meta.url), 'utf8');
  const bootstrap = fixture.match(/await db\.exec\(`([\s\S]*?)`\);/u)?.[1];
  assert.ok(bootstrap && !bootstrap.includes('${'));
  query(bootstrap);
  query(`create schema supabase_migrations; create table supabase_migrations.schema_migrations(
    version text primary key,statements text[],name text,created_by text,idempotency_key text unique,rollback text[]);`);
  const root = new URL('../migrations/', import.meta.url), files = readdirSync(root), quote = s => `'${s.replaceAll("'", "''")}'`;
  for (const {version,name} of expectedBaseline()) {
    phase = `BASELINE_${version}`;
    const file = CLOSED_RECEIPTS.find(row => row.version === version) ? `${name}.sql`
      : files.find(value => value.startsWith(`${version}_`) && value.endsWith('.sql'));
    const source = readFileSync(new URL(file, root), 'utf8'); query(source);
    query(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);`);
  }
  phase = 'INSERT_SYNTHETIC_JOURNAL';
  query(`insert into auth.users(id,email_confirmed_at) values('a1111111-1111-4111-8111-111111111111',clock_timestamp());
    insert into public.journal_entries(user_id,entry_id,saved_at,entry)
    values('a1111111-1111-4111-8111-111111111111','synthetic-writer','2026-10-12','{"synthetic":true}');`);
  const inventory = capture(), plan = planClosure(inventory, snapshotHash(inventory.snapshot));
  phase = 'RENDER_SYNTHETIC_CLOSURE';
  const sql = renderApplySql(plan, { projectRef: plan.projectRef, scope: 'TRAINORACLE_ENCRYPTED_APP_RECORDS', encrypted: true,
    plaintextFiles: false, privateRowsPrinted: false, ciphertextIntegrityVerified: true, isolatedAppRecordsRestoreVerified: true,
    ciphertextSha256: 'a'.repeat(64), metadataSnapshotSha256: plan.snapshotSha256,
    quiescenceMode: 'IN_TRANSACTION_TABLE_LOCKS', operatorWritesQuiesced: false, publicActivationApproved: false });
  writer = spawn(join(bin, 'psql.exe'), ['-X','--no-psqlrc','-q','-A','-t','-v','ON_ERROR_STOP=1'],
    { env, cwd: scratch, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  let writerError = false; writer.on('error', () => { writerError = true; });
  writer.stdout.resume(); writer.stderr.resume();
  writer.stdin.end(`begin; update public.journal_entries set entry='{"synthetic":false}' where entry_id='synthetic-writer';
    select pg_sleep(20); rollback;`);
  phase = 'OBSERVE_SYNTHETIC_WRITER';
  let held = false;
  for (let attempt=0; attempt<20 && !held; attempt++) {
    held = query(`select exists(select 1 from pg_locks where relation='public.journal_entries'::regclass
      and pid<>pg_backend_pid() and mode='RowExclusiveLock' and granted);`) === 't';
    if (!held) await new Promise(accept => setTimeout(accept, 100));
  }
  assert.equal(writerError, false); assert.equal(held, true);
  phase = 'ACTUAL_WRITE_LOCK_TIMEOUT';
  let blocked = false;
  try { query(sql); } catch (error) { blocked = /canceling statement due to lock timeout/u.test(String(error.stderr)); }
  assert.equal(blocked, true, 'NAMED_WRITER_HELD_LOCK_TIMEOUT');
  assert.deepEqual(capture(), inventory, 'NAMED_WRITER_HELD_ROLLBACK');
  assert.equal(query(`select entry::text from public.journal_entries where entry_id='synthetic-writer';`), '{"synthetic": true}');
  await once(writer, 'exit'); writer = null;
  phase = 'APPLY_AFTER_SYNTHETIC_DRAIN';
  assert.equal(query(`select entry::text from public.journal_entries where entry_id='synthetic-writer';`), '{"synthetic": true}');
  query(sql);
  const verification = JSON.parse(query(verificationSql(loadClosureSources())));
  assert.equal(Number(verification.ledgerCount), 57);
  assert.ok(verification.targetReceipts.every(row => row.present && row.sourceHashMatches));
  assert.equal(verification.loungeEnabled, false); assert.equal(verification.sensitiveStorageOperationsReady, false);
  assert.equal(query(`select entry::text from public.journal_entries where entry_id='synthetic-writer';`), '{"synthetic": true}');
  console.log(JSON.stringify({kind:'SYNTHETIC_NATIVE_POSTGRES_LOCK_REHEARSAL',serverVersion:query('show server_version;'),
    competingWriterObserved:true,writerHeldTimeoutRollbackVerified:true,afterDrainActualNineSqlApplied:true,
    oldLedgerPreserved:true,ledgerCount:57,syntheticJournalPreserved:true,publicAndStorageActivation:false,
    providerApplied:false,privateRowsPrinted:false,credentialsUsed:false}));
} catch (error) {
  console.error(JSON.stringify({kind:'SYNTHETIC_NATIVE_POSTGRES_REHEARSAL_FAILED',phase,
    failureType:error.name,status:typeof error.status==='number'?error.status:null})); process.exitCode=1;
} finally {
  if (writer && writer.exitCode === null) { writer.kill(); await once(writer,'exit').catch(()=>{}); }
  if (started || existsSync(join(data,'postmaster.pid'))) run('pg_ctl', ['-D',data,'-m','fast','-w','-t','15','stop'], {stdio:'ignore'});
}
