import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

test('operator synthetic role smoke executes and rolls back every identity, flag and document', async () => {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on all functions in schema auth to anon,authenticated,service_role;`)
    const root = new URL('../../migrations/', import.meta.url)
    for (const name of (await readdir(root)).filter(name => /^\d+_.+\.sql$/.test(name)).sort())
      await db.exec(await readFile(new URL(name, root), 'utf8'))
    const before = (await db.query('select * from public.service_feature_controls order by feature_key')).rows
    const result = await db.exec(await readFile(new URL('../../operations/account-journal-rls-rollback-smoke.sql', import.meta.url), 'utf8'))
    assert.equal(result.at(-1).rows[0].result, 'SYNTHETIC_RLS_ROLLED_BACK')
    for (const table of ['auth.users','public.user_private_profiles','public.beta_enrollments','public.account_journal_documents'])
      assert.equal((await db.query(`select count(*)::integer as count from ${table}`)).rows[0].count, 0)
    assert.deepEqual((await db.query('select * from public.service_feature_controls order by feature_key')).rows, before)
  } finally { await db.close() }
}, { timeout: 60000 })
