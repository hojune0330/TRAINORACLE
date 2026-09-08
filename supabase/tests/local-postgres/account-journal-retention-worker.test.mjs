import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.account_journal_history(user_id uuid, expires_at timestamptz, encrypted_payload jsonb);
    create table public.account_journal_operations(user_id uuid, payload_expires_at timestamptz,
      result jsonb, proposed_encrypted_payload jsonb, payload_fingerprint text);
    create table public.account_journal_documents(user_id uuid, revision bigint, encrypted_payload jsonb);`);
  await db.exec(readFileSync(new URL('../../migrations/0036_account_journal_retention_worker.sql', import.meta.url), 'utf8'));
});
after(async () => db.close());
test('operator cleanup removes expired versions across accounts, preserving active data and conflict receipts', async () => {
  for (const owner of [A, B]) {
    await db.query(`insert into public.account_journal_history values
      ($1,clock_timestamp()-interval '1 second','{"fixture":"expired"}'),
      ($1,clock_timestamp()+interval '1 day','{"fixture":"recoverable"}')`, [owner]);
    await db.query(`insert into public.account_journal_operations values
      ($1,clock_timestamp()-interval '1 second','{"kind":"saved"}','{"fixture":"old"}','stable-receipt'),
      ($1,null,'{"kind":"conflict"}','{"fixture":"unresolved"}','conflict-receipt')`, [owner]);
    await db.query(`insert into public.account_journal_documents values($1,9,'{"fixture":"active"}')`, [owner]);
  }
  const result = (await db.query('select public.run_account_journal_retention_batch() as value')).rows[0].value;
  assert.deepEqual(result, { kind: 'completed', ownersProcessed: 2, historyPurged: 2, operationPayloadsPurged: 2 });
  assert.equal((await db.query('select * from public.account_journal_history')).rows.length, 2);
  assert.equal((await db.query('select * from public.account_journal_documents where revision=9')).rows.length, 2);
  assert.equal((await db.query("select * from public.account_journal_operations where result->>'kind'='conflict' and proposed_encrypted_payload is not null")).rows.length, 2);
  assert.equal((await db.query("select * from public.account_journal_operations where result->>'kind'='saved' and proposed_encrypted_payload is null and payload_fingerprint='stable-receipt'")).rows.length, 2);
  assert.deepEqual((await db.query('select public.run_account_journal_retention_batch() as value')).rows[0].value,
    { kind: 'completed', ownersProcessed: 0, historyPurged: 0, operationPayloadsPurged: 0 });
});
test('anonymous, authenticated and service-role clients cannot invoke global cleanup', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select public.run_account_journal_retention_batch()'), e => e.code === '42501');
    await db.exec('reset role');
  }
});
