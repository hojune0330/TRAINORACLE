import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Isolated PostgreSQL in memory. No connection string, credentials or provider access.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const sql = readFileSync(new URL('0038_file_analysis_write_control.sql', migrations), 'utf8');
let previousControls;
let rollbackVerified = false;
const controls = async () => (await db.query('select * from public.service_feature_controls order by feature_key')).rows;
const denied = (action, code = '42501') => assert.rejects(action, error => error.code === code);
async function role(name) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(name));
  await db.exec(`reset role; set role ${name};`);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: name })]);
}
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for (const file of readdirSync(migrations).filter(name => /^\d+_.+\.sql$/.test(name) && name < '0038').sort()) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2');");
  previousControls = await controls();
  const beforeCommit = sql.slice(0, sql.lastIndexOf('commit;'));
  await db.exec(beforeCommit);
  await denied(() => db.exec('select 1 / 0;'), '22012');
  await db.exec('rollback;');
  assert.deepEqual(await controls(), previousControls);
  await denied(() => db.query("insert into public.service_feature_controls(feature_key,enabled,change_reason) values('FILE_ANALYSIS_WRITE',false,'SYNTHETIC_ROLLBACK_CHECK')"), '23514');
  rollbackVerified = true;
  const applied = process.env.FILE_ANALYSIS_GATE_MUTATION === 'enabled'
    ? sql.replace("('FILE_ANALYSIS_WRITE', false, 'INITIAL_SAFE_DEFAULT')", "('FILE_ANALYSIS_WRITE', true, 'INITIAL_SAFE_DEFAULT')") : sql;
  await db.exec(applied);
}, { timeout: 60000 });
after(async () => { await db.close(); });

test('0038 adds a disabled write gate without changing existing feature values', async () => {
  const rows = await controls();
  assert.deepEqual(rows.filter(row => row.feature_key !== 'FILE_ANALYSIS_WRITE'), previousControls);
  assert.equal(rows.find(row => row.feature_key === 'FILE_ANALYSIS_WRITE').enabled, false);
  assert.equal(rollbackVerified, true);
});

test('ordinary users cannot enable the new write gate or alter its audit events', async () => {
  for (const name of ['anon', 'authenticated']) {
    await role(name);
    await denied(() => db.query("select public.set_service_feature_state('FILE_ANALYSIS_WRITE',true,'SYNTHETIC_UNAUTHORIZED_CHANGE')"));
    await denied(() => db.query("update public.service_feature_controls set enabled=true where feature_key='FILE_ANALYSIS_WRITE'"));
    await denied(() => db.query("delete from public.service_feature_control_events where feature_key='FILE_ANALYSIS_WRITE'"));
  }
  await db.exec('reset role;');
});

test('operator enable/disable records revisions and does not toggle ordinary journal access', async () => {
  await role('service_role');
  const result = await db.query("select public.set_service_feature_state('FILE_ANALYSIS_WRITE',true,'SYNTHETIC_LOCAL_TEST_ONLY') as revision");
  assert.equal(Number(result.rows[0].revision), 2);
  await db.query("select public.set_service_feature_state('FILE_ANALYSIS_WRITE',false,'SYNTHETIC_LOCAL_ROLLBACK')");
  const events = (await db.query("select previous_enabled,enabled,revision from public.service_feature_control_events where feature_key='FILE_ANALYSIS_WRITE' order by revision")).rows;
  assert.deepEqual(events.map(row => [row.previous_enabled, row.enabled, Number(row.revision)]), [[false, true, 2], [true, false, 3]]);
  assert.deepEqual((await controls()).filter(row => row.feature_key !== 'FILE_ANALYSIS_WRITE'), previousControls);
  await db.exec('reset role;');
});

test('reapplying preparation does not silently reset an operator decision', async () => {
  await role('service_role');
  await db.query("select public.set_service_feature_state('FILE_ANALYSIS_WRITE',true,'SYNTHETIC_REAPPLY_TEST')");
  await db.exec('reset role;');
  const before = await controls();
  await db.exec(sql);
  assert.deepEqual(await controls(), before);
});
