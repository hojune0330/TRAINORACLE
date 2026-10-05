import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { loadOracleMigrationChain } from './oracle-auth-fixture.mjs'

test('operator synthetic role smoke executes and rolls back every identity, flag and document', async () => {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await loadOracleMigrationChain(db)
    const before = (await db.query('select * from public.service_feature_controls order by feature_key')).rows
    const result = await db.exec(await readFile(new URL('../../operations/account-journal-rls-rollback-smoke.sql', import.meta.url), 'utf8'))
    assert.equal(result.at(-1).rows[0].result, 'SYNTHETIC_RLS_ROLLED_BACK')
    for (const table of ['auth.users','auth.sessions','public.user_private_profiles','public.beta_enrollments','public.account_journal_documents'])
      assert.equal((await db.query(`select count(*)::integer as count from ${table}`)).rows[0].count, 0)
    assert.deepEqual((await db.query('select * from public.service_feature_controls order by feature_key')).rows, before)
  } finally { await db.close() }
}, { timeout: 60000 })
