import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Final-schema rehearsal only: synthetic roles, no service URL or real user data.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const self = 'a1111111-1111-4111-8111-111111111111';
const supportedAthlete = 'b2222222-2222-4222-8222-222222222222';

before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,
      updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,
      is_anonymous boolean,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),
      not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for (const file of readdirSync(migrations).filter(name => /^\d+_.+\.sql$/.test(name) && name < '0049').sort()) {
    let sql = readFileSync(new URL(file, migrations), 'utf8');
    if (file.startsWith('0048_') && process.env.LEGACY_SHARING_MUTATION === 'open-body') {
      const guard = "raise exception 'LEGACY_SHARED_JOURNAL_DISABLED' using errcode = '42501';";
      assert.ok(sql.includes(guard));
      sql = sql.replace(guard, 'return;');
    }
    await db.exec(sql);
  }
}, { timeout: 120000 });
after(() => db.close());

test('final schema revokes legacy shared-journal RPC for authenticated callers', async () => {
  const privilege = await db.query(`select has_function_privilege(
    'authenticated', 'public.list_shared_journal_entries(uuid)', 'EXECUTE') value`);
  assert.equal(privilege.rows[0].value, false);
  await db.exec('set role authenticated');
  for (const target of [self, supportedAthlete]) {
    await assert.rejects(db.query('select * from public.list_shared_journal_entries($1)', [target]),
      error => error.code === '42501');
  }
  await db.exec('reset role');
});

test('final function body denies both self and supporter paths even to a privileged caller', async () => {
  for (const target of [self, supportedAthlete]) {
    await assert.rejects(db.query('select * from public.list_shared_journal_entries($1)', [target]),
      error => error.code === '42501' && error.message.includes('LEGACY_SHARED_JOURNAL_DISABLED'));
  }
});
